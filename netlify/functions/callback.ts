import type { Config } from "@netlify/functions";
import { WorkOS } from "@workos-inc/node";
import { buildCookie, SESSION_COOKIE } from "../../src/server/auth";
import { createSignatisDb, ensureAgentWorkspace } from "../../src/server/db";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface CallbackEnv {
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_COOKIE_PASSWORD?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

function getEnv(): CallbackEnv {
  const runtimeEnv = getRuntimeEnv();
  return {
    WORKOS_API_KEY: runtimeEnv.WORKOS_API_KEY,
    WORKOS_CLIENT_ID: runtimeEnv.WORKOS_CLIENT_ID,
    WORKOS_COOKIE_PASSWORD: runtimeEnv.WORKOS_COOKIE_PASSWORD,
    TURSO_DATABASE_URL: runtimeEnv.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: runtimeEnv.TURSO_AUTH_TOKEN,
  };
}

function decodeReturnTo(state: string | null): string {
  if (!state) return "/dashboard";

  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      returnTo?: string;
    };
    return parsed.returnTo?.startsWith("/") ? parsed.returnTo : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default async (req: Request) => {
  const env = getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.redirect("/login", 302);
  }

  if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID || !env.WORKOS_COOKIE_PASSWORD) {
    return Response.json(
      {
        error: "WorkOS callback is not configured.",
        required: ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD"],
      },
      { status: 500 },
    );
  }

  const workos = new WorkOS(env.WORKOS_API_KEY, {
    clientId: env.WORKOS_CLIENT_ID,
  });

  try {
    const auth = await workos.userManagement.authenticateWithCode({
      clientId: env.WORKOS_CLIENT_ID,
      code,
      session: {
        sealSession: true,
        cookiePassword: env.WORKOS_COOKIE_PASSWORD,
      },
    });

    if (!auth.sealedSession) {
      return Response.redirect("/login", 302);
    }

    const db = createSignatisDb(env);
    await ensureAgentWorkspace(db, {
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
    });

    const headers = new Headers();
    headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, auth.sealedSession));
    headers.append("Location", decodeReturnTo(url.searchParams.get("state")));

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch {
    return Response.redirect("/login", 302);
  }
};

export const config: Config = {
  path: "/callback",
};
