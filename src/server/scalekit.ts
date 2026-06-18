import { decodeJwt } from "jose";
import { randomBytesBase64url, sha256Base64url } from "./crypto";

// ---------------------------------------------------------------------------
// Types — mirrors the subset of @scalekit-sdk/node types that we actually use
// ---------------------------------------------------------------------------

export interface ScalekitUser {
  id: string;
  username?: string;
  name: string;
  givenName: string;
  familyName?: string;
  email: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  profile?: string;
  picture?: string;
  gender?: string;
  birthDate?: string;
  zoneInfo?: string;
  locale?: string;
  updatedAt?: string;
  identities: ScalekitIdentity[];
  metadata?: string;
}

export interface ScalekitIdentity {
  connectionId: string;
  organizationId: string;
  connectionType: string;
  providerName: string;
  social: boolean;
  providerRawAttributes: string;
}

export interface AuthorizationUrlOptions {
  connectionId?: string;
  organizationId?: string;
  scopes?: string[];
  state?: string;
  nonce?: string;
  domainHint?: string;
  loginHint?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  provider?: string;
  prompt?: string;
}

export interface AuthenticationResponse {
  user: ScalekitUser;
  idToken: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface StatePayload {
  returnTo?: string;
  codeVerifier?: string;
}

// ---------------------------------------------------------------------------
// IdToken claim → User field mapping (identical to the SDK)
// ---------------------------------------------------------------------------

const IdTokenClaimToUserMap: Record<string, string> = {
  sub: "id",
  name: "name",
  preferred_username: "username",
  given_name: "givenName",
  family_name: "familyName",
  email: "email",
  email_verified: "emailVerified",
  phone_number: "phoneNumber",
  phone_number_verified: "phoneNumberVerified",
  profile: "profile",
  picture: "picture",
  gender: "gender",
  birthdate: "birthDate",
  zoneinfo: "zoneInfo",
  locale: "locale",
  updated_at: "updatedAt",
  identities: "identities",
  metadata: "metadata",
};

// ---------------------------------------------------------------------------
// Base64url helpers (no Node.js Buffer dependency)
// ---------------------------------------------------------------------------

function toBase64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): string {
  // Restore padding and convert to standard base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

/**
 * Convert a standard base64 string to base64url (URL-safe base64).
 *
 * Cloudflare Workers' node:crypto polyfill may not support the "base64url"
 * encoding for Buffer.toString() or Hash.digest(). We work around this by
 * using standard "base64" and converting afterward.
 */
export function base64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Generate a cryptographically random PKCE code verifier (base64url, 64 bytes → ~86 chars). */
export function generateCodeVerifier(): string {
  return randomBytesBase64url(64);
}

/** Compute the S256 PKCE code challenge from a verifier. */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  return sha256Base64url(verifier);
}

// ---------------------------------------------------------------------------
// State encoding / decoding (OAuth state parameter)
// ---------------------------------------------------------------------------

export function encodeState(returnTo: string, codeVerifier: string): string {
  return toBase64url(JSON.stringify({ returnTo, codeVerifier }));
}

export function decodeState(state: string | null): StatePayload {
  if (!state) return {};

  try {
    const parsed = JSON.parse(fromBase64url(state)) as StatePayload;
    return {
      returnTo: parsed.returnTo?.startsWith("/") ? parsed.returnTo : undefined,
      codeVerifier: parsed.codeVerifier,
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Authorization URL builder (replaces scalekit.getAuthorizationUrl)
// ---------------------------------------------------------------------------

/**
 * Build the Scalekit OAuth authorization URL.
 *
 * This is pure URL construction — no network calls. Equivalent to:
 *   new ScalekitClient(envUrl, clientId, clientSecret).getAuthorizationUrl(redirectUri, options)
 */
export function getAuthorizationUrl(
  envUrl: string,
  clientId: string,
  redirectUri: string,
  options: AuthorizationUrlOptions = {},
): string {
  const params = new URLSearchParams();

  params.set("response_type", "code");
  params.set("client_id", clientId);
  params.set("redirect_uri", redirectUri);
  params.set("scope", (options.scopes ?? ["openid", "profile", "email"]).join(" "));

  if (options.state) params.set("state", options.state);
  if (options.nonce) params.set("nonce", options.nonce);
  if (options.loginHint) params.set("login_hint", options.loginHint);
  if (options.domainHint) {
    params.set("domain_hint", options.domainHint);
    params.set("domain", options.domainHint);
  }
  if (options.connectionId) params.set("connection_id", options.connectionId);
  if (options.organizationId) params.set("organization_id", options.organizationId);
  if (options.codeChallenge) params.set("code_challenge", options.codeChallenge);
  if (options.codeChallengeMethod) params.set("code_challenge_method", options.codeChallengeMethod);
  if (options.provider) params.set("provider", options.provider);
  if (options.prompt) params.set("prompt", options.prompt);

  // Ensure no trailing slash before appending the endpoint path
  const base = envUrl.replace(/\/+$/, "");
  return `${base}/oauth/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange (replaces scalekit.authenticateWithCode)
// ---------------------------------------------------------------------------

/**
 * Exchange an authorization code for tokens + user info via a direct fetch() call.
 *
 * Equivalent to:
 *   new ScalekitClient(envUrl, clientId, clientSecret)
 *     .authenticateWithCode(code, redirectUri, { codeVerifier })
 *
 * Uses the Web fetch() API — compatible with Cloudflare Workers, browsers, and Node.js 18+.
 */
export async function authenticateWithCode(
  envUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<AuthenticationResponse> {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const base = envUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Scalekit-Workers/1.0",
      "X-Sdk-Version": "Scalekit-Workers/1.0",
      "X-Api-Version": "20260612",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      detail = errBody.slice(0, 500);
    } catch {
      // ignore
    }
    throw new Error(
      `Scalekit token exchange failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    id_token: string;
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };

  // Decode the ID token claims (no verification — the token came directly from
  // Scalekit over HTTPS; full JWT verification would need the JWKS).
  const claims = decodeJwt(data.id_token);

  // Map ID token claims to User fields (identical to the SDK's logic)
  const user: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(claims)) {
    const mappedKey = IdTokenClaimToUserMap[key];
    if (mappedKey) {
      user[mappedKey] = value;
    }
  }

  return {
    user: user as unknown as ScalekitUser,
    idToken: data.id_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
}
