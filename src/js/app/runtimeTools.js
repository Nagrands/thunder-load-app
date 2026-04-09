// src/js/app/runtimeTools.js

const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");

const {
  getEffectiveToolsDir,
  getDefaultToolsDir,
  resolveToolPath,
} = require("./toolsPaths");

function getBinaryName(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function isExecutableFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    if (process.platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function resolveBinaryFromPath(name) {
  const envPath = String(process.env.PATH || "");
  if (!envPath) return "";

  const pathEntries = envPath.split(path.delimiter).filter(Boolean);
  const candidates =
    process.platform === "win32"
      ? (() => {
          const extList = String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
            .split(";")
            .filter(Boolean);
          const hasKnownExt = /\.[^./\\]+$/.test(name);
          if (hasKnownExt) return [name];
          return extList.map((ext) => `${name}${ext.toLowerCase()}`);
        })()
      : [name];

  for (const dir of pathEntries) {
    for (const candidate of candidates) {
      const candidatePath = path.join(dir, candidate);
      if (isExecutableFile(candidatePath)) return candidatePath;
    }
  }

  return "";
}

function resolveRuntimeBinaryCandidates(name, storeOrGetter) {
  const candidates = [];
  const seen = new Set();
  const push = (candidatePath, source) => {
    const normalized = String(candidatePath || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({
      path: normalized,
      source,
      executable: isExecutableFile(normalized),
    });
  };

  const preferredDir = getEffectiveToolsDir(storeOrGetter);
  const preferredPath =
    name === "ffprobe"
      ? path.join(preferredDir, getBinaryName(name))
      : resolveToolPath(name, preferredDir);
  push(preferredPath, "preferred");

  const fallbackDir = getDefaultToolsDir();
  const fallbackPath =
    name === "ffprobe"
      ? path.join(fallbackDir, getBinaryName(name))
      : resolveToolPath(name, fallbackDir);
  if (fallbackDir !== preferredDir) {
    push(fallbackPath, "default");
  }

  const pathResolved = resolveBinaryFromPath(getBinaryName(name));
  if (pathResolved) {
    push(pathResolved, "path");
  }

  return candidates;
}

function resolveRuntimeBinaryDetails(name, storeOrGetter) {
  const candidates = resolveRuntimeBinaryCandidates(name, storeOrGetter);
  const executableCandidate = candidates.find((candidate) => candidate.executable);
  if (executableCandidate) return executableCandidate;
  return (
    candidates[0] || {
      path: "",
      source: "preferred",
      executable: false,
    }
  );
}

function resolveRuntimeBinaryPath(name, storeOrGetter) {
  return resolveRuntimeBinaryDetails(name, storeOrGetter).path;
}

function resolveRuntimeFfmpegDir(storeOrGetter) {
  const preferredDir = getEffectiveToolsDir(storeOrGetter);
  const preferredFfmpeg = path.join(preferredDir, getBinaryName("ffmpeg"));
  const preferredFfprobe = path.join(preferredDir, getBinaryName("ffprobe"));
  if (isExecutableFile(preferredFfmpeg) && isExecutableFile(preferredFfprobe)) {
    return preferredDir;
  }

  const fallbackDir = getDefaultToolsDir();
  const fallbackFfmpeg = path.join(fallbackDir, getBinaryName("ffmpeg"));
  const fallbackFfprobe = path.join(fallbackDir, getBinaryName("ffprobe"));
  if (
    fallbackDir !== preferredDir &&
    isExecutableFile(fallbackFfmpeg) &&
    isExecutableFile(fallbackFfprobe)
  ) {
    return fallbackDir;
  }

  return preferredDir;
}

function getRuntimeFfmpegPath(storeOrGetter) {
  return resolveRuntimeBinaryPath("ffmpeg", storeOrGetter);
}

function getRuntimeFfprobePath(storeOrGetter) {
  return resolveRuntimeBinaryPath("ffprobe", storeOrGetter);
}

async function prepareBinaryForExecution(cmd) {
  if (process.platform === "win32" || !cmd || !fs.existsSync(cmd)) return;

  try {
    await fsPromises.access(cmd, fs.constants.X_OK);
  } catch {
    try {
      await fsPromises.chmod(cmd, 0o755);
    } catch {}
  }
}

module.exports = {
  getBinaryName,
  getRuntimeFfmpegPath,
  getRuntimeFfmpegDir: resolveRuntimeFfmpegDir,
  getRuntimeFfprobePath,
  isExecutableFile,
  prepareBinaryForExecution,
  resolveBinaryFromPath,
  resolveRuntimeBinaryCandidates,
  resolveRuntimeBinaryDetails,
  resolveRuntimeBinaryPath,
  resolveRuntimeFfmpegDir,
};
