import { describe, expect, it } from "vitest";
import { detectPlatform } from "@/lib/platform";

describe("detectPlatform", () => {
  it("detects supported desktop systems", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0)")).toBe("macos");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });

  it("returns unknown for an unrelated user agent", () => {
    expect(detectPlatform("ThunderBot/1.0")).toBe("unknown");
  });
});
