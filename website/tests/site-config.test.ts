import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("../site.config.mjs");
}

const original = {
  SITE_URL: process.env.SITE_URL,
  BASE_PATH: process.env.BASE_PATH
};

afterEach(() => {
  restore("SITE_URL", original.SITE_URL);
  restore("BASE_PATH", original.BASE_PATH);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("site config", () => {
  it("falls back to the GitHub Pages defaults", async () => {
    delete process.env.SITE_URL;
    delete process.env.BASE_PATH;

    const config = await loadConfig();

    expect(config.site).toBe("https://nagrands.github.io");
    expect(config.base).toBe("/thunder-load-app");
    expect(config.basePath).toBe("/thunder-load-app");
  });

  it("honours SITE_URL and BASE_PATH overrides", async () => {
    process.env.SITE_URL = "https://thunder.example.com";
    process.env.BASE_PATH = "/";

    const config = await loadConfig();

    expect(config.site).toBe("https://thunder.example.com");
    expect(config.base).toBe("/");
    expect(config.basePath).toBe("");
  });

  it("normalises a trailing slash in BASE_PATH", async () => {
    process.env.BASE_PATH = "/app/";

    const config = await loadConfig();

    expect(config.base).toBe("/app/");
    expect(config.basePath).toBe("/app");
  });
});
