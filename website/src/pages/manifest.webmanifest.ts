import { withBase } from "@/lib/urls";

export function GET() {
  const manifest = {
    name: "Thunder",
    short_name: "Thunder",
    description: "Official Thunder website and download center.",
    start_url: withBase("ru/"),
    scope: withBase(""),
    display: "standalone",
    background_color: "#050914",
    theme_color: "#050914",
    icons: [
      {
        src: withBase("icons/app-icon-256.png"),
        sizes: "256x256",
        type: "image/png"
      },
      {
        src: withBase("icons/app-icon-512.png"),
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json" }
  });
}
