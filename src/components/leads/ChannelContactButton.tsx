import { getContactUrl, channelLabel } from "../../domain/channels";
import type { Lead } from "../../types";
import { MessageCircle, Send, MessageSquare, Camera, Mail, Phone } from "lucide-react";

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle size={16} />,
  telegram: <Send size={16} />,
  messenger: <MessageSquare size={16} />,
  instagram: <Camera size={16} />,
  email: <Mail size={16} />,
  phone: <Phone size={16} />,
};

export function ChannelContactButton({ lead, size = "md" }: { lead: Pick<Lead, "phone" | "email" | "preferredChannel">; size?: "sm" | "md" }) {
  const url = getContactUrl(lead);
  const label = channelLabel(lead.preferredChannel);
  const icon = channelIcons[lead.preferredChannel] ?? <MessageCircle size={16} />;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`primary-button ${size === "sm" ? "btn-sm" : ""}`}
      title={`Contact via ${label}`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const icon = channelIcons[channel] ?? <MessageCircle size={14} />;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
      {icon}
      {channelLabel(channel as Lead["preferredChannel"])}
    </span>
  );
}
