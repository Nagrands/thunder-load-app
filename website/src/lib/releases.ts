import fallbackReleases from "@/data/releases.fallback.json";
import { SITE } from "@/config/site";
import whatsNewEn from "../../../whats-new.en.md?raw";
import whatsNewRu from "../../../whats-new.md?raw";

export type ReleasePlatform = "windows" | "macos" | "linux" | "other";
export type ReleaseArch = "x64" | "arm64" | "universal" | "unknown";

export interface GitHubAsset {
  id: number;
  name: string;
  content_type: string;
  size: number;
  digest?: string | null;
  updated_at: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  body: string | null;
  assets: GitHubAsset[];
}

export interface ReleaseAsset {
  id: number;
  name: string;
  url: string;
  size: number;
  contentType: string;
  updatedAt: string;
  platform: ReleasePlatform;
  architecture: ReleaseArch;
  kind: "installer" | "archive" | "metadata" | "signature";
  digest?: string;
}

export interface Release {
  id: number;
  tag: string;
  version: string;
  title: string;
  url: string;
  publishedAt: string;
  body: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

let releasesPromise: Promise<Release[]> | undefined;

const INSTALLER_EXTENSIONS = /\.(exe|dmg|appimage|msi|pkg)$/i;
const ARCHIVE_EXTENSIONS = /\.(zip|tar\.gz)$/i;
const METADATA_EXTENSIONS = /\.(ya?ml|blockmap)$/i;
const SIGNATURE_EXTENSIONS = /(\.(sig|asc|sha256|sha256sum)|checksums?\.txt)$/i;
const RELEASE_NOTES_MARKER = /<!--\s*release-notes:(ru|en)\s*-->/i;

function releaseNotesVersion(markdown: string) {
  return markdown.match(/<!--\s*version:\s*([0-9A-Za-z._-]+)\s*-->/i)?.[1] ?? "";
}

function prepareReleaseNotes(markdown: string) {
  return markdown
    .replace(/^\s*<!--\s*version:.*?-->\s*\n?/i, "")
    .replace(/^#\s+/m, "### ")
    .trim();
}

function bundledReleaseNotes() {
  const ruVersion = releaseNotesVersion(whatsNewRu);
  const enVersion = releaseNotesVersion(whatsNewEn);
  if (!ruVersion || ruVersion !== enVersion) return { tag: "", body: "" };
  return {
    tag: `v${ruVersion}`,
    body: ["## Русский", "<!-- release-notes:ru -->", prepareReleaseNotes(whatsNewRu), "<!-- /release-notes:ru -->", "", "## English", "<!-- release-notes:en -->", prepareReleaseNotes(whatsNewEn), "<!-- /release-notes:en -->"].join("\n"),
  };
}

function withBundledReleaseNotes(source: GitHubRelease[]) {
  const notes = bundledReleaseNotes();
  return source.map((release) => (release.tag_name === notes.tag && !release.body ? { ...release, body: notes.body } : release));
}

export function localizedReleaseNotes(body: string, locale: "ru" | "en") {
  const source = String(body || "");
  const match = source.match(new RegExp(`<!--\\s*release-notes:${locale}\\s*-->([\\s\\S]*?)<!--\\s*\\/release-notes:${locale}\\s*-->`, "i"));
  if (match) return match[1].trim();
  return RELEASE_NOTES_MARKER.test(source) ? "" : source.trim();
}

export function classifyAsset(name: string): Pick<ReleaseAsset, "platform" | "architecture" | "kind"> {
  const lower = name.toLowerCase();
  const platform: ReleasePlatform = lower.endsWith(".exe") || lower.endsWith(".msi") ? "windows" : lower.endsWith(".dmg") || lower.endsWith(".pkg") ? "macos" : lower.endsWith(".appimage") ? "linux" : "other";
  const architecture: ReleaseArch = lower.includes("arm64") || lower.includes("aarch64") ? "arm64" : lower.includes("x64") || lower.includes("x86_64") ? "x64" : lower.includes("universal") ? "universal" : "unknown";
  const kind = SIGNATURE_EXTENSIONS.test(lower) ? "signature" : INSTALLER_EXTENSIONS.test(lower) ? "installer" : ARCHIVE_EXTENSIONS.test(lower) ? "archive" : METADATA_EXTENSIONS.test(lower) ? "metadata" : "metadata";
  return { platform, architecture, kind };
}

export function normalizeReleases(source: GitHubRelease[]): Release[] {
  const merged = new Map<string, GitHubRelease>();
  for (const release of source.filter((item) => !item.draft && item.published_at)) {
    const current = merged.get(release.tag_name);
    if (!current) {
      merged.set(release.tag_name, { ...release, assets: [...release.assets] });
      continue;
    }
    const assets = new Map<string, GitHubAsset>();
    for (const asset of [...current.assets, ...release.assets]) {
      const existing = assets.get(asset.name);
      if (!existing || new Date(asset.updated_at) > new Date(existing.updated_at)) {
        assets.set(asset.name, asset);
      }
    }
    const newer = new Date(release.published_at ?? 0) > new Date(current.published_at ?? 0) ? release : current;
    merged.set(release.tag_name, {
      ...current,
      ...newer,
      body: current.body || release.body,
      assets: [...assets.values()],
    });
  }

  return [...merged.values()]
    .map((release) => ({
      id: release.id,
      tag: release.tag_name,
      version: release.tag_name.replace(/^v/i, ""),
      title: release.name || release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at!,
      body: release.body || "",
      prerelease: release.prerelease,
      assets: release.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        url: asset.browser_download_url,
        size: asset.size,
        contentType: asset.content_type,
        updatedAt: asset.updated_at,
        digest: asset.digest?.startsWith("sha256:") ? asset.digest.slice(7) : undefined,
        ...classifyAsset(asset.name),
      })),
    }))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

async function fetchReleases(): Promise<Release[]> {
  if (import.meta.env.MODE === "test") {
    return normalizeReleases(withBundledReleaseNotes(fallbackReleases as GitHubRelease[]));
  }

  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(SITE.releasesApi, { headers });
    if (!response.ok) throw new Error(`GitHub Releases responded with ${response.status}`);
    return normalizeReleases((await response.json()) as GitHubRelease[]);
  } catch (error) {
    console.warn("Using bundled release fallback:", error);
    return normalizeReleases(withBundledReleaseNotes(fallbackReleases as GitHubRelease[]));
  }
}

export function getReleases(): Promise<Release[]> {
  releasesPromise ??= fetchReleases();
  return releasesPromise;
}

export function downloadableAssets(release: Release) {
  return release.assets.filter((asset) => asset.kind === "installer" && (asset.platform === "windows" || asset.platform === "macos"));
}

export function preferredAsset(release: Release, platform: ReleasePlatform, arch?: ReleaseArch) {
  const assets = downloadableAssets(release).filter((asset) => asset.platform === platform);
  if (arch) return assets.find((asset) => asset.architecture === arch) ?? assets[0];
  return assets[0];
}
