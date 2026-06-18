import { AsyncLocalStorage } from "node:async_hooks";

type EnvMap = Record<string, string | undefined>;

export const envStorage = new AsyncLocalStorage<EnvMap>();

/**
 * Return the current environment variables.
 *
 * In Cloudflare Workers, the Worker's fetch() handler wraps every request in
 * `envStorage.run(env, ...)`, so `getStore()` returns the Worker's env vars
 * (bindings + secrets).
 *
 * In local Node.js dev (wrangler dev, Netlify dev, vitest), `envStorage.run()`
 * may not be called, so we fall back to `process.env`.
 */
export function getRuntimeEnv(): EnvMap {
  const store = envStorage.getStore();
  if (store) {
    return store;
  }
  // Fallback for local Node.js dev — Wrangler / Netlify CLI load .env files
  // into process.env automatically.
  return process.env as EnvMap;
}
