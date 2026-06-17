import type { Config } from "@netlify/functions";
import { authenticateWithCode, decodeState } from "../../src/server/scalekit";
import { buildCookie, sealSession, SESSION_COOKIE } from "../../src/server/auth";
import { createSignatisDb, ensureAgentWorkspace } from "../../src/server/db";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface CallbackEnv {
  SCALEKIT_CLIENT_ID?: string;
  SCALEKIT_CLIENT_SECRET?: string;
  SCALEKIT_ENV_URL?: string;
  SCALEKIT_REDIRECT_URI?: string;
  SESSION_SECRET?: string;
  WORKOS_COOKIE_PASSWORD?: string; // fallback
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

function getEnv(): CallbackEnv {
  const runtimeEnv = getRuntimeEnv();
  return {
    SCALEKIT_CLIENT_ID: runtimeEnv.SCALEKIT_CLIENT_ID,
    SCALEKIT_CLIENT_SECRET: runtimeEnv.SCALEKIT_CLIENT_SECRET,
    SCALEKIT_ENV_URL: runtimeEnv.SCALEKIT_ENV_URL,
    SCALEKIT_REDIRECT_URI: runtimeEnv.SCALEKIT_REDIRECT_URI,
    SESSION_SECRET: runtimeEnv.SESSION_SECRET,
    WORKOS_COOKIE_PASSWORD: runtimeEnv.WORKOS_COOKIE_PASSWORD,
    TURSO_DATABASE_URL: runtimeEnv.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: runtimeEnv.TURSO_AUTH_TOKEN,
  };
}

function errorPage(message: string, detail?: string): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In Failed — Signatis</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f7f9fb; color: #1e293b; }
    .card { background: white; border-radius: 12px; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    p { color: #64748b; margin: 0 0 1.5rem; font-size: 0.9375rem; }
    .detail { font-size: 0.8125rem; color: #94a3b8; word-break: break-all; margin-bottom: 1.5rem; }
    a { display: inline-block; background: #0f172a; color: white; text-decoration: none; padding: 0.625rem 1.5rem; border-radius: 8px; font-weight: 500; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign In Failed</h1>
    <p>${message}</p>
    ${detail ? `<div class="detail">${detail}</div>` : ""}
    <a href="/login">Try Again</a>
  </div>
</body>
</html>`;
  return new Response(body, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default async (req: Request) => {
  const env = getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // If Scalekit itself returned an error (e.g. access_denied), show it — don't loop.
  if (error) {
    const desc = url.searchParams.get("error_description") ?? "";
    console.error("Scalekit returned error:", error, desc);
    return errorPage(
      `Authentication was not completed.`,
      desc || `Error code: ${error}`,
    );
  }

  if (!code) {
    console.error("Callback missing authorization code — redirecting to login with error.");
    return Response.redirect(new URL("/login?error=missing_code", req.url).toString(), 302);
  }

  if (!env.SCALEKIT_CLIENT_ID || !env.SCALEKIT_CLIENT_SECRET || !env.SCALEKIT_ENV_URL || !env.SCALEKIT_REDIRECT_URI) {
    return Response.json(
      {
        error: "Scalekit callback is not configured.",
        required: ["SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL", "SCALEKIT_REDIRECT_URI"],
      },
      { status: 500 },
    );
  }

  const statePayload = decodeState(url.searchParams.get("state"));

  try {
    // PKCE: pass the code verifier stored in state during the authorization request.
    const authResp = await authenticateWithCode(
      env.SCALEKIT_ENV_URL,
      env.SCALEKIT_CLIENT_ID,
      env.SCALEKIT_CLIENT_SECRET,
      code,
      env.SCALEKIT_REDIRECT_URI,
      statePayload.codeVerifier,
    );

    // Use the already-parsed user object from the SDK — no need for a separate validateToken round-trip.
    const user = authResp.user;
    if (!user?.id || !user?.email) {
      console.error("Authentication response missing user id or email");
      return Response.redirect(new URL("/login?error=incomplete_user", req.url).toString(), 302);
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      firstName: user.givenName || user.name?.split(" ")[0] || "Signatis",
      lastName: user.familyName || user.name?.split(" ").slice(1).join(" ") || "Agent",
    };

    const db = createSignatisDb(env);
    await ensureAgentWorkspace(db, sessionUser);

    const secret = env.SESSION_SECRET || env.WORKOS_COOKIE_PASSWORD || "fallback-secret-for-signing-session-tokens-at-least-32-chars";
    const sealedSession = await sealSession(sessionUser, secret);

    const headers = new Headers();
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, sealedSession, { secure: !isLocal }));
    headers.append("Location", statePayload.returnTo || "/dashboard");

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Scalekit authentication error:", message);
    // Redirect with error param — login.ts will detect this and show an error page instead of looping.
    return Response.redirect(new URL(`/login?error=auth_failed&detail=${encodeURIComponent(message)}`, req.url).toString(), 302);
  }
};

export const config: Config = {
  path: "/callback",
};
