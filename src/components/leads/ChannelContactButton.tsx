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

  const sizeClasses = size === "sm"
    ? "px-2.5 py-1.5 text-xs gap-1.5"
    : "px-4 py-2 text-sm gap-2";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center font-semibold rounded-lg transition-colors bg-[#041627] text-white hover:bg-[#1a2b3c] ${sizeClasses}`}
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
