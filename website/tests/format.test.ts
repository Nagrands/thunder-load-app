import { describe, expect, it } from "vitest";
import { formatBytes, formatDate, stripVersionPrefix } from "@/lib/format";

describe("formatBytes", () => {
  it("scales values into binary units", () => {
    expect(formatBytes(512, "en")).toBe("512 B");
    expect(formatBytes(1024, "en")).toBe("1 KB");
    expect(formatBytes(1024 * 1024, "en")).toBe("1 MB");
    expect(formatBytes(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
    expect(formatBytes(2 * 1024 ** 3, "en")).toBe("2 GB");
  });

  it("localizes the numeric part", () => {
    expect(formatBytes(1.5 * 1024 * 1024, "ru")).toBe("1,5 MB");
  });

  it("returns a placeholder for missing or invalid sizes", () => {
    expect(formatBytes(0, "en")).toBe("—");
    expect(formatBytes(-1, "en")).toBe("—");
    expect(formatBytes(Number.NaN, "en")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a local date in the requested locale", () => {
    const value = new Date(2026, 6, 30);
    expect(formatDate(value, "en")).toBe("July 30, 2026");
    expect(formatDate(value, "ru")).toContain("2026");
    expect(formatDate(value, "ru")).toContain("30");
  });

  it("formats ISO date strings", () => {
    expect(formatDate("2026-07-30T10:00:00Z", "en")).toContain("2026");
  });
});

describe("stripVersionPrefix", () => {
  it("removes a leading version prefix", () => {
    expect(stripVersionPrefix("v2.0.0")).toBe("2.0.0");
    expect(stripVersionPrefix("V1.6.4")).toBe("1.6.4");
    expect(stripVersionPrefix("2.0.0")).toBe("2.0.0");
  });
});
