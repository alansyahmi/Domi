import fs from "node:fs";
import path from "node:path";

type EnvMap = Record<string, string | undefined>;

function parseEnvFile(filePath: string): EnvMap {
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
}

const fileEnv = (() => {
  const cwd = process.cwd();
  return {
    ...parseEnvFile(path.join(cwd, ".env")),
    ...parseEnvFile(path.join(cwd, ".env.local")),
  };
})();

export function getRuntimeEnv(): EnvMap {
  return {
    ...fileEnv,
    ...process.env,
  };
}
