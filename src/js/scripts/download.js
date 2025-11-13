/**
 * @file download.js
 * @description
 * Utility script for managing external tools (yt-dlp, ffmpeg) and handling
 * video/audio downloads in the Thunder Load application.
 *
 * Responsibilities:
 *  - Detects and installs required dependencies (yt-dlp, ffmpeg, ffprobe)
 *  - Provides version checks for tools
 *  - Downloads binaries from remote URLs with redirect and cancellation support
 *  - Retrieves video information via yt-dlp (`-J` JSON mode)
 *  - Selects best matching formats for given quality (Audio Only, Source, FHD, HD, SD)
 *  - Manages download processes (video, audio, muxed) with progress tracking
 *  - Merges video/audio streams using ffmpeg when required
 *  - Supports cancellation and cleanup of active downloads and temporary files
 *  - Exposes functions for dependency installation, download control, and progress reporting
 *
 * Exports:
 *  - installYtDlp
 *  - installFfmpeg
 *  - getVideoInfo
 *  - downloadMedia
 *  - stopDownload
 *  - resetDownloadCancelledFlag
 *  - selectFormatsByQuality
 *  - isDownloadCancelled
 *  - ensureAllDependencies
 */

// src/js/scripts/download.js

const { spawn } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const treeKill = require("tree-kill");
const log = require("electron-log");

const {
  getEffectiveToolsDir,
  getDefaultToolsDir,
  ensureToolsDir,
  resolveToolPath,
} = require("../app/toolsPaths");
const ElectronStore = require("electron-store").default;

// Динамические пути к инструментам — читаем текущее значение из electron-store каждый раз

let sharedStore = null;

function setSharedStore(store) {
  sharedStore = store;
}

function getStore() {
  return sharedStore;
}

function getToolsDir() {
  return getEffectiveToolsDir(getStore());
}
function getYtDlpPath() {
  return resolveToolPath("yt-dlp", getToolsDir());
}
function getFfmpegPath() {
  return resolveToolPath("ffmpeg", getToolsDir());
}
function getFfprobePath() {
  const dir = getToolsDir();
  return path.join(
    dir,
    process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
  );
}
function getDenoPath() {
  return resolveToolPath("deno", getToolsDir());
}

function ensureDenoCacheDir() {
  const cacheDir = path.join(getToolsDir(), "deno-cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function appendToolsDirToPath(currentPath = "") {
  const toolsDir = getToolsDir();
  const parts = currentPath.split(path.delimiter).filter(Boolean);
  if (!parts.includes(toolsDir)) {
    parts.unshift(toolsDir);
  }
  return parts.join(path.delimiter);
}

function getYtDlpEnvironment() {
  const env = { ...process.env };
  env.PATH = appendToolsDirToPath(env.PATH || "");
  const denoPath = getDenoPath();
  if (fs.existsSync(denoPath)) {
    try {
      env.DENO_DIR = ensureDenoCacheDir();
    } catch (err) {
      log.warn("Failed to prepare DENO_DIR:", err.message);
    }
  }
  return env;
}

function getYtDlpSpawnOptions() {
  return {
    env: getYtDlpEnvironment(),
    windowsHide: true,
  };
}

// Качество скачивания
const QUALITY_AUDIO_ONLY = "Audio Only";
const QUALITY_SOURCE = "Source";
const QUALITY_FHD = "FHD 1080p";
const QUALITY_HD = "HD 720p";
const QUALITY_SD = "SD 360p";

const PREFERRED_AUDIO_LANGS = [
  "ru",
  "ru-ru",
  "rus",
  "russian",
  "рус",
  "русский",
];

// Флаги и состояние процессов
let isDownloadCancelled = false;
let currentDownloadPath = null;

const activeProcesses = {
  getVideoInfo: null,
  videoDownload: null,
  audioDownload: null,
  merge: null,
};
const abortControllers = new Map();
const videoInfoCache = new Map(); // url -> { timestamp, data }
const VIDEO_INFO_CACHE_TTL = 60 * 1000; // 1 минута
const videoInfoInFlight = new Map(); // url -> Promise

function fetchJson(url, options = {}) {
  const { timeout = 10000 } = options;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        return reject(
          new Error(
            `Failed to fetch ${url}. Status code: ${statusCode}`,
          ),
        );
      }
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          resolve(data);
        } catch (err) {
          reject(
            new Error(
              `Failed to parse JSON from ${url}: ${err.message}`,
            ),
          );
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out after ${timeout}ms`));
    });
  });
}

/**
 * Запускает дочерний процесс и возвращает его вывод.
 */
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let output = "";
    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => log.error(data.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Process ${cmd} exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

/**
 * Парсит строку прогресса вида "[download] 45.3%" или "[download] 45%"
 */
function parseProgress(line) {
  // ловим как целые, так и дробные проценты: 45% или 45.3%
  const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Загружает файл по URL с поддержкой редиректов и возможности отмены.
 */
function downloadFile(url, dest, redirects = 0) {
  const MAX_REDIRECTS = 10;
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      return reject(new Error("Too many redirects"));
    }
    const controller = new AbortController();
    const { signal } = controller;
    // ключ — конечный путь файла, чтобы проще отменять по назначению
    abortControllers.set(dest, controller);

    const cleanup = (err) => {
      abortControllers.delete(dest);
      if (err) {
        try {
          fs.unlinkSync(dest);
        } catch (_) {}
      }
    };

    https
      .get(url, { signal }, (response) => {
        // handle redirect
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          const redirectUrl = new URL(
            response.headers.location,
            url,
          ).toString();
          // перенаправляем, используя тот же dest
          cleanup(); // текущий запрос завершён
          downloadFile(redirectUrl, dest, redirects + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(dest);
          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close(() => {
              cleanup();
              resolve();
            });
          });

          fileStream.on("error", (err) => {
            fileStream.destroy();
            cleanup(err);
            reject(err);
          });
        } else {
          const err = new Error(
            `Failed to download file. Status code: ${response.statusCode}`,
          );
          cleanup(err);
          reject(err);
        }
      })
      .on("error", (err) => {
        cleanup(err);
        reject(new Error(`Download error: ${err.message}`));
      });
  });
}

/**
 * Выбирает форматы в зависимости от желаемого качества.
 * Всегда возвращает videoExt и audioExt (если есть).
 */
function selectFormatsByQuality(formats, desiredQuality) {
  const pickBest = (arr, cmp) => (arr.length ? arr.sort(cmp)[0] : null);

  const normalizeLang = (val) =>
    typeof val === "string"
      ? val.toLowerCase()
      : String(val || "").toLowerCase();

  const getAudioLangScore = (format) => {
    const candidates = [
      format?.language,
      format?.language_preference,
      format?.languagePreference,
      format?.lang,
      format?.format_note,
    ];
    for (const value of candidates) {
      const normalized = normalizeLang(value);
      if (!normalized) continue;
      if (PREFERRED_AUDIO_LANGS.some((code) => normalized.includes(code)))
        return 0;
    }
    return 1;
  };

  const compareAudioFormats = (a, b) => {
    const langDiff = getAudioLangScore(a) - getAudioLangScore(b);
    if (langDiff !== 0) return langDiff;
    const abrA = a?.abr || a?.tbr || 0;
    const abrB = b?.abr || b?.tbr || 0;
    if (abrB !== abrA) return abrB - abrA;
    return (b.filesize || 0) - (a.filesize || 0);
  };

  const onlyAudio = formats.filter(
    (f) => f.acodec !== "none" && f.vcodec === "none",
  );
  const onlyVideo = formats.filter(
    (f) => f.vcodec !== "none" && f.acodec === "none",
  );
  const muxed = formats.filter(
    (f) => f.vcodec !== "none" && f.acodec !== "none",
  );

  // AUDIO ONLY
  if (desiredQuality === QUALITY_AUDIO_ONLY) {
    let audio = pickBest(onlyAudio, compareAudioFormats);
    // если чистого аудио нет — берём лучший muxed и качаем как есть
    if (!audio) {
      const m = pickBest(
        muxed,
        (a, b) => (b.abr || 0) - (a.abr || 0) || (b.tbr || 0) - (a.tbr || 0),
      );
      if (!m) throw new Error("No audio or muxed formats found");
      return {
        videoFormat: m.format_id,
        audioFormat: null,
        resolution: "audio (muxed)",
        fps: m.fps || null,
        videoExt: m.ext || null,
        audioExt: null,
        isMuxed: true,
      };
    }
    return {
      videoFormat: null,
      audioFormat: audio.format_id,
      resolution: "audio only",
      fps: null,
      videoExt: null,
      audioExt: audio.ext || "m4a",
      isMuxed: false,
    };
  }

  // SOURCE (максимально возможное)
  if (desiredQuality === QUALITY_SOURCE) {
    if (onlyVideo.length && onlyAudio.length) {
      const v = pickBest(
        onlyVideo,
        (a, b) =>
          (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0),
      );
      const a = pickBest(onlyAudio, compareAudioFormats);
      if (!v || !a)
        throw new Error("Suitable formats for source quality not found.");
      return {
        videoFormat: v.format_id,
        audioFormat: a.format_id,
        resolution: v.width && v.height ? `${v.width}x${v.height}` : "unknown",
        fps: v.fps || null,
        videoExt: v.ext || "mp4",
        audioExt: a.ext || "m4a",
        isMuxed: false,
      };
    }
    const m = pickBest(
      muxed,
      (a, b) =>
        (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0),
    );
    if (!m)
      throw new Error("No suitable muxed format found for source quality.");
    return {
      videoFormat: m.format_id,
      audioFormat: null,
      resolution: m.width && m.height ? `${m.width}x${m.height}` : "unknown",
      fps: m.fps || null,
      videoExt: m.ext || "mp4",
      audioExt: null,
      isMuxed: true,
    };
  }

  // Остальные качества
  const qualityMap = {
    [QUALITY_FHD]: 1080,
    [QUALITY_HD]: 720,
    [QUALITY_SD]: 360,
  };
  const target = qualityMap[desiredQuality];
  if (!target) throw new Error(`Invalid quality: ${desiredQuality}`);

  // 1) точное совпадение высоты среди onlyVideo
  let candidates = onlyVideo.filter((f) => f.height === target);
  // 2) иначе — наибольшая высота <= target
  if (!candidates.length) {
    const lower = onlyVideo.filter((f) => (f.height || 0) <= target);
    if (lower.length) {
      candidates = [
        pickBest(
          lower,
          (a, b) =>
            (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0),
        ),
      ];
    }
  }
  // 3) иначе — ближайшая выше
  if (!candidates.length) {
    const higher = onlyVideo.filter((f) => (f.height || 0) > target);
    if (higher.length) {
      candidates = [
        pickBest(
          higher,
          (a, b) =>
            (a.height || 0) - (b.height || 0) || (a.tbr || 0) - (b.tbr || 0),
        ),
      ];
    }
  }

  let video = candidates.length ? candidates[0] : null;
  let audio = null;

  if (video) {
    audio = pickBest(onlyAudio, compareAudioFormats);
    if (!audio) {
      // нет отдельного аудио — попробуем подходящий muxed не выше target
      const m = pickBest(
        muxed.filter((f) => (f.height || 0) <= (video.height || target)),
        (a, b) =>
          (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0),
      );
      if (m) {
        return {
          videoFormat: m.format_id,
          audioFormat: null,
          resolution:
            m.width && m.height ? `${m.width}x${m.height}` : "unknown",
          fps: m.fps || null,
          videoExt: m.ext || "mp4",
          audioExt: null,
          isMuxed: true,
        };
      }
      throw new Error(`No available audio format for ${desiredQuality}`);
    }
    return {
      videoFormat: video.format_id,
      audioFormat: audio.format_id,
      resolution:
        video.width && video.height
          ? `${video.width}x${video.height}`
          : "unknown",
      fps: video.fps || null,
      videoExt: video.ext || "mp4",
      audioExt: audio.ext || "m4a",
      isMuxed: false,
    };
  } else {
    // нет отдельного видео — возьмём лучший muxed не выше target
    const m = pickBest(
      muxed.filter((f) => (f.height || 0) <= target),
      (a, b) =>
        (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0),
    );
    if (!m)
      throw new Error(
        `No available video formats for quality ${desiredQuality} or lower`,
      );
    return {
      videoFormat: m.format_id,
      audioFormat: null,
      resolution: m.width && m.height ? `${m.width}x${m.height}` : "unknown",
      fps: m.fps || null,
      videoExt: m.ext || "mp4",
      audioExt: null,
      isMuxed: true,
    };
  }
}

/**
 * Получает версию yt-dlp.
 */
async function getYtDlpVersion() {
  const ytDlpPath = getYtDlpPath();
  if (!fs.existsSync(ytDlpPath)) {
    log.warn("yt-dlp binary not found at path:", ytDlpPath);
    return null;
  }
  try {
    const version = await runProcess(ytDlpPath, ["--version"]);
    log.info("yt-dlp version detected:", version);
    return version;
  } catch (err) {
    log.error("Failed to run yt-dlp --version:", err.message);
    return null;
  }
}

/**
 * Устанавливает yt-dlp, если его нет.
 */
async function installYtDlp() {
  try {
    const version = await getYtDlpVersion();
    if (version) {
      log.info(`yt-dlp version ${version} is already installed.`);
      return;
    }
    log.info("Downloading yt-dlp...");
    const ytDlpUrl =
      process.platform === "win32"
        ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        : process.platform === "darwin"
          ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
          : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    const MIN_EXPECTED_SIZE = 1_000_000; // минимальный размер 1 МБ

    const dir = getToolsDir();
    const ytDlpPath = getYtDlpPath();
    await ensureToolsDir(dir);
    await downloadFile(ytDlpUrl, ytDlpPath);

    // Устанавливаем права доступа
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(ytDlpPath, 0o755);
        log.info(`Set executable permissions for yt-dlp: ${ytDlpPath}`);

        if (process.platform === "darwin") {
          const { execSync } = require("child_process");
          try {
            execSync(`xattr -d com.apple.quarantine "${ytDlpPath}"`);
            log.info("Removed quarantine attribute from yt-dlp (macOS).");
          } catch (xattrErr) {
            log.warn(
              "Failed to remove quarantine attribute:",
              xattrErr.message,
            );
          }

          const stats = fs.statSync(ytDlpPath);
          const isExecutable = (stats.mode & 0o111) !== 0;
          log.info(`yt-dlp is executable: ${isExecutable}`);
          if (!isExecutable) {
            execSync(`chmod +x "${ytDlpPath}"`);
            log.info("Used chmod +x to set executable permissions");
          }
        }
      } catch (chmodError) {
        log.error("Failed to set executable permissions:", chmodError);
      }
    }

    // Проверяем размер скачанного файла
    if (!fs.existsSync(ytDlpPath)) {
      throw new Error("yt-dlp file was not created after download");
    }

    const fileStats = fs.statSync(ytDlpPath);
    log.info(`yt-dlp file size: ${fileStats.size} bytes`);

    if (fileStats.size < MIN_EXPECTED_SIZE) {
      log.warn(
        `yt-dlp file size ${fileStats.size} is less than expected. Removing and retrying.`,
      );
      try {
        fs.unlinkSync(ytDlpPath);
      } catch (_) {}
      if (process.platform === "darwin") {
        log.info("Attempting fallback: brew install yt-dlp");
        try {
          const { execSync } = require("child_process");
          execSync("brew install yt-dlp", { stdio: "inherit" });
          log.info("brew install yt-dlp succeeded");
        } catch (brewErr) {
          throw new Error(
            "Fallback brew install yt-dlp failed: " + brewErr.message,
          );
        }
      } else {
        throw new Error(
          "Downloaded yt-dlp binary seems invalid (too small) and no fallback available.",
        );
      }
    }

    // Проверяем версию после установки
    const newVersion = await getYtDlpVersion();
    log.info(`yt-dlp version after install: ${newVersion}`);
    if (!newVersion) {
      throw new Error("yt-dlp installed but version check failed.");
    }

    log.info("yt-dlp downloaded successfully.");
  } catch (error) {
    if (error.message && error.message.includes("Failed to parse JSON")) {
      throw new Error(
        "❗ Видео требует авторизации. Сохраните cookies.txt из браузера и поместите в папку Thunder Load.",
      );
    }
    log.error("Error in installYtDlp:", error);
    throw error;
  }
}

function findFileRecursive(dir, target) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, target);
      if (found) return found;
    } else if (entry.isFile() && entry.name === target) {
      return fullPath;
    }
  }
  return null;
}

async function getDenoVersion() {
  const denoPath = getDenoPath();
  if (!fs.existsSync(denoPath)) return null;
  try {
    const versionOutput = await runProcess(denoPath, ["--version"]);
    const firstLine = versionOutput.split("\n")[0] || versionOutput;
    log.info("Deno version detected:", firstLine);
    return firstLine;
  } catch (err) {
    log.error("Failed to run deno --version:", err.message);
    return null;
  }
}

function getDenoDownloadInfo() {
  const arch = process.arch;
  const platform = process.platform;
  const baseUrl = "https://github.com/denoland/deno/releases/latest/download";
  const binaryName = platform === "win32" ? "deno.exe" : "deno";
  let fileName = null;

  if (platform === "win32") {
    if (arch === "x64" || arch === "amd64") {
      fileName = "deno-x86_64-pc-windows-msvc.zip";
    } else if (arch === "arm64") {
      fileName = "deno-aarch64-pc-windows-msvc.zip";
    }
  } else if (platform === "darwin") {
    if (arch === "arm64") {
      fileName = "deno-aarch64-apple-darwin.zip";
    } else if (arch === "x64") {
      fileName = "deno-x86_64-apple-darwin.zip";
    }
  } else if (platform === "linux") {
    if (arch === "x64") {
      fileName = "deno-x86_64-unknown-linux-gnu.zip";
    } else if (arch === "arm64") {
      fileName = "deno-aarch64-unknown-linux-gnu.zip";
    }
  }

  if (!fileName) {
    throw new Error(
      `Unsupported platform/architecture for Deno runtime (${platform}/${arch}).`,
    );
  }

  return {
    url: `${baseUrl}/${fileName}`,
    binaryName,
  };
}

async function installDeno() {
  let zipPath = null;
  let extractPath = null;
  try {
    const version = await getDenoVersion();
    if (version) {
      log.info(`Deno ${version} is already installed.`);
      return;
    }

    const { url, binaryName } = getDenoDownloadInfo();
    log.info("Downloading Deno runtime from", url);
    zipPath = path.join(os.tmpdir(), `deno-${Date.now()}.zip`);
    extractPath = path.join(os.tmpdir(), `deno-extract-${Date.now()}`);
    await fs.promises.mkdir(extractPath, { recursive: true });
    await downloadFile(url, zipPath);

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .on("close", resolve)
        .on("error", reject);
    });

    const extractedBinary = findFileRecursive(extractPath, binaryName);
    if (!extractedBinary) {
      throw new Error("Deno binary not found after extraction.");
    }

    const targetDir = getToolsDir();
    await ensureToolsDir(targetDir);
    const targetPath = getDenoPath();
    fs.copyFileSync(extractedBinary, targetPath);
    if (process.platform !== "win32") {
      fs.chmodSync(targetPath, 0o755);
    }
    log.info("Deno runtime installed to", targetPath);
    ensureDenoCacheDir();

    const newVersion = await getDenoVersion();
    if (!newVersion) {
      throw new Error("Deno installed but version check failed.");
    }
  } catch (error) {
    log.error("Error in installDeno:", error);
    throw error;
  } finally {
    if (zipPath) {
      try {
        fs.unlinkSync(zipPath);
      } catch {}
    }
    if (extractPath) {
      try {
        if (fs.rmSync) {
          fs.rmSync(extractPath, { recursive: true, force: true });
        } else {
          fs.rmdirSync(extractPath, { recursive: true });
        }
      } catch {}
    }
  }
}

/**
 * Получает версию ffmpeg.
 */
async function getFfmpegVersion() {
  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) return null;
  return runProcess(ffmpegPath, ["-version"]);
}

/**
 * Устанавливает ffmpeg (для Windows и macOS).
 */
async function installFfmpeg() {
  try {
    const version = await getFfmpegVersion();
    if (version) {
      log.info(
        `ffmpeg version ${version.split("\n")[0]} is already installed.`,
      );
      return;
    }
    if (isDownloadCancelled) throw new Error("Download cancelled");
    log.info("ffmpeg not found, starting installation...");
    let ffmpegUrl, ffmpegZipPath, ffmpegExtractPath;
    if (process.platform === "win32") {
      ffmpegUrl =
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
      ffmpegZipPath = path.join(os.tmpdir(), "ffmpeg-release-essentials.zip");
      ffmpegExtractPath = path.join(os.tmpdir(), "ffmpeg-extract");
      await downloadFile(ffmpegUrl, ffmpegZipPath);
      log.info("ffmpeg downloaded successfully. Starting extraction...");
      await new Promise((resolve, reject) => {
        fs.createReadStream(ffmpegZipPath)
          .pipe(unzipper.Extract({ path: ffmpegExtractPath }))
          .on("close", resolve)
          .on("error", reject);
      });
      // Поиск бинарников после распаковки
      let foundBinPath = null;
      const subDirs = fs.readdirSync(ffmpegExtractPath);
      const ffmpegExecutable =
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
      const ffprobeExecutable =
        process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
      for (const dir of subDirs) {
        const potentialBin = path.join(ffmpegExtractPath, dir, "bin");
        if (
          fs.existsSync(path.join(potentialBin, ffmpegExecutable)) &&
          fs.existsSync(path.join(potentialBin, ffprobeExecutable))
        ) {
          foundBinPath = potentialBin;
          break;
        }
      }
      if (foundBinPath) {
        const dir = getToolsDir();
        const ffmpegPath = getFfmpegPath();
        const ffprobePath = getFfprobePath();
        await ensureToolsDir(dir);
        fs.copyFileSync(path.join(foundBinPath, ffmpegExecutable), ffmpegPath);
        const ffprobeSource = path.join(foundBinPath, ffprobeExecutable);
        if (fs.existsSync(ffprobeSource)) {
          fs.copyFileSync(ffprobeSource, ffprobePath);
        } else {
          log.warn("ffprobe not found in archive, skipping copy.");
        }
        if (process.platform !== "win32") {
          fs.chmodSync(ffmpegPath, 0o755);
          if (fs.existsSync(ffprobePath)) {
            fs.chmodSync(ffprobePath, 0o755);
          }
        }
        log.info("ffmpeg installed successfully.");
        fs.unlinkSync(ffmpegZipPath);
        fs.rmSync(ffmpegExtractPath, { recursive: true, force: true });
      } else {
        throw new Error("Failed to locate ffmpeg binaries after extraction.");
      }
      // На всякий случай, выставим права на бинарники ещё раз (даже если копировали вручную или ffmpeg уже был)
      if (process.platform !== "win32") {
        try {
          await fs.promises.chmod(ffmpegPath, 0o755);
          if (fs.existsSync(ffprobePath)) {
            await fs.promises.chmod(ffprobePath, 0o755);
          }
        } catch (err) {
          log.error("chmod failed:", err);
        }
      }
    } else if (process.platform === "darwin") {
      const dir = getToolsDir();
      const ffmpegPath = getFfmpegPath();
      const ffprobePath = getFfprobePath();
      await ensureToolsDir(dir);

      const downloadReleaseList = async () => {
        const endpoint =
          "https://evermeet.cx/ffmpeg/info/ffmpeg.json?t=" + Date.now();
        return fetchJson(endpoint, { timeout: 10000 });
      };

      const installFromEvermeet = async () => {
        const releases = await downloadReleaseList();
        if (!releases || !releases.length) {
          throw new Error("No releases returned from evermeet");
        }
        const archKey = process.arch === "arm64" ? "arm64" : "x86_64";
        const latest = releases[0];
        const version = latest?.version || "latest";
        const ffmpegUrl = `https://evermeet.cx/ffmpeg/ffmpeg-${archKey}-${version}.zip`;
        const ffprobeUrl = `https://evermeet.cx/ffmpeg/ffprobe-${archKey}-${version}.zip`;
        const tmpDir = path.join(os.tmpdir(), `ffmpeg-evermeet-${Date.now()}`);
        const ffmpegZipPath = path.join(tmpDir, "ffmpeg.zip");
        const ffprobeZipPath = path.join(tmpDir, "ffprobe.zip");
        await fs.promises.mkdir(tmpDir, { recursive: true });

        async function extractSingleBinary(zipPath, targetPath, binaryName) {
          const extractTo = path.join(tmpDir, binaryName);
          await fs.promises.mkdir(extractTo, { recursive: true });
          await new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
              .pipe(unzipper.Extract({ path: extractTo }))
              .on("close", resolve)
              .on("error", reject);
          });
          const extractedBinary = path.join(extractTo, binaryName);
          if (!fs.existsSync(extractedBinary)) {
            throw new Error(
              `Binary ${binaryName} not found in archive ${zipPath}`,
            );
          }
          fs.copyFileSync(extractedBinary, targetPath);
          fs.chmodSync(targetPath, 0o755);
        }

        try {
          log.info(
            `[ffmpeg] Downloading macOS build ${version} (${archKey}) from evermeet.cx…`,
          );
          await downloadFile(ffmpegUrl, ffmpegZipPath);
          await extractSingleBinary(ffmpegZipPath, ffmpegPath, "ffmpeg");
          log.info("[ffmpeg] ffmpeg installed from evermeet.cx");
        } catch (err) {
          throw new Error(`Failed to install ffmpeg from evermeet: ${err}`);
        }

        try {
          await downloadFile(ffprobeUrl, ffprobeZipPath);
          await extractSingleBinary(ffprobeZipPath, ffprobePath, "ffprobe");
          log.info("[ffmpeg] ffprobe installed from evermeet.cx");
        } catch (err) {
          log.warn(
            `Failed to install ffprobe from evermeet (optional): ${err.message}`,
          );
        } finally {
          try {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
          } catch {}
        }
      };

      try {
        await installFromEvermeet();
        return;
      } catch (err) {
        log.warn(
          `evermeet installation failed (${err.message}). Falling back to GitHub binary…`,
        );
      }

      const isArm64 = process.arch === "arm64";
      ffmpegUrl = isArm64
        ? "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-arm64"
        : "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64";

      try {
        await downloadFile(ffmpegUrl, ffmpegPath);
        fs.chmodSync(ffmpegPath, 0o755);
        log.info("ffmpeg binary downloaded and chmod applied (macOS fallback).");
      } catch (err) {
        log.warn("Failed to download ffmpeg. Trying fallback from Homebrew...");
        const brewPath = "/opt/homebrew/bin/ffmpeg";
        if (fs.existsSync(brewPath)) {
          fs.copyFileSync(brewPath, ffmpegPath);
          fs.chmodSync(ffmpegPath, 0o755);
          log.info("ffmpeg copied from Homebrew path.");
          return;
        } else {
          throw new Error("Failed to download ffmpeg and no fallback found.");
        }
      }
      // Попытка скопировать ffprobe из Homebrew, если он там есть
      const ffprobeBrewPath = "/opt/homebrew/bin/ffprobe";
      if (fs.existsSync(ffprobeBrewPath)) {
        fs.copyFileSync(ffprobeBrewPath, ffprobePath);
        fs.chmodSync(ffprobePath, 0o755);
        log.info("ffprobe copied from Homebrew path.");
      } else {
        log.warn(
          "ffprobe не установлен автоматически. Установите его вручную или используйте 'brew install ffmpeg'.",
        );
      }
      return;
    } else if (process.platform === "linux") {
      throw new Error(
        "Please install ffmpeg via your package manager (apt, yum, etc.)",
      );
    } else {
      throw new Error("Unsupported platform for ffmpeg installation.");
    }
    // --- LOGGING FFPROBE STATE ---
    const ffprobePath = getFfprobePath();
    if (fs.existsSync(ffprobePath)) {
      log.info("[ffprobe] successfully installed to:", ffprobePath);
    } else {
      log.warn("[ffprobe] not found after install.");
    }
    return;
  } catch (error) {
    if (error.message && error.message.includes("Failed to parse JSON")) {
      throw new Error(
        "❗ Видео требует авторизации. Сохраните cookies.txt из браузера и поместите в папку Thunder Load.",
      );
    }
    log.error("Error in installFfmpeg:", error);
    throw error;
  }
}

/**
 * Получает информацию о видео с помощью yt-dlp.
 */
function getVideoInfo(url) {
  log.info(`Getting video information for URL: ${url}`);
  const key = String(url || "").trim();
  if (videoInfoCache.has(key)) {
    const cached = videoInfoCache.get(key);
    if (Date.now() - cached.timestamp < VIDEO_INFO_CACHE_TTL) {
      log.info(`[download] Using cached video info for ${key}`);
      return Promise.resolve(cached.data);
    }
    videoInfoCache.delete(key);
  }
  if (videoInfoInFlight.has(key)) {
    log.info(`[download] Awaiting in-flight video info for ${key}`);
    return videoInfoInFlight.get(key);
  }
  const promise = new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();
    activeProcesses.getVideoInfo = spawn(
      ytDlpPath,
      [
        "-J",
        url,
        "--ffmpeg-location",
        ffmpegDir,
        "--no-warnings",
        "--ignore-config",
      ],
      getYtDlpSpawnOptions(),
    );
    let output = "";
    activeProcesses.getVideoInfo.stdout.on(
      "data",
      (data) => (output += data.toString()),
    );
    activeProcesses.getVideoInfo.stderr.on("data", (data) =>
      log.error(`Error: ${data}`),
    );
    activeProcesses.getVideoInfo.on("close", (code) => {
      activeProcesses.getVideoInfo = null;
      if (isDownloadCancelled) {
        log.info("getVideoInfo operation cancelled.");
        return reject(new Error("Download cancelled"));
      }
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }
      try {
        const info = JSON.parse(output);
        videoInfoCache.set(key, { timestamp: Date.now(), data: info });
        resolve(info);
      } catch (err) {
        log.error(`Error parsing video information: ${err.message}`);
        reject(err);
      }
    });
    activeProcesses.getVideoInfo.on("error", (err) => {
      activeProcesses.getVideoInfo = null;
      reject(err);
    });
  });
  videoInfoInFlight.set(key, promise);
  return promise.finally(() => {
    videoInfoInFlight.delete(key);
  });
}

/**
 * Унифицированная функция для скачивания с отслеживанием прогресса.
 */
function spawnDownloadProcess(
  format,
  outputPath,
  url,
  progressCallback,
  options = {},
) {
  const { extraArgs = [], processKey = "videoDownload" } = options;
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();
    const args = [];
    if (format) {
      args.push("-f", format);
    }
    args.push(
      "-o",
      outputPath,
      url,
      "--ffmpeg-location",
      ffmpegDir,
      "--newline",
      "--ignore-errors",
      "--no-warnings",
    );
    if (extraArgs.length) {
      args.push(...extraArgs);
    }
    const proc = spawn(ytDlpPath, args, getYtDlpSpawnOptions());
    activeProcesses[processKey] = proc;
    proc.stdout.on("data", (data) => {
      data
        .toString()
        .split("\n")
        .forEach((line) => {
          const progress = parseProgress(line);
          if (progress !== null) progressCallback(progress);
        });
    });
    proc.stderr.on("data", (data) => log.error(data.toString()));
    proc.on("close", (code) => {
      activeProcesses[processKey] = null;
      if (code !== 0 && !isDownloadCancelled) {
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }
      if (isDownloadCancelled) return reject(new Error("Download cancelled"));
      resolve();
    });
    proc.on("error", (err) => {
      activeProcesses[processKey] = null;
      reject(err);
    });
  });
}

function safeMoveFile(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
  } catch (err) {
    log.warn(`Failed to remove existing file ${dest}:`, err.message);
  }
  fs.renameSync(src, dest);
}

function createOverallProgressTracker(segmentCount, event) {
  const totalSegments = Math.max(1, segmentCount || 1);
  let segmentIndex = 0;
  let lastRaw = 0;
  let lastLogged = 0;
  return (rawPercent) => {
    let percent = Number(rawPercent);
    if (!Number.isFinite(percent)) percent = 0;
    percent = Math.max(0, Math.min(100, percent));
    if (percent + 1 < lastRaw && segmentIndex < totalSegments - 1) {
      segmentIndex += 1;
    }
    lastRaw = percent;
    const overall =
      ((segmentIndex + percent / 100) / totalSegments) * 100;
    if (overall - lastLogged >= 5 || overall >= 100) {
      log.info(`Overall progress: ${overall.toFixed(2)}%`);
      lastLogged = overall;
    }
    try {
      event.sender.send("download-progress", overall);
    } catch (err) {
      log.warn("Failed to send progress update:", err.message);
    }
  };
}

/**
 * Основная функция для скачивания медиа (аудио или видео+аудио).
 */
async function downloadMedia(
  event,
  downloadPath,
  url,
  videoFormat,
  audioFormat,
  outputFilename,
  quality,
  resolution,
  fps,
  audioExt,
  videoExt,
) {
  try {
    const sanitizedFilename = outputFilename.replace(/[\\/:*?"<>|]/g, "");
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // дефолт расширений (если вызывающий код ещё не передаёт videoExt/audioExt)
    audioExt = audioExt || "m4a";
    videoExt = videoExt || "mp4";
    if (!fs.existsSync(downloadPath))
      fs.mkdirSync(downloadPath, { recursive: true });
    currentDownloadPath = downloadPath;
    log.info("[download] Starting new job", {
      url,
      downloadPath,
      sanitizedFilename,
      quality,
      resolution,
      fps,
      audioFormat,
      videoFormat,
      audioExt: audioExt || "m4a",
      videoExt: videoExt || "mp4",
    });

    // Подготовим пути к инструментам один раз для всей функции
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();
    const denoPath = getDenoPath();
    log.info("[download] Tools being used", {
      ytDlpPath,
      ffmpegDir,
      denoPath: fs.existsSync(denoPath) ? denoPath : "deno not found",
      envPath: getYtDlpEnvironment().PATH,
    });

    // Audio Only режим
    if (quality === QUALITY_AUDIO_ONLY) {
      if (url.includes("twitch.tv")) {
        // Для Twitch: извлекаем аудио и конвертируем в mp3
        const audioOutput = path.join(downloadPath, `${sanitizedFilename}.mp3`);
        let lastLogged = 0;
        const updateProgress = (progress) => {
          if (progress - lastLogged >= 5 || progress >= 100) {
            log.info(`Audio progress: ${progress.toFixed(2)}%`);
            lastLogged = progress;
          }
          event.sender.send("download-progress", progress);
        };
        log.info("[download] Spawning yt-dlp for Twitch audio", {
          output: audioOutput,
          format: "mp3",
          url,
        });
        activeProcesses.audioDownload = spawn(
          ytDlpPath,
          [
            "-o",
            audioOutput,
            url,
            "--ffmpeg-location",
            ffmpegDir,
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--newline",
            "--ignore-errors",
            "--no-warnings",
          ],
          getYtDlpSpawnOptions(),
        );
        activeProcesses.audioDownload.stdout.on("data", (data) => {
          data
            .toString()
            .split("\n")
            .forEach((line) => {
              const p = parseProgress(line);
              if (p !== null) updateProgress(p);
            });
        });
        await new Promise((resolve, reject) => {
          activeProcesses.audioDownload.on("close", (code) => {
            activeProcesses.audioDownload = null;
            if (code !== 0 && !isDownloadCancelled) {
              return reject(new Error(`yt-dlp audio exited with code ${code}`));
            }
            if (isDownloadCancelled)
              return reject(new Error("Download cancelled"));
            log.info(`Audio downloaded: ${audioOutput}`);
            event.sender.send("download-progress", 100);
            isDownloadCancelled = false;
            resolve();
          });
        });
        return audioOutput;
      } else {
        // Для не-Twitch источников: используем формат аудио, как возвращён из selectFormatsByQuality
        const audioExtension = audioExt; // audioExt, полученный из selectFormatsByQuality
        const finalAudioPath = path.join(
          downloadPath,
          `${sanitizedFilename}.${audioExtension}`,
        );
        const tempAudioPath = path.join(
          downloadPath,
          `audio_${uniqueId}.${audioExtension}`,
        );
        let lastLogged = 0;
        const updateProgress = (progress) => {
          if (progress - lastLogged >= 5 || progress >= 100) {
            log.info(`Audio progress: ${progress.toFixed(2)}%`);
            lastLogged = progress;
          }
          event.sender.send("download-progress", progress);
        };
        log.info("[download] Spawning yt-dlp for audio-only download", {
          output: tempAudioPath,
          audioFormat,
          url,
        });
        try {
          await spawnDownloadProcess(
            String(audioFormat),
            tempAudioPath,
            url,
            updateProgress,
            { processKey: "audioDownload" },
          );
        } catch (err) {
          if (fs.existsSync(tempAudioPath)) {
            try {
              await fs.promises.unlink(tempAudioPath);
            } catch {}
          }
          throw err;
        }
        safeMoveFile(tempAudioPath, finalAudioPath);
        log.info(`Audio downloaded: ${finalAudioPath}`);
        event.sender.send("download-progress", 100);
        isDownloadCancelled = false;
        return finalAudioPath;
      }
    }

    const hasFormat = (fmt) => {
      if (typeof fmt === "string") return fmt.trim().length > 0;
      return fmt !== null && fmt !== undefined;
    };
    const combinedAvailable = hasFormat(videoFormat) && hasFormat(audioFormat);
    log.info("[download] Combined pipeline check", {
      videoFormat,
      audioFormat,
      combinedAvailable,
    });

    const progressTracker = createOverallProgressTracker(
      combinedAvailable ? 2 : 1,
      event,
    );

    if (combinedAvailable) {
      const mergedExt = "mkv";
      const finalMergedOutput = path.join(
        downloadPath,
        `${sanitizedFilename}.${mergedExt}`,
      );
      const tempMergedOutput = path.join(
        downloadPath,
        `combined_${uniqueId}.${mergedExt}`,
      );
      log.info("[download] Spawning yt-dlp for combined download", {
        format: `${videoFormat}+${audioFormat}`,
        tempOutput: tempMergedOutput,
        finalOutput: finalMergedOutput,
        url,
      });
      try {
        const combinedFormat = `${String(videoFormat)}+${String(audioFormat)}`;
        await spawnDownloadProcess(
          combinedFormat,
          tempMergedOutput,
          url,
          progressTracker,
          {
            extraArgs: ["--merge-output-format", mergedExt],
            processKey: "videoDownload",
          },
        );
      } catch (err) {
        if (fs.existsSync(tempMergedOutput)) {
          try {
            await fs.promises.unlink(tempMergedOutput);
          } catch {}
        }
        throw err;
      }
      safeMoveFile(tempMergedOutput, finalMergedOutput);
      event.sender.send("download-progress", 100);
      isDownloadCancelled = false;
      log.info(`[download] Combined stream saved as ${finalMergedOutput}`);
      return finalMergedOutput;
    }

    const directFormat = videoFormat || audioFormat;
    if (!directFormat) {
      throw new Error("Не удалось подобрать формат загрузки");
    }
    const finalExt = videoFormat ? videoExt : audioExt || "mp4";
    const finalOutput = path.join(
      downloadPath,
      `${sanitizedFilename}.${finalExt}`,
    );
    const tempOutput = path.join(
      downloadPath,
      `direct_${uniqueId}.${finalExt}`,
    );
    log.info("[download] Spawning yt-dlp for direct stream download", {
      format: directFormat,
      tempOutput,
      finalOutput,
      url,
    });
    try {
      await spawnDownloadProcess(
        String(directFormat),
        tempOutput,
        url,
        progressTracker,
        { processKey: "videoDownload" },
      );
    } catch (err) {
      if (fs.existsSync(tempOutput)) {
        try {
          await fs.promises.unlink(tempOutput);
        } catch {}
      }
      throw err;
    }
    safeMoveFile(tempOutput, finalOutput);
    event.sender.send("download-progress", 100);
    isDownloadCancelled = false;
    log.info(`[download] Direct stream saved as ${finalOutput}`);
    return finalOutput;
  } catch (error) {
    if (error.message && error.message.includes("Failed to parse JSON")) {
      throw new Error(
        "❗ Видео требует авторизации. Сохраните cookies.txt из браузера и поместите в папку Thunder Load.",
      );
    }
    log.error("Error in downloadMedia:", error);
    throw error;
  }
}

/**
 * Останавливает все активные процессы и выполняет очистку.
 */
async function stopDownload() {
  isDownloadCancelled = true;
  // Отмена активных сетевых запросов
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();

  const processes = [
    { proc: activeProcesses.getVideoInfo, name: "getVideoInfo" },
    { proc: activeProcesses.videoDownload, name: "video download" },
    { proc: activeProcesses.audioDownload, name: "audio download" },
    { proc: activeProcesses.merge, name: "merge" },
  ];
  const killPromises = processes.map(({ proc, name }) => {
    return new Promise((resolve) => {
      if (proc && !proc.killed) {
        log.info(`Stopping ${name} process...`);
        treeKill(proc.pid, "SIGTERM", (err) => {
          if (err) {
            log.error(`Error stopping ${name} process:`, err);
            treeKill(proc.pid, "SIGKILL", (err2) => {
              if (err2) {
                log.error(`Failed to forcibly stop ${name}:`, err2);
              } else {
                log.info(`${name} process forcibly stopped.`);
              }
              resolve();
            });
          } else {
            log.info(`${name} process stopped.`);
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
  await Promise.all(killPromises);
  activeProcesses.getVideoInfo = null;
  activeProcesses.videoDownload = null;
  activeProcesses.audioDownload = null;
  activeProcesses.merge = null;

  // Очистка временных файлов с расширениями .part и .ytdl
  if (currentDownloadPath) {
    try {
      const files = await fs.promises.readdir(currentDownloadPath);
      const tempFiles = files.filter(
        (file) => file.endsWith(".part") || file.endsWith(".ytdl"),
      );
      for (const file of tempFiles) {
        const fullPath = path.join(currentDownloadPath, file);
        try {
          await fs.promises.unlink(fullPath);
          log.info(`Temporary file deleted: ${fullPath}`);
        } catch (err) {
          log.error(`Error deleting temporary file ${fullPath}:`, err);
        }
      }
    } catch (err) {
      log.error("Error scanning download directory for temporary files:", err);
    }
    currentDownloadPath = null;
  }

  log.info("Download cancelled.");
}

/**
 * Сбрасывает флаг отмены загрузки.
 */
function resetDownloadCancelledFlag() {
  isDownloadCancelled = false;
}

/**
 * Возвращает состояние отмены загрузки.
 */
function isDownloadCancelledFunc() {
  return isDownloadCancelled;
}

log.info(
  "[download.js] tools dir:",
  getToolsDir(),
  "(default:",
  getDefaultToolsDir(),
  ")",
);
log.info("[download.js] yt-dlp path:", getYtDlpPath());
log.info("[download.js] ffmpeg path:", getFfmpegPath());
log.info("[download.js] ffprobe path:", getFfprobePath());
log.info("[download.js] deno path:", getDenoPath());

module.exports = {
  installYtDlp,
  installFfmpeg,
  installDeno,
  getVideoInfo,
  downloadMedia,
  stopDownload,
  resetDownloadCancelledFlag,
  selectFormatsByQuality,
  isDownloadCancelled: isDownloadCancelledFunc,
  ensureAllDependencies,
};

/**
 * Устанавливает все необходимые зависимости (yt-dlp и ffmpeg).
 */
async function ensureAllDependencies(store = null) {
  if (store) {
    setSharedStore(store);
  }
  await installDeno();
  await installYtDlp();
  await installFfmpeg();
}
