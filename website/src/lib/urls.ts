import type { Locale } from "@/config/site";

export function withBase(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalized = path.replace(/^\/+/, "");
  return `${base}/${normalized}`;
}

export function localizedUrl(locale: Locale, path = "") {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return withBase(`${locale}/${normalized}${normalized ? "/" : ""}`);
}

export function switchLocalePath(pathname: string, locale: Locale) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const replaced = relative.replace(/^\/(ru|en)(?=\/|$)/, `/${locale}`);
  return `${base}${replaced || `/${locale}/`}`;
}
