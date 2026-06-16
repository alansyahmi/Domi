import type { Lead, PreferredChannel } from "../types";

/**
 * Returns a deep-link URL to contact a lead on their preferred channel.
 * Falls back to the lead's phone number when a specific channel link
 * cannot be constructed.
 */
export function getContactUrl(lead: Pick<Lead, "phone" | "email" | "preferredChannel">): string {
  switch (lead.preferredChannel) {
    case "whatsapp": {
      const digits = lead.phone.replace(/\D/g, "");
      const normalized = digits.startsWith("60") ? digits : digits.startsWith("0") ? `60${digits.slice(1)}` : `60${digits}`;
      return `https://wa.me/${normalized}`;
    }
    case "telegram":
      return `https://t.me/${lead.phone.replace(/\D/g, "")}`;
    case "messenger":
      return `https://m.me/${encodeURIComponent(lead.email.split("@")[0])}`;
    case "instagram":
      return `https://instagram.com/_u/${encodeURIComponent(lead.email.split("@")[0])}`;
    case "email":
      return `mailto:${lead.email}`;
    case "phone":
      return `tel:${lead.phone}`;
    default:
      return `tel:${lead.phone}`;
  }
}

/**
 * Human-readable label for a preferred channel value.
 */
export function channelLabel(channel: PreferredChannel): string {
  const labels: Record<PreferredChannel, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    messenger: "Facebook Messenger",
    instagram: "Instagram",
    email: "Email",
    phone: "Phone Call",
  };
  return labels[channel] ?? channel;
}

/**
 * All available channels with their labels, for use in select/radio UIs.
 */
export const CHANNEL_OPTIONS: { value: PreferredChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "messenger", label: "Facebook Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Call" },
];
