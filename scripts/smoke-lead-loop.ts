/**
 * Local end-to-end smoke test for the lead ingestion loop.
 *
 *   npx vite-node scripts/smoke-lead-loop.ts
 *
 * Drives the real Netlify function handlers against the real Turso database,
 * using an isolated throwaway agent, then deletes everything it created.
 * Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.local.
 */
import inboundHandler from "../netlify/functions/inbound-email";
import trackHandler from "../netlify/functions/track";
import { getRuntimeEnv } from "../src/server/runtime-env";
import { createSignatisDb, ensureSchema, getLeads, getLeadEvents } from "../src/server/db";

const INGESTION = "inbound+smoke1@leads.signatis.app";
const AGENT_ID = "agent_smoketest";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log("→ smoke start: loading env + connecting Turso...");
  const env = getRuntimeEnv();
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing Turso credentials in .env.local");
  }
  const db = createSignatisDb(env);
  await ensureSchema(db);

  // --- Setup: isolated throwaway agent -----------------------------------
  await db.execute({ sql: "DELETE FROM lead_events WHERE agent_id = ?", args: [AGENT_ID] });
  await db.execute({ sql: "DELETE FROM leads WHERE agent_id = ?", args: [AGENT_ID] });
  await db.execute({ sql: "DELETE FROM agents WHERE id = ?", args: [AGENT_ID] });
  await db.execute({
    sql: `INSERT INTO agents (id, workos_user_id, full_name, email, phone, plan, avatar_initials, ingestion_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [AGENT_ID, "smoke_user", "Smoke Agent", "smoke@signatis.app", "012", "Free", "SA", INGESTION],
  });
  console.log(`\n── Setup: agent ${AGENT_ID} (${INGESTION}) ──\n`);

  try {
    // --- 1. Inbound forwarded PropertyGuru email -------------------------
    const inboundReq = new Request("http://localhost/inbound-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: `"Leads" <${INGESTION}>`,
        from: "PropertyGuru <noreply@propertyguru.com.my>",
        subject: "New enquiry for Mont Kiara Condo",
        text: [
          "You have a new enquiry.",
          "Name: Ahmad Faizal",
          "Email: ahmad.faizal@gmail.com",
          "Phone: +60 12-345 6789",
          "Budget: RM 900,000",
          "Message: Hi, I'm very interested in viewing this unit this weekend.",
        ].join("\n"),
      }),
    });
    const inboundRes = await inboundHandler(inboundReq, {} as never);
    const inboundJson = (await inboundRes.json()) as { success?: boolean; leadId?: string };
    assert(inboundRes.status === 200 && inboundJson.success, "inbound webhook returns success");

    const leads = await getLeads(db, AGENT_ID);
    assert(leads.length === 1, "exactly one lead created in DB");
    const lead = leads[0];
    assert(lead.name === "Ahmad Faizal", `lead name parsed (${lead.name})`);
    assert(lead.email === "ahmad.faizal@gmail.com", `lead email parsed (${lead.email})`);
    assert(lead.source === "PropertyGuru", `source detected (${lead.source})`);
    assert(lead.propertyInterest.includes("Mont Kiara"), `property parsed (${lead.propertyInterest})`);
    assert(lead.sentiment === "positive", `inquiry sentiment positive (${lead.sentiment})`);
    const baseScore = lead.score;
    console.log(`   lead score=${baseScore} tier=${lead.tier} intent=${lead.intent}`);

    // --- 2. Unknown recipient is acked, not errored ----------------------
    const unknownReq = new Request("http://localhost/inbound-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "inbound+nobody@leads.signatis.app", from: "x@y.com", subject: "hi", text: "a@b.com 0123" }),
    });
    const unknownRes = await inboundHandler(unknownReq, {} as never);
    const unknownJson = (await unknownRes.json()) as { skipped?: string };
    assert(unknownRes.status === 200 && unknownJson.skipped === "unknown_recipient", "unknown recipient acked (no agent)");

    // --- 3. Tracking: open pixel increments + rescores -------------------
    const openRes = await trackHandler(new Request(`http://localhost/t/o/${lead.id}`), {} as never);
    assert(openRes.status === 200 && openRes.headers.get("content-type") === "image/gif", "open pixel returns gif");

    // --- 4. Tracking: click redirects + logs ----------------------------
    const clickRes = await trackHandler(
      new Request(`http://localhost/t/c/${lead.id}?u=${encodeURIComponent("https://signatis.app/report/x")}`),
      {} as never,
    );
    assert(clickRes.status === 302, "click redirects (302)");
    assert(clickRes.headers.get("location") === "https://signatis.app/report/x", "click redirects to target url");

    const after = (await getLeads(db, AGENT_ID))[0];
    assert(after.emailOpens === lead.emailOpens + 1, `email_opens incremented (${after.emailOpens})`);
    assert(after.linkClicks === lead.linkClicks + 1, `link_clicks incremented (${after.linkClicks})`);
    assert(after.score > baseScore, `score rose after engagement (${baseScore} -> ${after.score})`);

    const events = await getLeadEvents(db, AGENT_ID, lead.id);
    const types = events.map((e) => e.eventType);
    assert(types.includes("email_open"), "email_open event logged");
    assert(types.includes("link_click"), "link_click event logged");

    console.log(`\n   final: score=${after.score} tier=${after.tier} intent=${after.intent}, events=${events.length}`);
    console.log("\n🎉 Lead loop smoke test PASSED\n");
  } finally {
    // --- Cleanup ---------------------------------------------------------
    await db.execute({ sql: "DELETE FROM lead_events WHERE agent_id = ?", args: [AGENT_ID] });
    await db.execute({ sql: "DELETE FROM leads WHERE agent_id = ?", args: [AGENT_ID] });
    await db.execute({ sql: "DELETE FROM agents WHERE id = ?", args: [AGENT_ID] });
    console.log("🧹 cleaned up test agent + leads + events");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
