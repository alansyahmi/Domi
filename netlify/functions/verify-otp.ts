import type { Config } from "@netlify/functions";
import { verifyOtpCode } from "../../src/server/otp-store";
import {
  createSignatisDb,
  findAgentByEmail,
  createOtpAgent,
} from "../../src/server/db";
import { buildCookie, sealSession, SESSION_COOKIE } from "../../src/server/auth";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface VerifyOtpBody {
  email?: string;
  code?: string;
  returnTo?: string;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const runtimeEnv = getRuntimeEnv();

  // Parse body
  let body: VerifyOtpBody;
  try {
    body = (await req.json()) as VerifyOtpBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();

  if (!email || !code) {
    return Response.json({ error: "Email and code are required" }, { status: 400 });
  }

  // Verify the OTP code using in-memory store
  const otpValid = verifyOtpCode(email, code);
  if (!otpValid) {
    return Response.json(
      { error: "Invalid or expired verification code" },
      { status: 401 },
    );
  }

  // Look up or create agent (requires Turso DB)
  let agent: { id: string; workosUserId: string; email: string; fullName: string } | null = null;
  try {
    const db = createSignatisDb(runtimeEnv);
    const found = await findAgentByEmail(db, email);
    if (found) {
      agent = found;
    } else {
      // New user — extract name from email (the part before @)
      const firstName = email.split("@")[0]?.replace(/[._]/g, " ") || "Signatis";
      agent = await createOtpAgent(db, email, firstName);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verify-otp] DB error (creating dev fallback session):", message);
    // Dev fallback: create a minimal in-memory user so auth still works
    // without a configured database.
    const devId = `dev_${crypto.randomUUID()}`;
    agent = {
      id: `agent_${devId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`,
      workosUserId: devId,
      email,
      fullName: email.split("@")[0]?.replace(/[._]/g, " ") || "Signatis Agent",
    };
  }

  // Create session using local JWT sealing (no Scalekit ID token)
  const sessionSecret =
    runtimeEnv.SESSION_SECRET ||
    runtimeEnv.WORKOS_COOKIE_PASSWORD ||
    "fallback-secret-for-signing-session-tokens-at-least-32-chars";

  const rawSessionToken = await sealSession(
    {
      id: agent.workosUserId,
      email: agent.email,
      firstName: agent.fullName.split(" ")[0],
      lastName: agent.fullName.split(" ").slice(1).join(" ") || null,
    },
    sessionSecret,
  );

  const isLocal =
    req.headers.get("host")?.includes("localhost") ||
    req.headers.get("host")?.includes("127.0.0.1");

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  headers.append(
    "Set-Cookie",
    buildCookie(SESSION_COOKIE, rawSessionToken, { secure: !isLocal }),
  );

  const redirectTo = body.returnTo || "/dashboard";

  return Response.json({ success: true, redirectTo }, { headers });
};

export const config: Config = {
  path: "/auth/verify-otp",
};
