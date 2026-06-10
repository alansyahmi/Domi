import type { Config } from "@netlify/functions";
import { WorkOS } from "@workos-inc/node";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface LoginEnv {
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_REDIRECT_URI?: string;
}

function getEnv(): LoginEnv {
  const runtimeEnv = getRuntimeEnv();
  return {
    WORKOS_API_KEY: runtimeEnv.WORKOS_API_KEY,
    WORKOS_CLIENT_ID: runtimeEnv.WORKOS_CLIENT_ID,
    WORKOS_REDIRECT_URI: runtimeEnv.WORKOS_REDIRECT_URI,
  };
}

function encodeState(returnTo: string): string {
  return Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");
}

export default async (req: Request) => {
  const env = getEnv();
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/dashboard";

  if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID || !env.WORKOS_REDIRECT_URI) {
    return Response.json(
      {
        error: "WorkOS is not configured.",
        required: ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_REDIRECT_URI"],
      },
      { status: 500 },
    );
  }

  const workos = new WorkOS(env.WORKOS_API_KEY, {
    clientId: env.WORKOS_CLIENT_ID,
  });

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    clientId: env.WORKOS_CLIENT_ID,
    redirectUri: env.WORKOS_REDIRECT_URI,
    provider: "authkit",
    state: encodeState(returnTo),
  });

  return Response.redirect(authorizationUrl, 302);
};

export const config: Config = {
  path: "/login",
};
