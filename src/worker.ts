import apiHandler from "../netlify/functions/api";
import sendReportHandler from "../netlify/functions/send-report";
import loginHandler from "../netlify/functions/login";
import callbackHandler from "../netlify/functions/callback";
import logoutHandler from "../netlify/functions/logout";
import inboundEmailHandler from "../netlify/functions/inbound-email";
import trackHandler from "../netlify/functions/track";
import { handleAuthConfig } from "./server/auth-config";
import { envStorage } from "./server/runtime-env";

interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    return envStorage.run(env as Record<string, string>, async () => {
      // API routing
      if (pathname === "/api/auth-config") {
        return handleAuthConfig();
      }
      if (pathname.startsWith("/api/send-report")) {
        return sendReportHandler(request, ctx);
      }
      if (pathname.startsWith("/api/")) {
        return apiHandler(request);
      }
      if (pathname === "/login") {
        return loginHandler(request);
      }
      if (pathname === "/callback") {
        return callbackHandler(request);
      }
      if (pathname === "/logout") {
        return logoutHandler(request);
      }
      if (pathname === "/inbound-email") {
        return inboundEmailHandler(request);
      }
      if (pathname.startsWith("/t/")) {
        return trackHandler(request);
      }

      // Serve static assets from Cloudflare Worker Assets
      if (env.ASSETS) {
        const response = await env.ASSETS.fetch(request);
        // Fallback to index.html for React Router client-side routing (SPA)
        if (response.status === 404 && !pathname.includes(".")) {
          const indexRequest = new Request(new URL("/index.html", request.url), request);
          return await env.ASSETS.fetch(indexRequest);
        }
        return response;
      }

      return new Response("Not found", { status: 404 });
    });
  }
};
