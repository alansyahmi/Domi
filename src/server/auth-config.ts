import { getRuntimeEnv } from "./runtime-env";

export interface AuthConfigResponse {
  configured: boolean;
  clientId: string | null;
}

/**
 * Returns whether Scalekit authentication is configured.
 * Called by the frontend at startup to determine auth mode at runtime
 * instead of relying on build-time VITE_* environment variables.
 */
export function handleAuthConfig(): Response {
  const env = getRuntimeEnv();

  const configured = Boolean(
    env.SCALEKIT_CLIENT_ID &&
      env.SCALEKIT_CLIENT_SECRET &&
      env.SCALEKIT_ENV_URL &&
      env.SCALEKIT_REDIRECT_URI,
  );

  const body: AuthConfigResponse = {
    configured,
    clientId: env.SCALEKIT_CLIENT_ID ?? null,
  };

  return Response.json(body);
}
