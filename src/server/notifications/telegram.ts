const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<TelegramMessageResult> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      const err = data as { description?: string };
      return { success: false, error: err?.description ?? `HTTP ${response.status}` };
    }

    const ok = data as { result?: { message_id?: number } };
    return { success: true, messageId: ok?.result?.message_id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function verifyTelegramToken(
  botToken: string,
): Promise<{ valid: boolean; botName?: string; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getMe`);
    const data: unknown = await response.json();

    if (!response.ok) {
      const err = data as { description?: string };
      return { valid: false, error: err?.description ?? `HTTP ${response.status}` };
    }

    const ok = data as { result?: { username?: string; first_name?: string } };
    return { valid: true, botName: ok?.result?.username ?? ok?.result?.first_name };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
