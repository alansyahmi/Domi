export type SignatisAuthMode = "demo" | "workos";

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
