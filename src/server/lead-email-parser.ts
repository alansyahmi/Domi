/**
 * Inbound lead email parser.
 *
 * Real estate portals (PropertyGuru, iProperty, EdgeProp, Realtor.com, Zillow)
 * notify agents of new enquiries by email. Agents forward those emails to their
 * unique Signatis ingestion address (`inbound+<id>@leads.signatis.app`). This
 * module turns a raw forwarded email into a structured lead.
 *
 * Pure and side-effect free so it can be unit tested without a mail server.
 */

export interface InboundEmail {
  /** Raw recipient header value — the ingestion address, possibly "Name <addr>". */
  to: string;
  /** Raw sender header value. */
  from: string;
  subject: string;
  /** Plain-text body, if the provider supplied one. */
  text?: string;
  /** HTML body, used as a fallback when `text` is absent. */
  html?: string;
}

export interface ParsedLead {
  name: string;
  email: string;
  phone: string;
  source: string;
  propertyInterest: string;
  budget: string;
  message: string;
}

/** Extract a bare email address from a header value like `"Jane Doe" <jane@x.com>`. */
export function extractEmailAddress(raw: string | undefined | null): string {
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  const candidate = angle ? angle[1] : raw;
  const match = candidate.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].trim().toLowerCase() : "";
}

/** Extract the display name from a header value, falling back to the address local-part. */
function extractDisplayName(raw: string | undefined | null): string {
  if (!raw) return "";
  const quoted = raw.match(/"([^"]+)"/);
  if (quoted) return quoted[1].trim();
  const beforeAngle = raw.match(/^([^<]+)</);
  if (beforeAngle) return beforeAngle[1].trim();
  return "";
}

/** Convert an HTML body to rough plain text for field extraction. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/tr|\/td|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Identify which portal a forwarded email originated from. */
export function detectSource(email: Pick<InboundEmail, "from" | "subject"> & { body: string }): string {
  const haystack = `${email.from} ${email.subject} ${email.body}`.toLowerCase();
  if (/propertyguru/.test(haystack)) return "PropertyGuru";
  if (/iproperty/.test(haystack)) return "iProperty";
  if (/edgeprop/.test(haystack)) return "EdgeProp";
  if (/realtor\.com/.test(haystack)) return "Realtor.com";
  if (/zillow/.test(haystack)) return "Zillow";
  if (/facebook|fb\.me|messenger/.test(haystack)) return "Facebook";
  return "Email Forward";
}

const MY_PHONE = /(\+?6?0\s?1\d[\s-]?\d{3,4}[\s-]?\d{3,4})/;
const GENERIC_PHONE = /(\+?\d[\d\s().-]{7,}\d)/;

/** Pull the first value following any of the given field labels, line-scoped. */
function fieldValue(body: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`^\\s*${label}\\s*[:\\-]\\s*(.+)$`, "im");
    const m = body.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
}

/**
 * Parse a forwarded portal email into a lead.
 *
 * Returns null when no usable contact signal (email or phone) can be found —
 * the caller should treat that as an unparseable email and skip lead creation.
 */
export function parseLeadEmail(email: InboundEmail): ParsedLead | null {
  const body = (email.text && email.text.trim() ? email.text : htmlToText(email.html ?? "")).trim();
  const source = detectSource({ from: email.from, subject: email.subject, body });

  // Contact email: a labelled value wins, else the first address in the body
  // that is not our own ingestion address.
  const ingestion = extractEmailAddress(email.to);
  let leadEmail = extractEmailAddress(fieldValue(body, ["email", "e-mail", "email address"]));
  if (!leadEmail) {
    const found = body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    leadEmail = found.map((e) => e.toLowerCase()).find((e) => e !== ingestion && !/no-?reply|notif|mailer|portal/.test(e)) ?? "";
  }

  // Phone: labelled value, else first phone-shaped token in the body.
  let phone = fieldValue(body, ["phone", "mobile", "tel", "telephone", "contact", "hp", "whatsapp"]);
  if (phone) phone = (phone.match(MY_PHONE) ?? phone.match(GENERIC_PHONE) ?? [phone])[0].trim();
  if (!phone) phone = (body.match(MY_PHONE) ?? body.match(GENERIC_PHONE) ?? [""])[0].trim();

  if (!leadEmail && !phone) return null;

  const name =
    fieldValue(body, ["name", "full name", "lead name", "from", "enquirer", "buyer"]) ||
    extractDisplayName(email.from) ||
    (leadEmail ? leadEmail.split("@")[0].replace(/[._]+/g, " ") : "Unknown Lead");

  const propertyInterest =
    fieldValue(body, ["property", "listing", "property of interest", "regarding", "re", "project", "address"]) ||
    email.subject.replace(/^(re|fwd?):\s*/i, "").replace(/new (enquiry|lead|inquiry)( for)?/i, "").trim() ||
    "General Enquiry";

  const budget = fieldValue(body, ["budget", "price range", "max budget", "financing"]) || "TBD";

  const message =
    fieldValue(body, ["message", "enquiry", "inquiry", "comment", "comments", "note", "remarks"]) ||
    body.slice(0, 500);

  return {
    name: name.slice(0, 120),
    email: leadEmail,
    phone: phone.slice(0, 40),
    source,
    propertyInterest: propertyInterest.slice(0, 160),
    budget: budget.slice(0, 60),
    message: message.slice(0, 1000),
  };
}
