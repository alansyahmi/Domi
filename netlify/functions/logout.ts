import type { Config } from "@netlify/functions";
import { WorkOS } from "@workos-inc/node";
import {
  clearCookie,
  parseCookies,
  SESSION_COOKIE,
  verifyCsrfToken,
} from "../../src/server/auth";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Logout requires POST.", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const csrf = req.headers.get("x-csrf-token");
  if (!verifyCsrfToken(csrf, process.env.CSRF_SECRET)) {
    return Response.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const sessionData = parseCookies(req.headers.get("cookie") ?? "")[SESSION_COOKIE];
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));

  if (!sessionData || !process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID || !process.env.WORKOS_COOKIE_PASSWORD) {
    headers.append("Location", "/login");
    return new Response(null, { status: 302, headers });
  }

  const workos = new WorkOS(process.env.WORKOS_API_KEY, {
    clientId: process.env.WORKOS_CLIENT_ID,
  });

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });
    const logoutUrl = await session.getLogoutUrl({
      returnTo: process.env.WORKOS_SIGN_OUT_REDIRECT_URI ?? "/login",
    });
    headers.append("Location", logoutUrl);
  } catch {
    headers.append("Location", "/login");
  }

  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/logout",
};
