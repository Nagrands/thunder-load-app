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
const Store = require("electron-store");

// Динамические пути к инструментам — читаем текущее значение из electron-store каждый раз
function getStore() {
  try { return new Store(); } catch { return null; }
}
function getToolsDir() {
  return getEffectiveToolsDir(getStore());
}
function getYtDlpPath() { return resolveToolPath("yt-dlp", getToolsDir()); }
function getFfmpegPath() { return resolveToolPath("ffmpeg", getToolsDir()); }
function getFfprobePath() {
  const dir = getToolsDir();
  return path.join(dir, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
}

// Качество скачивания
const QUALITY_AUDIO_ONLY = "Audio Only";
const QUALITY_SOURCE = "Source";
const QUALITY_FHD = "FHD 1080p";
const QUALITY_HD = "HD 720p";
const QUALITY_SD = "SD 360p";

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
        try { fs.unlinkSync(dest); } catch (_) {}
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
          const redirectUrl = new URL(response.headers.location, url).toString();
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
          const err = new Error(`Failed to download file. Status code: ${response.statusCode}`);
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

  const onlyAudio = formats.filter((f) => f.acodec !== "none" && f.vcodec === "none");
  const onlyVideo = formats.filter((f) => f.vcodec !== "none" && f.acodec === "none");
  const muxed     = formats.filter((f) => f.vcodec !== "none" && f.acodec !== "none");

  // AUDIO ONLY
  if (desiredQuality === QUALITY_AUDIO_ONLY) {
    let audio = pickBest(onlyAudio, (a, b) => (b.abr || 0) - (a.abr || 0));
    // если чистого аудио нет — берём лучший muxed и качаем как есть
    if (!audio) {
      const m = pickBest(muxed, (a, b) => (b.abr || 0) - (a.abr || 0) || (b.tbr || 0) - (a.tbr || 0));
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
      const v = pickBest(onlyVideo, (a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
      const a = pickBest(onlyAudio, (x, y) => (y.abr || 0) - (x.abr || 0));
      if (!v || !a) throw new Error("Suitable formats for source quality not found.");
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
    const m = pickBest(muxed, (a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
    if (!m) throw new Error("No suitable muxed format found for source quality.");
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
      candidates = [pickBest(lower, (a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0))];
    }
  }
  // 3) иначе — ближайшая выше
  if (!candidates.length) {
    const higher = onlyVideo.filter((f) => (f.height || 0) > target);
    if (higher.length) {
      candidates = [pickBest(higher, (a, b) => (a.height || 0) - (b.height || 0) || (a.tbr || 0) - (b.tbr || 0))];
    }
  }

  let video = candidates.length ? candidates[0] : null;
  let audio = null;

  if (video) {
    audio = pickBest(onlyAudio, (a, b) => (b.abr || 0) - (a.abr || 0));
    if (!audio) {
      // нет отдельного аудио — попробуем подходящий muxed не выше target
      const m = pickBest(
        muxed.filter((f) => (f.height || 0) <= (video.height || target)),
        (a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0)
      );
      if (m) {
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
      throw new Error(`No available audio format for ${desiredQuality}`);
    }
    return {
      videoFormat: video.format_id,
      audioFormat: audio.format_id,
      resolution: video.width && video.height ? `${video.width}x${video.height}` : "unknown",
      fps: video.fps || null,
      videoExt: video.ext || "mp4",
      audioExt: audio.ext || "m4a",
      isMuxed: false,
    };
  } else {
    // нет отдельного видео — возьмём лучший muxed не выше target
    const m = pickBest(
      muxed.filter((f) => (f.height || 0) <= target),
      (a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0)
    );
    if (!m) throw new Error(`No available video formats for quality ${desiredQuality} or lower`);
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
  if (!fs.existsSync(ytDlpPath)) return null;
  try {
    return await runProcess(ytDlpPath, ["--version"]);
  } catch (err) {
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
        : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    const dir = getToolsDir();
    const ytDlpPath = getYtDlpPath();
    await ensureToolsDir(dir);
    await downloadFile(ytDlpUrl, ytDlpPath);
    if (process.platform !== "win32") fs.chmodSync(ytDlpPath, 0o755);
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
      const ffmpegExecutable = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
      const ffprobeExecutable = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
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
      // macOS: скачать бинарник ffmpeg напрямую и применить chmod
      const isArm64 = process.arch === "arm64";
      ffmpegUrl = isArm64
        ? "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-arm64"
        : "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64";

      const dir = getToolsDir();
      const ffmpegPath = getFfmpegPath();
      const ffprobePath = getFfprobePath();
      await ensureToolsDir(dir);

      try {
        await downloadFile(ffmpegUrl, ffmpegPath);
        fs.chmodSync(ffmpegPath, 0o755);
        log.info("ffmpeg binary downloaded and chmod applied (macOS).");
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
      }
      log.warn(
        "ffprobe не установлен автоматически. Установите его вручную или используйте 'brew install ffmpeg'.",
      );
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
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();
    activeProcesses.getVideoInfo = spawn(ytDlpPath, [
      "-J",
      url,
      "--ffmpeg-location",
      ffmpegDir,
      "--no-warnings",
      "--ignore-config",
    ]);
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
}

/**
 * Унифицированная функция для скачивания с отслеживанием прогресса.
 */
function spawnDownloadProcess(format, outputPath, url, progressCallback) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();
    const proc = spawn(ytDlpPath, [
      "-f",
      format,
      "-o",
      outputPath,
      url,
      "--ffmpeg-location",
      ffmpegDir,
      "--newline",
      "--ignore-errors",
      "--no-warnings",
    ]);
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
      if (code !== 0 && !isDownloadCancelled) {
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }
      if (isDownloadCancelled) return reject(new Error("Download cancelled"));
      resolve();
    });
  });
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

    // Подготовим пути к инструментам один раз для всей функции
    const ytDlpPath = getYtDlpPath();
    const ffmpegDir = getToolsDir();

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
        activeProcesses.audioDownload = spawn(ytDlpPath, [
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
        ]);
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
        const audioOutput = path.join(
          downloadPath,
          `${sanitizedFilename}.${audioExtension}`,
        );
        let lastLogged = 0;
        const updateProgress = (progress) => {
          if (progress - lastLogged >= 5 || progress >= 100) {
            log.info(`Audio progress: ${progress.toFixed(2)}%`);
            lastLogged = progress;
          }
          event.sender.send("download-progress", progress);
        };
        activeProcesses.audioDownload = spawn(ytDlpPath, [
          "-f",
          audioFormat,
          "-o",
          audioOutput,
          url,
          "--ffmpeg-location",
          ffmpegDir,
          "--newline",
          "--ignore-errors",
          "--no-warnings",
        ]);
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
      }
    }

    // временные файлы — расширения здесь не критичны (ffmpeg понимает по контейнеру),
    // но для читабельности используем ожидаемые по умолчанию
    const videoOutputTemp = path.join(downloadPath, `video_${uniqueId}.mp4`);
    const audioOutputTemp = path.join(downloadPath, `audio_${uniqueId}.m4a`);
    const mergedOutput    = path.join(downloadPath, `${sanitizedFilename}.mkv`);

    // Удаление старых фрагментов, если они существуют
    for (const file of [videoOutputTemp, audioOutputTemp]) {
      if (fs.existsSync(file)) {
        try {
          await fs.promises.unlink(file);
        } catch (err) {
          log.error(`Error deleting ${file}:`, err);
        }
      }
    }

    let videoProgress = 0,
      audioProgress = 0,
      lastLoggedProgress = 0;
    const progressHistory = [];
    const updateProgress = () => {
      const total = (videoProgress + audioProgress) / 2;
      progressHistory.push(total);
      if (progressHistory.length > 10) progressHistory.shift();
      const smoothed =
        progressHistory.reduce((acc, val) => acc + val, 0) /
        progressHistory.length;
      if (smoothed - lastLoggedProgress >= 5 || smoothed >= 100) {
        log.info(`Overall progress: ${smoothed.toFixed(2)}%`);
        lastLoggedProgress = smoothed;
      }
      event.sender.send("download-progress", smoothed);
    };

    // Скачивание видео
    await new Promise((resolve, reject) => {
      activeProcesses.videoDownload = spawn(ytDlpPath, [
        "-f",
        videoFormat,
        "-o",
        videoOutputTemp,
        url,
        "--ffmpeg-location",
        ffmpegDir,
        "--newline",
        "--ignore-errors",
        "--no-warnings",
      ]);
      activeProcesses.videoDownload.stdout.on("data", (data) => {
        data
          .toString()
          .split("\n")
          .forEach((line) => {
            const p = parseProgress(line);
            if (p !== null) {
              videoProgress = p;
              updateProgress();
            }
          });
      });
      activeProcesses.videoDownload.stderr.on("data", (data) =>
        log.error(`Video: ${data}`),
      );
      activeProcesses.videoDownload.on("close", (code) => {
        activeProcesses.videoDownload = null;
        if (code !== 0 && !isDownloadCancelled) {
          return reject(new Error(`yt-dlp video exited with code ${code}`));
        }
        if (isDownloadCancelled) return reject(new Error("Download cancelled"));
        resolve();
      });
    });

    // Если audioFormat валиден, скачиваем аудио и выполняем слияние
    if (
      audioFormat &&
      typeof audioFormat === "string" &&
      audioFormat.trim() !== ""
    ) {
      await new Promise((resolve, reject) => {
        activeProcesses.audioDownload = spawn(ytDlpPath, [
          "-f",
          audioFormat,
          "-o",
          audioOutputTemp,
          url,
          "--ffmpeg-location",
          ffmpegDir,
          "--newline",
          "--ignore-errors",
          "--no-warnings",
        ]);
        activeProcesses.audioDownload.stdout.on("data", (data) => {
          data
            .toString()
            .split("\n")
            .forEach((line) => {
              const p = parseProgress(line);
              if (p !== null) {
                audioProgress = p;
                updateProgress();
              }
            });
        });
        activeProcesses.audioDownload.stderr.on("data", (data) =>
          log.error(`Audio: ${data}`),
        );
        activeProcesses.audioDownload.on("close", (code) => {
          activeProcesses.audioDownload = null;
          if (code !== 0 && !isDownloadCancelled) {
            return reject(new Error(`yt-dlp audio exited with code ${code}`));
          }
          if (isDownloadCancelled)
            return reject(new Error("Download cancelled"));
          resolve();
        });
      });

      // Слияние видео и аудио через ffmpeg
      await new Promise((resolve, reject) => {
        const ffmpegPath = getFfmpegPath();
        activeProcesses.merge = spawn(ffmpegPath, [
          "-i",
          videoOutputTemp,
          "-i",
          audioOutputTemp,
          "-c",
          "copy",
          "-y",
          mergedOutput,
        ]);
        activeProcesses.merge.on("close", async (code) => {
          activeProcesses.merge = null;
          if (code !== 0 && !isDownloadCancelled) {
            return reject(new Error(`ffmpeg exited with code ${code}`));
          }
          if (isDownloadCancelled)
            return reject(new Error("Download cancelled"));
          log.info(`Merged file saved at ${mergedOutput}`);
          // Очистка временных файлов
          for (const file of [videoOutputTemp, audioOutputTemp]) {
            if (fs.existsSync(file)) {
              try {
                await fs.promises.unlink(file);
              } catch (err) {
                log.error(`Error deleting temp file ${file}:`, err);
              }
            }
          }
          event.sender.send("download-progress", 100);
          isDownloadCancelled = false;
          resolve();
        });
      });
      return mergedOutput;
    } else {
      // Если audioFormat не валиден (muxed fallback)
      // Переименовываем скачанный видеофайл с корректным расширением
      const finalExt = (typeof videoFormat === "string" && videoFormat) ? null : null; // не знаем из format_id
      // попытаемся угадать расширение из resolution-подбора (мы передаём его снаружи как videoExt)
      const properExt = (typeof audioExt === "string" && audioExt === null) ? null : null; // заглушка, не используется
      // так как мы заранее знаем расширение из selectFormatsByQuality, передайте его параметром `fps` далее
      // здесь применяем: если передан fps как объект, проигнорируем — берём videoExt через замыкание
      const targetExt = (typeof videoExt === "string" && videoExt) ? videoExt : "mp4";
      const properOutput = path.join(downloadPath, `${sanitizedFilename}.${targetExt}`);
      try {
        fs.renameSync(videoOutputTemp, properOutput);
        log.info(`[downloadMedia] Muxed stream saved as ${properOutput}`);
      } catch (err) {
        log.error(`[downloadMedia] Error renaming muxed file: ${err}`);
        return videoOutputTemp;
      }
      event.sender.send("download-progress", 100);
      isDownloadCancelled = false;
      return properOutput;
    }
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

log.info("[download.js] tools dir:", getToolsDir(), "(default:", getDefaultToolsDir(), ")");
log.info("[download.js] yt-dlp path:", getYtDlpPath());
log.info("[download.js] ffmpeg path:", getFfmpegPath());
log.info("[download.js] ffprobe path:", getFfprobePath());

module.exports = {
  installYtDlp,
  installFfmpeg,
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
async function ensureAllDependencies() {
  await installYtDlp();
  await installFfmpeg();
}
