import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const commonSchema = z.object({
  title: z.string(),
  description: z.string(),
  locale: z.enum(["ru", "en"]),
  order: z.number().int().nonnegative().default(0),
  draft: z.boolean().default(false),
  updatedAt: z.coerce.date().optional()
});

const docs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
  schema: commonSchema.extend({
    section: z.enum([
      "getting-started",
      "downloader",
      "player",
      "tools",
      "settings",
      "support"
    ])
  })
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: commonSchema.extend({
    publishedAt: z.coerce.date(),
    category: z.enum(["release", "guide", "tip"]),
    image: z.string().optional()
  })
});

export const collections = { docs, blog };
