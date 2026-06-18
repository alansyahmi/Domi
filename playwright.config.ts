import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scratch",
  timeout: 30000,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
  },
});
