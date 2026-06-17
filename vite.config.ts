import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "netlify/**/*.test.ts"],
  },
});