import type { Config } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import {
  clearCookie,
  SESSION_COOKIE,
  verifyCsrfToken,
} from "../../src/server/auth";

export default async (req: Request) => {
  const runtimeEnv = getRuntimeEnv();
  if (req.method !== "POST") {
    return new Response("Logout requires POST.", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const csrf = req.headers.get("x-csrf-token");
  if (!verifyCsrfToken(csrf, runtimeEnv.CSRF_SECRET)) {
    return Response.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  
  // Since we are clearing our local cookie session, we can redirect directly to /login
  const returnTo = runtimeEnv.SCALEKIT_SIGN_OUT_REDIRECT_URI || "/login";
  headers.append("Location", returnTo);

  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/logout",
};
