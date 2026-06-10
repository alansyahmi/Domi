export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function sourceTone(source: string): string {
  if (source.toLowerCase().includes("facebook")) return "tag-blue";
  if (source.toLowerCase().includes("lowyat")) return "tag-violet";
  return "tag-muted";
}
