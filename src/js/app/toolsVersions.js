// src/js/app/toolsVersions.js

const { spawn } = require("node:child_process");
const fs = require("fs");
const {
  prepareBinaryForExecution,
  resolveRuntimeBinaryDetails,
} = require("./runtimeTools");

/**
 * Run a binary with args and return its first line of stdout (or null).
 */
function runVersion(cmd, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let output = "";
    let stderr = "";
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

      proc = spawn(cmd, args, {
        env: { ...process.env },
        windowsHide: true,
      });
    } catch {
      if (timer) clearTimeout(timer);
      return done(null);
    }

    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", () => {
      if (timer) clearTimeout(timer);
      done(null);
    });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        const line = `${output}\n${stderr}`
          .split("\n")
          .map((entry) => entry.trim())
          .find(Boolean);
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
  const ytDetails = resolveRuntimeBinaryDetails("yt-dlp", store);
  const ffDetails = resolveRuntimeBinaryDetails("ffmpeg", store);
  const denoDetails = resolveRuntimeBinaryDetails("deno", store);
  const ytPath = ytDetails.path;
  const ffPath = ffDetails.path;
  const denoPath = denoDetails.path;

  const ytExists = !!ytPath && fs.existsSync(ytPath);
  const yt = { ok: ytExists && ytDetails.executable, path: ytPath };
  if (yt.ok) {
    await prepareBinaryForExecution(ytPath);
    const ver = await runVersion(ytPath, ["--version"]);
    if (ver) yt.version = ver;
  }

  const ffExists = !!ffPath && fs.existsSync(ffPath);
  const ff = { ok: ffExists && ffDetails.executable, path: ffPath };
  if (ff.ok) {
    await prepareBinaryForExecution(ffPath);
    const ver = await runVersion(ffPath, ["-version"]);
    if (ver) ff.version = ver;
  }

  const denoExists = !!denoPath && fs.existsSync(denoPath);
  const deno = { ok: denoExists && denoDetails.executable, path: denoPath };
  if (deno.ok) {
    await prepareBinaryForExecution(denoPath);
    const ver = await runVersion(denoPath, ["--version"]);
    if (ver) deno.version = ver;
  }

  return { ytDlp: yt, ffmpeg: ff, deno };
}

module.exports = { getToolsVersions };
