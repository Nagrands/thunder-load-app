// src/js/app/toolsVersions.js

const { spawn } = require("node:child_process");
const fs = require("fs");
const {
  getEffectiveToolsDir,
  resolveToolPath,
  getExecName,
} = require("./toolsPaths");

/**
 * Run a binary with args and return its first line of stdout (or null).
 */
function runVersion(cmd, args, timeoutMs = 2000) {
  return new Promise((resolve) => {
    let output = "";
    let resolved = false;
    let timer = null;
    let proc = null;
    const done = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    try {
      timer = setTimeout(() => {
        try {
          proc?.kill("SIGKILL");
        } catch {}
        done(null);
      }, timeoutMs);

      proc = spawn(cmd, args);
    } catch {
      if (timer) clearTimeout(timer);
      return done(null);
    }

    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.on("error", () => {
      if (timer) clearTimeout(timer);
      done(null);
    });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        const line = output.split("\n")[0].trim();
        done(line || null);
      } else {
        done(null);
      }
    });
  });
}

/**
 * Get current versions of yt-dlp, ffmpeg and deno from effective tools directory.
 * @param {any} store optional store/getter to resolve custom dir
 */
async function getToolsVersions(store) {
  const dir = getEffectiveToolsDir(store);
  const ytPath = resolveToolPath("yt-dlp", dir);
  const ffPath = resolveToolPath("ffmpeg", dir);
  const denoPath = resolveToolPath("deno", dir);

  const ytExists = fs.existsSync(ytPath);
  let yt = { ok: ytExists, path: ytPath };
  if (ytExists) {
    const ver = await runVersion(ytPath, ["--version"]);
    if (ver) yt.version = ver;
  }

  const ffExists = fs.existsSync(ffPath);
  let ff = { ok: ffExists, path: ffPath };
  if (ffExists) {
    const ver = await runVersion(ffPath, ["-version"]);
    if (ver) ff.version = ver;
  }

  const denoExists = fs.existsSync(denoPath);
  let deno = { ok: denoExists, path: denoPath };
  if (denoExists) {
    const ver = await runVersion(denoPath, ["--version"]);
    if (ver) deno.version = ver;
  }

  return { ytDlp: yt, ffmpeg: ff, deno };
}

module.exports = { getToolsVersions };
