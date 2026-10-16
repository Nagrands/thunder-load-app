import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getManifest } from "../src/pages/manifest.webmanifest.ts";
import { GET as getRobots } from "../src/pages/robots.txt.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots.txt endpoint", () => {
  it("points the sitemap at the site root under the project base", async () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");

    const response = getRobots({ site: new URL("https://nagrands.github.io") });
    const body = await response.text();

    expect(body).toContain("User-agent: *");
    expect(body).toContain("Sitemap: https://nagrands.github.io/thunder-load-app/sitemap-index.xml");
  });

  it("uses a root sitemap when deployed on a custom domain", async () => {
    vi.stubEnv("BASE_URL", "/");

    const response = getRobots({ site: new URL("https://thunder.example.com") });

    expect(await response.text()).toContain("Sitemap: https://thunder.example.com/sitemap-index.xml");
  });
});

describe("web app manifest endpoint", () => {
  it("scopes paths to the project base", async () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");

    const manifest = JSON.parse(await getManifest().text());

    expect(manifest.start_url).toBe("/thunder-load-app/ru/");
    expect(manifest.scope).toBe("/thunder-load-app/");
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/thunder-load-app/icons/app-icon-256.png",
      "/thunder-load-app/icons/app-icon-512.png"
    ]);
  });

  it("uses root-relative paths on a custom domain", async () => {
    vi.stubEnv("BASE_URL", "/");

    const manifest = JSON.parse(await getManifest().text());

    expect(manifest.start_url).toBe("/ru/");
    expect(manifest.scope).toBe("/");
  });
});
