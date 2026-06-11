import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss(), netlify()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "netlify/**/*.test.ts"],
  },
});
