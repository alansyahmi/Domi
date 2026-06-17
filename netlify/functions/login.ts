import {
  getAuthorizationUrl,
  generateCodeVerifier,
  computeCodeChallenge,
  encodeState,
} from "../../src/server/scalekit";
import type { Config } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface LoginEnv {
  SCALEKIT_CLIENT_ID?: string;
  SCALEKIT_CLIENT_SECRET?: string;
  SCALEKIT_ENV_URL?: string;
  SCALEKIT_REDIRECT_URI?: string;
}

function getEnv(): LoginEnv {
  const runtimeEnv = getRuntimeEnv();
  return {
    SCALEKIT_CLIENT_ID: runtimeEnv.SCALEKIT_CLIENT_ID,
    SCALEKIT_CLIENT_SECRET: runtimeEnv.SCALEKIT_CLIENT_SECRET,
    SCALEKIT_ENV_URL: runtimeEnv.SCALEKIT_ENV_URL,
    SCALEKIT_REDIRECT_URI: runtimeEnv.SCALEKIT_REDIRECT_URI,
  };
}

function errorPage(message: string, detail?: string): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Signatis</title>
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
    <h1>${message}</h1>
    ${detail ? `<p>${detail}</p>` : ""}
    <a href="/login">Try Again</a>
  </div>
</body>
</html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default async (req: Request) => {
  const env = getEnv();
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/dashboard";
  const error = url.searchParams.get("error");

  // Circuit breaker: if we arrive here with an error param, the callback already failed.
  // Show an error page instead of redirecting to Scalekit again (which would loop).
  if (error) {
    const detail = url.searchParams.get("detail") ?? "";
    const messages: Record<string, string> = {
      missing_code: "The authentication provider did not return an authorization code.",
      incomplete_user: "The authentication provider did not return complete user information.",
      auth_failed: "Authentication could not be completed.",
    };
    return errorPage(
      "Sign In Failed",
      detail || messages[error] || `Authentication error: ${error}`,
    );
  }

  if (!env.SCALEKIT_CLIENT_ID || !env.SCALEKIT_CLIENT_SECRET || !env.SCALEKIT_ENV_URL || !env.SCALEKIT_REDIRECT_URI) {
    return Response.json(
      {
        error: "Scalekit is not configured.",
        required: ["SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL", "SCALEKIT_REDIRECT_URI"],
      },
      { status: 500 },
    );
  }

  // PKCE flow: generate verifier + challenge, store verifier in state for the callback.
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = computeCodeChallenge(codeVerifier);

  const authorizationUrl = getAuthorizationUrl(
    env.SCALEKIT_ENV_URL,
    env.SCALEKIT_CLIENT_ID,
    env.SCALEKIT_REDIRECT_URI,
    {
      state: encodeState(returnTo, codeVerifier),
      scopes: ["openid", "profile", "email"],
      provider: "google",
      codeChallenge,
      codeChallengeMethod: "S256",
    },
  );

  return Response.redirect(authorizationUrl, 302);
};

export const config: Config = {
  path: "/login",
};
