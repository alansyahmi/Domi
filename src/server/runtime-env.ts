import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

type EnvMap = Record<string, string | undefined>;

export const envStorage = new AsyncLocalStorage<EnvMap>();

function parseEnvFile(filePath: string): EnvMap {
  try {
    if (!fs.existsSync(filePath)) return {};

    const contents = fs.readFileSync(filePath, "utf8");
    return Object.fromEntries(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          if (index === -1) return null;
          return [line.slice(0, index), line.slice(index + 1)] as const;
        })
        .filter((entry): entry is readonly [string, string] => entry !== null),
    );
  } catch {
    return {};
  }
}

const fileEnv = (() => {
  try {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      const cwd = process.cwd();
      return {
        ...parseEnvFile(path.join(cwd, ".env")),
        ...parseEnvFile(path.join(cwd, ".env.local")),
      };
    }
  } catch {
    // Ignore filesytem errors in sandbox contexts
  }
  return {};
})();

export function getRuntimeEnv(): EnvMap {
  const store = envStorage.getStore();
  if (store) {
    return store;
  }
  return {
    ...fileEnv,
    ...process.env,
  };
}

