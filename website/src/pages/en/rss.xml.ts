import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { contentSlug } from "@/i18n";

export async function GET(context: { site?: URL }) {
  const posts = (await getCollection("blog", ({ data }) => data.locale === "en" && !data.draft))
    .sort((a, b) => +b.data.publishedAt - +a.data.publishedAt);
  return rss({
    title: "Thunder blog",
    description: "Thunder news, guides, and practical tips.",
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/thunder-load-app/en/blog/${contentSlug(post.id)}/`
    }))
  });
}
