/**
 * WhatsApp Cloud API client for sending lead notifications to agents.
 *
 * Uses Meta's WhatsApp Cloud API v22.0 directly.
 * Each agent stores their own WhatsApp Business credentials
 * (phone_number_id, permanent access token) in the agent_credentials table.
 */

const WHATSAPP_API_BASE = "https://graph.facebook.com/v22.0";

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a plain text message via WhatsApp Cloud API.
 * This is used for internal agent notifications (new lead, follow-up reminder).
 */
export async function sendWhatsAppMessage(
  creds: WhatsAppCredentials,
  to: string,
  body: string,
): Promise<WhatsAppMessageResult> {
  const normalizedNumber = normalizePhoneNumber(to);

  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedNumber,
          type: "text",
          text: { preview_url: true, body },
        }),
      },
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      const errorObj = data as { error?: { message?: string } };
      const errorMsg = errorObj?.error?.message ?? `HTTP ${response.status}`;
      console.error("[WhatsApp] Send failed:", errorMsg);
      return { success: false, error: errorMsg };
    }

    const successData = data as { messages?: Array<{ id?: string }> };
    return {
      success: true,
      messageId: successData?.messages?.[0]?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Exception:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a template message (pre-approved by Meta) for transactional use cases.
 * Templates are more reliable than free-form messages for first outreach.
 */
export async function sendWhatsAppTemplate(
  creds: WhatsAppCredentials,
  to: string,
  templateName: string,
  components: Record<string, string>,
): Promise<WhatsAppMessageResult> {
  const normalizedNumber = normalizePhoneNumber(to);

  try {
    const bodyParams = Object.entries(components).map(([key, value]) => ({
      type: "text",
      text: value,
    }));

    const response = await fetch(
      `${WHATSAPP_API_BASE}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedNumber,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_MY" },
            components: [
              {
                type: "body",
                parameters: bodyParams.map((p) => ({ type: "text", text: p.text })),
              },
            ],
          },
        }),
      },
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      const errorData = data as { error?: { message?: string } };
      const errorMsg = errorData?.error?.message ?? `HTTP ${response.status}`;
      console.error("[WhatsApp] Template send failed:", errorMsg);
      return { success: false, error: errorMsg };
    }

    const successData = data as { messages?: Array<{ id?: string }> };
    return {
      success: true,
      messageId: successData?.messages?.[0]?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Template exception:", message);
    return { success: false, error: message };
  }
}

/**
 * Verify that stored WhatsApp credentials are valid by
 * fetching the phone number's profile.
 */
export async function verifyWhatsAppCredentials(
  creds: WhatsAppCredentials,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${creds.phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const data: unknown = await response.json();
      const errorData = data as { error?: { message?: string } };
      return {
        valid: false,
        error: errorData?.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: message };
  }
}

/**
 * Normalize a Malaysian phone number to international format for WhatsApp API.
 * Handles: +60XX, 01X-XXX XXXX, 601XXXXXXX
 */
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}
