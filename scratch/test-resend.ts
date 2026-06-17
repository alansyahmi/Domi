import { sendEmail } from "../src/server/notifications/email";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  console.log("Testing Resend API with key:", process.env.RESEND_API_KEY?.substring(0, 8) + "...");
  const result = await sendEmail(process.env.RESEND_API_KEY!, {
    to: "test@example.com", // This will likely fail on free tier
    subject: "Test",
    html: "<p>Test</p>",
  });
  console.log(result);
}

run().catch(console.error);
