import type { Locale } from "@/config/site";

export function formatBytes(bytes: number, locale: Locale) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: index > 1 ? 1 : 0
  }).format(value)} ${units[index]}`;
}

export function formatDate(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

export function stripVersionPrefix(value: string) {
  return value.replace(/^v/i, "");
}
