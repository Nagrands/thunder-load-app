import { describe, expect, it } from "vitest";
import { classifyAsset, downloadableAssets, localizedReleaseNotes, normalizeReleases, preferredAsset, type GitHubRelease } from "@/lib/releases";

const baseRelease: GitHubRelease = {
  id: 1,
  tag_name: "v2.0.0",
  name: "2.0.0",
  html_url: "https://example.com/v2",
  draft: false,
  prerelease: false,
  published_at: "2026-07-30T10:00:00Z",
  body: null,
  assets: [],
};

describe("release assets", () => {
  it("classifies platform, architecture, and kind", () => {
    expect(classifyAsset("Thunder-2.0.0-arm64.dmg")).toEqual({
      platform: "macos",
      architecture: "arm64",
      kind: "installer",
    });
    expect(classifyAsset("Thunder-Setup-2.0.0.exe")).toEqual({
      platform: "windows",
      architecture: "unknown",
      kind: "installer",
    });
    expect(classifyAsset("checksums.txt").kind).toBe("signature");
  });

  it("merges duplicate release jobs and keeps the newest asset by name", () => {
    const releases = normalizeReleases([
      {
        ...baseRelease,
        id: 10,
        assets: [
          {
            id: 101,
            name: "Thunder-Setup-2.0.0.exe",
            content_type: "application/octet-stream",
            size: 10,
            updated_at: "2026-07-30T10:01:00Z",
            browser_download_url: "https://example.com/old.exe",
          },
        ],
      },
      {
        ...baseRelease,
        id: 11,
        published_at: "2026-07-30T10:02:00Z",
        assets: [
          {
            id: 102,
            name: "Thunder-Setup-2.0.0.exe",
            content_type: "application/octet-stream",
            size: 20,
            updated_at: "2026-07-30T10:03:00Z",
            browser_download_url: "https://example.com/new.exe",
          },
          {
            id: 103,
            name: "Thunder-2.0.0-arm64.dmg",
            content_type: "application/octet-stream",
            size: 30,
            updated_at: "2026-07-30T10:03:00Z",
            browser_download_url: "https://example.com/mac.dmg",
          },
        ],
      },
    ]);

    expect(releases).toHaveLength(1);
    expect(releases[0].assets).toHaveLength(2);
    expect(preferredAsset(releases[0], "windows")?.url).toBe("https://example.com/new.exe");
  });

  it("filters drafts but preserves prerelease metadata", () => {
    const releases = normalizeReleases([
      { ...baseRelease, id: 2, draft: true },
      { ...baseRelease, id: 3, tag_name: "v2.0.0-beta.1", prerelease: true },
    ]);
    expect(releases).toHaveLength(1);
    expect(releases[0].prerelease).toBe(true);
  });

  it("exposes only officially supported desktop installers", () => {
    const releases = normalizeReleases([
      {
        ...baseRelease,
        assets: [
          {
            id: 201,
            name: "Thunder-Setup-2.0.0.exe",
            content_type: "application/octet-stream",
            size: 20,
            updated_at: "2026-07-30T10:03:00Z",
            browser_download_url: "https://example.com/windows.exe",
          },
          {
            id: 202,
            name: "Thunder-2.0.0-x86_64.AppImage",
            content_type: "application/octet-stream",
            size: 30,
            updated_at: "2026-07-30T10:03:00Z",
            browser_download_url: "https://example.com/linux.AppImage",
          },
        ],
      },
    ]);

    expect(downloadableAssets(releases[0]).map((asset) => asset.platform)).toEqual(["windows"]);
  });
});

describe("localized release notes", () => {
  const bilingualBody = ["## Русский", "<!-- release-notes:ru -->", "Русские заметки", "<!-- /release-notes:ru -->", "## English", "<!-- release-notes:en -->", "English notes", "<!-- /release-notes:en -->"].join("\n");

  it("extracts the requested language from a bilingual body", () => {
    expect(localizedReleaseNotes(bilingualBody, "ru")).toBe("Русские заметки");
    expect(localizedReleaseNotes(bilingualBody, "en")).toBe("English notes");
  });

  it("keeps legacy release bodies unchanged", () => {
    expect(localizedReleaseNotes("# Legacy notes", "ru")).toBe("# Legacy notes");
  });

  it("returns no content for an empty or incomplete localized body", () => {
    expect(localizedReleaseNotes("", "en")).toBe("");
    expect(localizedReleaseNotes("<!-- release-notes:ru -->RU<!-- /release-notes:ru -->", "en")).toBe("");
  });
});
