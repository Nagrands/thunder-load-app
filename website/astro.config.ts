import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const repository = "thunder-load-app";
const site = process.env.SITE_URL ?? "https://nagrands.github.io";
const base = process.env.BASE_PATH ?? `/${repository}`;

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/404/"),
      i18n: {
        defaultLocale: "ru",
        locales: { ru: "ru-RU", en: "en-US" }
      }
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  image: {
    responsiveStyles: true,
    layout: "constrained"
  }
});
