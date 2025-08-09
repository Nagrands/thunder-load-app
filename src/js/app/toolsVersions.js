// src/js/app/toolsVersions.js
const { spawnSync } = require("node:child_process");
const path = require("path");
const fs = require("fs");

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

function getToolsVersions() {
  const binDir = path.join(process.resourcesPath, "bin");
  const ytName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const ffName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  const ytPath = path.join(binDir, ytName);
  const ffPath = path.join(binDir, ffName);

  return {
    ytDlp: fs.existsSync(ytPath)
      ? { ok: true, path: ytPath, version: runVersion(ytPath, ["--version"]) }
      : { ok: false },
    ffmpeg: fs.existsSync(ffPath)
      ? { ok: true, path: ffPath, version: runVersion(ffPath, ["-version"]) }
      : { ok: false },
  };
}

module.exports = { getToolsVersions };