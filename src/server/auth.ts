import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "wos-session";
export const CSRF_COOKIE = "domi-csrf";

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

interface WorkosSessionLike {
  authenticate(): Promise<{
    authenticated: boolean;
    reason?: string;
    user?: SessionUser;
  }>;
  refresh?(): Promise<{
    authenticated: boolean;
    sealedSession?: string;
    user?: SessionUser;
  }>;
}

export interface WorkosLike {
  userManagement: {
    loadSealedSession(options: {
      sessionData: string;
      cookiePassword: string;
    }): WorkosSessionLike;
  };
}

export interface AuthEnv {
  WORKOS_COOKIE_PASSWORD?: string;
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

export async function requireSession({
  cookieHeader,
  workos,
  env,
}: {
  cookieHeader: string | null | undefined;
  workos: WorkosLike | null;
  env: AuthEnv;
}): Promise<SessionResult> {
  const cookiePassword = env.WORKOS_COOKIE_PASSWORD;
  const sessionData = parseCookies(cookieHeader ?? "")[SESSION_COOKIE];

  if (!cookiePassword || cookiePassword.length < 32) {
    return {
      authenticated: false,
      status: 401,
      reason: "WorkOS cookie password is not configured.",
    };
  }

  if (!sessionData || !workos) {
    return {
      authenticated: false,
      status: 401,
      reason: "No authenticated session.",
    };
  }

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword,
    });
    const authResult = await session.authenticate();

    if (authResult.authenticated && authResult.user) {
      return {
        authenticated: true,
        user: authResult.user,
      };
    }

    if (session.refresh) {
      const refreshResult = await session.refresh();
      if (refreshResult.authenticated && refreshResult.user && refreshResult.sealedSession) {
        return {
          authenticated: true,
          user: refreshResult.user,
          sealedSession: refreshResult.sealedSession,
          setCookie: buildCookie(SESSION_COOKIE, refreshResult.sealedSession),
        };
      }
    }

    return {
      authenticated: false,
      status: 401,
      reason: authResult.reason ?? "Session is not authenticated.",
    };
  } catch {
    return {
      authenticated: false,
      status: 401,
      reason: "Session could not be verified.",
    };
  }
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
