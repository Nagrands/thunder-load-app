import { withBase } from "@/lib/urls";

export function GET({ site }: { site?: URL }) {
  const sitemap = new URL(withBase("sitemap-index.xml"), site);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
