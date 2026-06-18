export type SignatisAuthMode = "demo" | "workos";

// ---------------------------------------------------------------------------
// Legacy build-time resolution (kept for test compatibility)
// ---------------------------------------------------------------------------

export function resolveAuthMode({
  dev,
  prod,
  mode,
  workosConfigured = false,
}: {
  dev: boolean;
  prod: boolean;
  mode?: string;
  workosConfigured?: boolean;
}): SignatisAuthMode {
  if (mode === "demo") return "demo";
  if (mode === "workos" && workosConfigured) return "workos";
  if (prod && workosConfigured) return "workos";
  return "demo";
}

// ---------------------------------------------------------------------------
// Runtime resolution — fetches auth config from the backend
// ---------------------------------------------------------------------------

export interface AuthConfig {
  configured: boolean;
  clientId: string | null;
}

/**
 * Fetch the auth configuration from the backend at runtime.
 * This replaces build-time VITE_* environment variables so the
 * correct auth mode is used regardless of where the app is deployed.
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  try {
    const response = await fetch("/api/auth-config");
    if (!response.ok) return { configured: false, clientId: null };
    return (await response.json()) as AuthConfig;
  } catch {
    return { configured: false, clientId: null };
  }
}

/**
 * Resolve the auth mode from a runtime config fetched from the backend.
 */
export function resolveAuthModeFromConfig(config: AuthConfig): SignatisAuthMode {
  return config.configured ? "workos" : "demo";
}
