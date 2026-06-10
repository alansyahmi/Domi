export type SignatisAuthMode = "demo" | "workos";

export function resolveAuthMode({
  dev,
  prod,
  mode,
}: {
  dev: boolean;
  prod: boolean;
  mode?: string;
}): SignatisAuthMode {
  if (prod) return "workos";
  if (mode === "workos") return "workos";
  if (mode === "demo") return "demo";
  return dev ? "demo" : "workos";
}
