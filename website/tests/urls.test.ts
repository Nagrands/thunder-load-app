import { afterEach, describe, expect, it, vi } from "vitest";
import { localizedUrl, switchLocalePath, withBase } from "@/lib/urls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("withBase", () => {
  it("prefixes paths with the project base", () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");
    expect(withBase("favicon.svg")).toBe("/thunder-load-app/favicon.svg");
    expect(withBase("/og.png")).toBe("/thunder-load-app/og.png");
    expect(withBase("")).toBe("/thunder-load-app/");
  });

  it("keeps root-relative paths when deployed at the domain root", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(withBase("favicon.svg")).toBe("/favicon.svg");
    expect(withBase("")).toBe("/");
  });
});

describe("localizedUrl", () => {
  it("builds locale-prefixed paths with a trailing slash", () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");
    expect(localizedUrl("ru")).toBe("/thunder-load-app/ru/");
    expect(localizedUrl("en", "download")).toBe("/thunder-load-app/en/download/");
    expect(localizedUrl("en", "/blog/post/")).toBe("/thunder-load-app/en/blog/post/");
  });

  it("drops the project base on a custom domain", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(localizedUrl("ru", "docs")).toBe("/ru/docs/");
  });
});

describe("switchLocalePath", () => {
  it("replaces the locale segment and preserves the rest of the path", () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");
    expect(switchLocalePath("/thunder-load-app/ru/docs/player/", "en")).toBe(
      "/thunder-load-app/en/docs/player/"
    );
    expect(switchLocalePath("/thunder-load-app/en/", "ru")).toBe("/thunder-load-app/ru/");
  });

  it("works without a project base", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(switchLocalePath("/ru/blog/", "en")).toBe("/en/blog/");
  });

  it("leaves non-localized paths unchanged", () => {
    vi.stubEnv("BASE_URL", "/thunder-load-app/");
    expect(switchLocalePath("/thunder-load-app/404/", "en")).toBe("/thunder-load-app/404/");
  });
});
