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
  <title>Sign In — re:AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #1e1e1e; color: #f8fafc; }
    .card { background: #2b2b2b; border-radius: 16px; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); }
    .rainbow-strip { height: 4px; border-radius: 16px 16px 0 0; background: linear-gradient(45deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff, #e8d7ff); position: absolute; top: 0; left: 0; right: 0; }
    h1 { font-size: 1.5rem; font-weight: 800; margin: 1.5rem 0 0.75rem; color: #ffffff; }
    p { color: #94a3b8; margin: 0 0 1.5rem; font-size: 0.9375rem; line-height: 1.5; }
    .detail { font-size: 0.8125rem; color: #64748b; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; word-break: break-all; margin-bottom: 1.5rem; text-align: left; }
    .btn { display: inline-block; background: linear-gradient(45deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff, #e8d7ff); color: #1e1e1e; text-decoration: none; padding: 0.75rem 2rem; border-radius: 9999px; font-weight: 700; font-size: 0.875rem; transition: transform 0.2s; }
    .btn:hover { transform: scale(1.02); }
  </style>
</head>
<body>
  <div class="card" style="position: relative; overflow: hidden;">
    <div class="rainbow-strip"></div>
    <h1>${message}</h1>
    ${detail ? `<div class="detail">${detail}</div>` : ""}
    <a href="/login" class="btn">Try Again</a>
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
  const promptParam = url.searchParams.get("prompt");
  const prompt = promptParam === null ? "select_account" : (promptParam || undefined);

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
  const codeChallenge = await computeCodeChallenge(codeVerifier);

  const authorizationUrl = getAuthorizationUrl(
    env.SCALEKIT_ENV_URL,
    env.SCALEKIT_CLIENT_ID,
    env.SCALEKIT_REDIRECT_URI,
    {
      state: encodeState(returnTo, codeVerifier),
      scopes: ["openid", "profile", "email"],
      codeChallenge,
      codeChallengeMethod: "S256",
      prompt,
    },
  );

  return Response.redirect(authorizationUrl, 302);
};

export const config: Config = {
  path: "/login",
};
