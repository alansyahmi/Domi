import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

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
  const secret = env.SESSION_SECRET || env.WORKOS_COOKIE_PASSWORD || "fallback-secret-for-signing-session-tokens-at-least-32-chars";
  const sessionData = parseCookies(cookieHeader ?? "")[SESSION_COOKIE];

  if (!sessionData) {
    return {
      authenticated: false,
      status: 401,
      reason: "No authenticated session.",
    };
  }

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

export function createCsrfToken(secret: string): string {
  const nonce = randomBytes(18).toString("base64url");
  const signature = createHmac("sha256", secret).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(token: string | null | undefined, secret: string | undefined): boolean {
  if (!token || !secret) return false;
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;

  const expected = createHmac("sha256", secret).update(nonce).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}
