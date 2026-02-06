import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const srcInfoDir = path.join(root, "src", "info");
const rootWhatsNewPath = path.join(root, "whats-new.md");
const rootWhatsNewEnPath = path.join(root, "whats-new.en.md");
const appWhatsNewPath = path.join(srcInfoDir, "whatsNew.md");
const appWhatsNewEnPath = path.join(srcInfoDir, "whatsNew.en.md");
const buildDir = path.join(root, "build");
const releaseNotesPath = path.join(buildDir, "release-notes.md");
const releaseNotesEnPath = path.join(buildDir, "release-notes.en.md");
const pkgPath = path.join(root, "package.json");

function fail(message) {
  console.error(`[whats-new:build] ${message}`);
  process.exit(1);
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readVersionFromMarkdown(markdown = "") {
  const match = String(markdown).match(/version:\s*([0-9A-Za-z._-]+)/i);
  return match ? match[1] : null;
}

function stripVersionHtmlComment(markdown = "") {
  return String(markdown).replace(/^\s*<!--\s*version:.*?-->\s*\n?/i, "");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fail(`Directory not found: ${dirPath}`);
  }
}

function writeFileAtomic(filePath, content) {
  fs.writeFileSync(filePath, content, "utf-8");
}

function syncWhatsNew({ sourcePath, targetPath, releaseNotesTarget }) {
  const markdown = readFileSafe(sourcePath);
  if (!markdown) {
    return false;
  }

  const version = readVersionFromMarkdown(markdown);
  if (!version) {
    fail(`Unable to find version in ${sourcePath}`);
  }

  writeFileAtomic(targetPath, markdown);

  const releaseNotes = stripVersionHtmlComment(markdown);
  writeFileAtomic(releaseNotesTarget, releaseNotes);

  return true;
}

function main() {
  ensureDir(srcInfoDir);

  const rootMarkdown = readFileSafe(rootWhatsNewPath);
  if (!rootMarkdown) {
    fail(`Missing file: ${rootWhatsNewPath}`);
  }

  const pkg = JSON.parse(readFileSafe(pkgPath) || "{}");
  if (!pkg.version) {
    fail(`Unable to read version from ${pkgPath}`);
  }

  const rootVersion = readVersionFromMarkdown(rootMarkdown);
  if (!rootVersion) {
    fail(`Unable to find version in ${rootWhatsNewPath}`);
  }

  if (rootVersion !== pkg.version) {
    fail(
      `Version mismatch. whats-new.md=${rootVersion} package.json=${pkg.version}`,
    );
  }

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const synced = syncWhatsNew({
    sourcePath: rootWhatsNewPath,
    targetPath: appWhatsNewPath,
    releaseNotesTarget: releaseNotesPath,
  });

  if (!synced) {
    fail(`Failed to sync ${rootWhatsNewPath}`);
  }

  if (fs.existsSync(rootWhatsNewEnPath)) {
    syncWhatsNew({
      sourcePath: rootWhatsNewEnPath,
      targetPath: appWhatsNewEnPath,
      releaseNotesTarget: releaseNotesEnPath,
    });
  }

  console.log(
    `[whats-new:build] Synced whatsNew.md and generated release notes for version ${rootVersion}`,
  );
}

main();
