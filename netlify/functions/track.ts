import type { Config } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import { createReAIDb, recordLeadEngagement } from "../../src/server/db";

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

/**
 * Engagement tracking endpoints, embedded in agent outbound emails:
 *   /t/o/<leadId>           — 1x1 pixel, logs an email_open
 *   /t/c/<leadId>?u=<url>   — logs a link_click, then 302s to the real URL
 *
 * Tracking must never block the user experience: the pixel always returns an
 * image and clicks always redirect, even when the lead lookup fails.
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["t", "o"|"c", leadId]
  const kind = parts[1];
  const leadId = parts[2] ?? "";

  const env = getRuntimeEnv();

  if (kind === "o") {
    if (leadId) {
      try {
        const db = createReAIDb(env);
        await recordLeadEngagement(db, leadId, "email_open");
      } catch (err) {
        console.error("[Track] open failed:", err);
      }
    }
    return pixelResponse();
  }

  if (kind === "c") {
    const target = url.searchParams.get("u");
    let destination = "https://re-ai.app";
    if (target) {
      try {
        const parsed = new URL(target);
        // Only allow http(s) redirects to avoid open-redirect to javascript:/data:.
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          destination = parsed.toString();
        }
      } catch {
        // keep default destination
      }
    }
    if (leadId) {
      try {
        const db = createReAIDb(env);
        await recordLeadEngagement(db, leadId, "link_click", `Clicked link to ${destination}`);
      } catch (err) {
        console.error("[Track] click failed:", err);
      }
    }
    return Response.redirect(destination, 302);
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/t/*",
};
