/**
 * In-memory OTP store with automatic expiry.
 *
 * OTPs are ephemeral (5-minute TTL) — no database needed.
 * Codes held in memory only; lost on server restart (acceptable for 5-min codes).
 */

interface OtpEntry {
  code: string;
  email: string;
  expiresAt: number; // epoch ms
  used: boolean;
}

const store = new Map<string, OtpEntry>();

// Sweep expired entries every 60 seconds
const SWEEP_INTERVAL_MS = 60_000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function startSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, SWEEP_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  if (typeof sweepTimer === "object" && sweepTimer?.unref) {
    sweepTimer.unref();
  }
}

/**
 * Generate a cryptographically random 6-digit OTP code.
 */
export function generateOtpCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const num = new DataView(buf.buffer).getUint32(0);
  return String(num % 1_000_000).padStart(6, "0");
}

/**
 * Store an OTP code with a 5-minute expiry.
 */
export function storeOtpCode(email: string, code: string): void {
  startSweeper();
  const key = `${email.toLowerCase().trim()}:${code}`;
  store.set(key, {
    code,
    email: email.toLowerCase().trim(),
    expiresAt: Date.now() + 5 * 60_000,
    used: false,
  });
}

/**
 * Verify an OTP code for a given email.
 * Returns true if valid and not expired; marks code as used on success.
 */
export function verifyOtpCode(email: string, code: string): boolean {
  const key = `${email.toLowerCase().trim()}:${code}`;
  const entry = store.get(key);
  if (!entry) return false;
  if (entry.used) return false;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return false;
  }
  // Mark as used (single-use code)
  entry.used = true;
  return true;
}
