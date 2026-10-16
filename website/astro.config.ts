import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { base, site } from "./site.config.mjs";

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
