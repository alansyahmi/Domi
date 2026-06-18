import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { randomBytesBase64url, hmacSha256Base64url, timingSafeEqual } from "./crypto";

export const SESSION_COOKIE = "wos-session";
export const CSRF_COOKIE = "signatis-csrf";

export interface SessionUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface AuthenticatedSession {
  authenticated: true;
  user: SessionUser;
  sealedSession?: string;
  setCookie?: string;
}

export interface UnauthenticatedSession {
  authenticated: false;
  status: 401;
  reason: string;
}

export type SessionResult = AuthenticatedSession | UnauthenticatedSession;

export interface AuthEnv {
  SESSION_SECRET?: string;
  WORKOS_COOKIE_PASSWORD?: string; // fallback
  CSRF_SECRET?: string;
  SCALEKIT_ENV_URL?: string;
  SCALEKIT_CLIENT_ID?: string;
}

let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyScalekitToken(token: string, envUrl: string, clientId: string): Promise<SessionUser | null> {
  try {
    if (!jwkSet) {
      const jwksUri = `${envUrl.replace(/\/+$/, "")}/keys`;
      jwkSet = createRemoteJWKSet(new URL(jwksUri));
    }
    const { payload } = await jwtVerify(token, jwkSet, {
      audience: clientId,
      issuer: envUrl.replace(/\/+$/, ""),
    });
    return {
      id: String(payload.sub),
      email: String(payload.email),
      firstName: payload.given_name ? String(payload.given_name) : (payload.name ? String(payload.name).split(" ")[0] : null),
      lastName: payload.family_name ? String(payload.family_name) : (payload.name ? String(payload.name).split(" ").slice(1).join(" ") : null),
    };
  } catch (err) {
    console.error("Scalekit JWKS verification failed:", err);
    return null;
  }
}

export function parseCookies(cookieHeader = ""): Record<string, string> {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

export function buildCookie(
  name: string,
  value: string,
  options: { maxAge?: number; httpOnly?: boolean; secure?: boolean } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    options.httpOnly === false ? "" : "HttpOnly",
    options.secure === false ? "" : "Secure",
    "SameSite=Lax",
  ].filter(Boolean);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function sealSession(user: SessionUser, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey);
}

export async function unsealSession(token: string, secret: string): Promise<SessionUser | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return {
      id: String(payload.id),
      email: String(payload.email),
      firstName: payload.firstName ? String(payload.firstName) : null,
      lastName: payload.lastName ? String(payload.lastName) : null,
    };
  } catch {
    return null;
  }
}

export async function requireSession({
  cookieHeader,
  env,
}: {
  cookieHeader: string | null | undefined;
  workos?: any; // kept for signature compatibility
  env: AuthEnv;
}): Promise<SessionResult> {
  const sessionData = parseCookies(cookieHeader ?? "")[SESSION_COOKIE];

  if (!sessionData) {
    return {
      authenticated: false,
      status: 401,
      reason: "No authenticated session.",
    };
  }

  if (env.SCALEKIT_ENV_URL && env.SCALEKIT_CLIENT_ID) {
    const user = await verifyScalekitToken(sessionData, env.SCALEKIT_ENV_URL, env.SCALEKIT_CLIENT_ID);
    if (user) {
      return {
        authenticated: true,
        user,
      };
    }
    // Scalekit check failed — fall through to local JWT verification
    // so OTP-authenticated users (locally-sealed sessions) also work.
  }

  // Local JWT verification (OTP auth or Scalekit-less fallback)
  const secret = env.SESSION_SECRET || env.WORKOS_COOKIE_PASSWORD || "fallback-secret-for-signing-session-tokens-at-least-32-chars";
  const user = await unsealSession(sessionData, secret);
  if (user) {
    return {
      authenticated: true,
      user,
    };
  }

  return {
    authenticated: false,
    status: 401,
    reason: "Session is not authenticated or expired.",
  };
}

export async function createCsrfToken(secret: string): Promise<string> {
  const nonce = randomBytesBase64url(18);
  const signature = await hmacSha256Base64url(secret, nonce);
  return `${nonce}.${signature}`;
}

export async function verifyCsrfToken(token: string | null | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;

  const expected = await hmacSha256Base64url(secret, nonce);
  return timingSafeEqual(signature, expected);
}
