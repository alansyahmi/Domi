// Web Crypto wrappers — replaces node:crypto usage for Cloudflare Workers compatibility.
//
// All functions use the standard Web Crypto API (crypto.subtle, crypto.getRandomValues)
// which is available in Cloudflare Workers, browsers, and Node.js 19+.
//
// base64url encoding is used throughout (no "=" padding, "-" instead of "+",
// "_" instead of "/") — matching the existing Scalekit/CSRF conventions.

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a base64url string (no padding).
 *
 * This goes through a binary string → btoa → replace chars, which is the
 * most portable approach across Workers, browsers, and Node.js.
 */
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert a base64url string back to a Uint8Array.
 */
function base64urlToUint8Array(input: string): Uint8Array {
  // Restore standard base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate cryptographically random bytes, returned as a base64url string.
 *
 * Synchronous — `crypto.getRandomValues()` is synchronous in all environments.
 *
 * Replaces: `base64ToBase64url(randomBytes(N).toString("base64"))`
 */
export function randomBytesBase64url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return uint8ArrayToBase64url(bytes);
}

/**
 * Compute SHA-256 hash of the input string, returned as a base64url string.
 *
 * Async — `crypto.subtle.digest()` is always async.
 *
 * Replaces: `base64ToBase64url(createHash("sha256").update(input).digest("base64"))`
 */
export async function sha256Base64url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return uint8ArrayToBase64url(new Uint8Array(hash));
}

/**
 * Compute HMAC-SHA256 of `data` using `key`, returned as a base64url string.
 *
 * Async — `crypto.subtle.sign()` is always async.
 *
 * Replaces: `base64ToBase64url(createHmac("sha256", key).update(data).digest("base64"))`
 */
export async function hmacSha256Base64url(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  return uint8ArrayToBase64url(new Uint8Array(signature));
}

/**
 * Constant-time string comparison.
 *
 * Operates on base64url-encoded strings directly — both inputs are treated as
 * ASCII strings and compared byte-by-byte via Uint8Array.
 *
 * Replaces: `Buffer.from(a)` + `Buffer.from(b)` + `timingSafeEqual(a, b)`
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);

  if (bytesA.length !== bytesB.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < bytesA.length; i++) {
    result |= bytesA[i] ^ bytesB[i];
  }
  return result === 0;
}

// Re-export the internal helpers for testing
export { uint8ArrayToBase64url, base64urlToUint8Array };
