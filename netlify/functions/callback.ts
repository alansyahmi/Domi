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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #041627; color: #f8fafc; }
    .card { background: #07192a; border-radius: 16px; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); }
    .rainbow-strip { height: 4px; border-radius: 16px 16px 0 0; background: linear-gradient(45deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff, #e8d7ff); position: absolute; top: 0; left: 0; right: 0; }
    h1 { font-size: 1.5rem; font-weight: 800; margin: 1.5rem 0 0.75rem; color: #ffffff; }
    p { color: #94a3b8; margin: 0 0 1.5rem; font-size: 0.9375rem; line-height: 1.5; }
    .detail { font-size: 0.8125rem; color: #64748b; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; word-break: break-all; margin-bottom: 1.5rem; text-align: left; }
    .btn { display: inline-block; background: linear-gradient(45deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff, #e8d7ff); color: #041627; text-decoration: none; padding: 0.75rem 2rem; border-radius: 9999px; font-weight: 700; font-size: 0.875rem; transition: transform 0.2s; }
    .btn:hover { transform: scale(1.02); }
  </style>
</head>
<body>
  <div class="card" style="position: relative; overflow: hidden;">
    <div class="rainbow-strip"></div>
    <h1>Sign In Failed</h1>
    <p>${message}</p>
    ${detail ? `<div class="detail">${detail}</div>` : ""}
    <a href="/login" class="btn">Try Again</a>
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

    const rawSessionToken = authResp.idToken;

    const headers = new Headers();
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, rawSessionToken, { secure: !isLocal }));
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
