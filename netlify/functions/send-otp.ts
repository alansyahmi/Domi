import type { Config } from "@netlify/functions";
import { generateOtpCode, storeOtpCode } from "../../src/server/otp-store";
import { sendEmail } from "../../src/server/notifications/email";
import { getRuntimeEnv } from "../../src/server/runtime-env";

interface SendOtpBody {
  email?: string;
}

function buildOtpEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f9fb; padding: 2rem;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #041627; padding: 1.5rem 2rem;">
      <h1 style="color: white; margin: 0; font-size: 1.25rem;">Your Signatis verification code</h1>
    </div>
    <div style="padding: 2rem;">
      <p style="color: #475569;">Use this code to sign in to your Signatis account:</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 1.5rem; text-align: center; margin: 1.5rem 0;">
        <span style="font-size: 2rem; font-weight: 800; letter-spacing: 0.25em; color: #041627; font-family: monospace;">${code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 0.875rem;">This code expires in 5 minutes. If you didn't request this code, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const runtimeEnv = getRuntimeEnv();

  // Parse body
  let body: SendOtpBody;
  try {
    body = (await req.json()) as SendOtpBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Valid email is required" }, { status: 400 });
  }

  // Generate and store OTP (in-memory, no DB needed)
  const code = generateOtpCode();
  storeOtpCode(email, code);

  // Try to send email via Resend; log to console in dev if not configured
  const resendApiKey = runtimeEnv.RESEND_API_KEY;
  if (resendApiKey) {
    const fromEmail = runtimeEnv.RESEND_FROM_EMAIL || "Signatis <reports@signatis.app>";
    const result = await sendEmail(resendApiKey, {
      from: fromEmail,
      to: email,
      subject: "Your Signatis verification code",
      html: buildOtpEmailHtml(code),
    });
    if (!result.success) {
      console.error("[send-otp] Resend failed, falling back to console log:", result.error);
      console.log(`[send-otp] OTP for ${email}: ${code}`);
    }
  } else {
    console.log(`[send-otp] OTP for ${email}: ${code}`);
  }

  // Always return success — don't reveal whether the email exists
  return Response.json({ success: true });
};

export const config: Config = {
  path: "/auth/send-otp",
};
