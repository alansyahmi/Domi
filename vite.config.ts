import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:58233",
      "/login": "http://127.0.0.1:58233",
      "/callback": "http://127.0.0.1:58233",
      "/logout": "http://127.0.0.1:58233",
      "/inbound-email": "http://127.0.0.1:58233",
      "/t": "http://127.0.0.1:58233",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "netlify/**/*.test.ts"],
  },
});
