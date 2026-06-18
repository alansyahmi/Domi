import type { Config } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import {
  clearCookie,
  SESSION_COOKIE,
  verifyCsrfToken,
} from "../../src/server/auth";
import { getLogoutUrl } from "../../src/server/scalekit";

export default async (req: Request) => {
  const runtimeEnv = getRuntimeEnv();
  if (req.method !== "POST") {
    return new Response("Logout requires POST.", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const csrf = req.headers.get("x-csrf-token");
  if (!(await verifyCsrfToken(csrf, runtimeEnv.CSRF_SECRET))) {
    return Response.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const headers = new Headers();
  // Clear our local session cookie
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));

  // Redirect browser to Scalekit's sign-out so their session is also cleared.
  // Scalekit will redirect the browser back to our app afterward.
  const postLogoutRedirectUri =
    runtimeEnv.SCALEKIT_SIGN_OUT_REDIRECT_URI ||
    `${new URL(req.url).origin}/?logout=true`;

  const scalekitLogoutUrl = runtimeEnv.SCALEKIT_ENV_URL
    ? getLogoutUrl(runtimeEnv.SCALEKIT_ENV_URL, postLogoutRedirectUri)
    : postLogoutRedirectUri;

  headers.append("Location", scalekitLogoutUrl);

  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/logout",
};
