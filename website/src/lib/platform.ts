export type DetectedPlatform = "windows" | "macos" | "linux" | "unknown";

export function detectPlatform(userAgent: string, platform = ""): DetectedPlatform {
  const source = `${userAgent} ${platform}`.toLowerCase();
  if (source.includes("windows") || source.includes("win32")) return "windows";
  if (source.includes("macintosh") || source.includes("mac os") || source.includes("macintel")) {
    return "macos";
  }
  if (source.includes("linux") || source.includes("x11")) return "linux";
  return "unknown";
}
