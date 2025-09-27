// src/js/app/toolsVersions.js

const { spawnSync } = require("node:child_process");
const fs = require("fs");
const {
  getEffectiveToolsDir,
  resolveToolPath,
  getExecName,
} = require("./toolsPaths");

/**
 * Run a binary with args and return its first line of stdout (or null).
 */
function runVersion(cmd, args) {
  try {
    const res = spawnSync(cmd, args, { encoding: "utf8" });
    if (res.error) throw res.error;
    if (res.status !== 0) return null;
    return res.stdout.split("\n")[0].trim();
  } catch {
    return null;
  }
}

/**
 * Get current versions of yt-dlp and ffmpeg from effective tools directory.
 * @param {any} store optional store/getter to resolve custom dir
 */
function getToolsVersions(store) {
  const dir = getEffectiveToolsDir(store);
  const ytPath = resolveToolPath("yt-dlp", dir);
  const ffPath = resolveToolPath("ffmpeg", dir);

  let yt = { ok: false };
  if (fs.existsSync(ytPath)) {
    const ver = runVersion(ytPath, ["--version"]);
    yt = ver ? { ok: true, path: ytPath, version: ver } : { ok: false, path: ytPath };
  }

  let ff = { ok: false };
  if (fs.existsSync(ffPath)) {
    const ver = runVersion(ffPath, ["-version"]);
    ff = ver ? { ok: true, path: ffPath, version: ver } : { ok: false, path: ffPath };
  }

  return { ytDlp: yt, ffmpeg: ff };
}

module.exports = { getToolsVersions };
