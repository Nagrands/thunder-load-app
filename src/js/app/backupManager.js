// src/js/app/backupManager.js
// Main-process helper for Backup tab logic
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const { app, dialog, shell } = require("electron");
const log = require("electron-log");
const { promisify } = require("util");
const { exec, execFile } = require("child_process");
const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Проверка доступности команд архивации
async function checkCommandExists(command) {
  try {
    if (process.platform === "win32") {
      await execAsync(`where ${command}`);
    } else {
      await execAsync(`which ${command}`);
    }
    return true;
  } catch {
    return false;
  }
}

// Получение свободного места на диске
async function getFreeDiskSpace(dirPath) {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `wmic logicaldisk where "DeviceID='${path.parse(dirPath).root.replace("\\", "")}'" get FreeSpace /value`,
      );
      const freeBytes = parseInt(stdout.split("=")[1].trim());
      return Math.round(freeBytes / 1024 / 1024); // MB
    } else {
      const { stdout } = await execAsync(
        `df -k "${dirPath}" | tail -1 | awk '{print $4}'`,
      );
      const freeKB = parseInt(stdout.trim());
      return Math.round(freeKB / 1024); // MB
    }
  } catch (error) {
    log.warn(
      `[backup] Failed to get disk space for ${dirPath}: ${error.message}`,
    );
    return null;
  }
}

// Нормализация путей для Windows
function normalizePath(p) {
  if (!p) return p;
  // Убрать недопустимые символы Windows
  const cleanPath = p.replace(/[<>"|?*]/g, "");
  return path.resolve(cleanPath);
}

// Подготовка длинных путей для Windows
function prepareLongPath(filePath) {
  if (process.platform === "win32" && filePath.length > 240) {
    if (!filePath.startsWith("\\\\?\\")) {
      return "\\\\?\\" + path.resolve(filePath);
    }
  }
  return path.resolve(filePath);
}

function getUserDataDir() {
  try {
    return app.getPath("userData");
  } catch (_) {
    return path.join(os.homedir(), ".thunder-load");
  }
}

function getBackupRoot() {
  return path.join(getUserDataDir(), "backup");
}

function getConfigPath() {
  return path.join(getBackupRoot(), "config.json");
}

async function ensureDir(dir) {
  const normalizedDir = normalizePath(dir);
  await fsp.mkdir(normalizedDir, { recursive: true });
}

function wildcardToRegex(pattern) {
  // Very simple glob → regex: supports * and ? on filename only
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function matchByPatterns(fileName, patterns) {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0)
    return true;
  return patterns.some((p) => wildcardToRegex(p).test(fileName));
}

/**
 * Copy a file with retries to handle intermittent ENOENT errors.
 * Logs missing files on Windows and retries a few times.
 * @param {string} src - Source file path
 * @param {string} dst - Destination file path
 * @param {number} [retries=3] - Number of retry attempts
 * @param {number} [delay=500] - Delay between retries in ms
 */
async function copyFileWithRetry(src, dst, retries = 3, delay = 500) {
  const srcLong = prepareLongPath(src);
  const dstLong = prepareLongPath(dst);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fsp.access(srcLong, fs.constants.R_OK);
      await fsp.copyFile(srcLong, dstLong);
      return;
    } catch (err) {
      if (err.code === "ENOENT") {
        log.warn(
          `[backup] ENOENT: Source file not found '${src}' (attempt ${attempt}/${retries})`,
        );
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      log.warn(
        `[backup] Failed to copy file '${src}' -> '${dst}': ${err?.message || err}`,
      );
      throw err;
    }
  }
}

async function readPrograms() {
  try {
    const p = getConfigPath();
    await ensureDir(path.dirname(p));
    const raw = await fsp.readFile(p, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.programs) ? data.programs : [];
  } catch (e) {
    log.warn(`[backup] Failed to read programs config: ${e?.message || e}`);
    return [];
  }
}

async function savePrograms(programs) {
  const p = getConfigPath();
  await ensureDir(path.dirname(p));
  const payload = { programs: Array.isArray(programs) ? programs : [] };
  await fsp.writeFile(p, JSON.stringify(payload, null, 2), "utf-8");
}

async function listLastTimes(programs) {
  const result = {};
  for (const prg of programs) {
    try {
      const dir = prg?.backup_path;
      const name = prg?.name;
      if (!dir || !name) continue;
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const prefix = `${name}_Backup_`;
      const archives = entries
        .filter(
          (e) =>
            e.isFile() &&
            e.name.startsWith(prefix) &&
            (e.name.endsWith(".zip") || e.name.endsWith(".tar.gz")),
        )
        .map((e) => path.join(dir, e.name));
      let latest = null;
      for (const arch of archives) {
        const st = await fsp.stat(arch);
        if (!latest || st.mtimeMs > latest.mtimeMs)
          latest = { file: arch, mtimeMs: st.mtimeMs };
      }
      if (latest) result[name] = latest.mtimeMs;
    } catch (err) {
      log.warn(
        `[backup] Failed to list last times for program '${prg?.name}': ${err?.message || err}`,
      );
    }
  }
  return result;
}

async function isDirNotEmptyWithPatterns(srcDir, patterns) {
  try {
    const srcDirLong = prepareLongPath(srcDir);
    const entries = await fsp.readdir(srcDirLong, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(srcDirLong, entry.name);
      if (entry.isFile()) {
        if (matchByPatterns(entry.name, patterns)) {
          return true;
        }
      } else if (entry.isDirectory()) {
        const notEmpty = await isDirNotEmptyWithPatterns(fullPath, patterns);
        if (notEmpty) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function copyTreeFiltered(src, dst, patterns) {
  const srcLong = prepareLongPath(src);
  const dstLong = prepareLongPath(dst);

  const st = await fsp.stat(srcLong);
  if (!st.isDirectory()) throw new Error(`Source is not a directory: ${src}`);
  const stack = [""]; // relative paths
  while (stack.length) {
    const rel = stack.pop();
    const curSrc = path.join(srcLong, rel);
    const curDst = path.join(dstLong, rel);
    const items = await fsp.readdir(curSrc, { withFileTypes: true });
    for (const it of items) {
      const srcPath = path.join(curSrc, it.name);
      const relPath = path.join(rel, it.name);
      const dstPath = path.join(curDst, it.name);
      if (it.isDirectory()) {
        const hasContent = await isDirNotEmptyWithPatterns(srcPath, patterns);
        if (hasContent) {
          await ensureDir(dstPath);
          stack.push(relPath);
        }
      } else if (it.isFile()) {
        if (matchByPatterns(it.name, patterns)) {
          await ensureDir(path.dirname(dstPath));
          await copyFileWithRetry(srcPath, dstPath); // Use retry helper
        }
      }
    }
  }
}

async function copyProfile(profilePath, dstRoot) {
  if (!profilePath) return;
  try {
    const profilePathLong = prepareLongPath(profilePath);
    const st = await fsp.stat(profilePathLong);
    if (!st.isDirectory()) return;
    const dst = path.join(dstRoot, "Profiles");
    await copyDir(profilePathLong, dst);
  } catch (err) {
    log.warn(`[backup] Failed to copy profile: ${err.message}`);
  }
}

async function copyDir(src, dst) {
  const srcLong = prepareLongPath(src);
  const dstLong = prepareLongPath(dst);

  const st = await fsp.stat(srcLong);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${src}`);
  await ensureDir(dstLong);
  const entries = await fsp.readdir(srcLong, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(srcLong, e.name);
    const d = path.join(dstLong, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await ensureDir(path.dirname(d));
      await copyFileWithRetry(s, d); // Use retry helper
    }
  }
}

async function zipFolder(
  folderPath,
  zipPath,
  archiveType = "zip",
  compressionLevel = 6,
) {
  const platform = process.platform;
  const folderPathLong = prepareLongPath(folderPath);
  const zipPathLong = prepareLongPath(zipPath);

  if (archiveType === "tar.gz") {
    // Use tar with gzip compression
    try {
      const args = [
        "-czf",
        zipPathLong,
        "-C",
        path.dirname(folderPathLong),
        path.basename(folderPathLong),
      ];
      if (compressionLevel > 0) {
        // Set compression level for gzip
        process.env.GZIP = `-${compressionLevel}`;
      }
      await execFileAsync("tar", args);
      return zipPathLong;
    } catch (e) {
      log.warn(`[backup] tar.gz failed, trying fallback: ${e.message}`);
      // Fallback to node-based implementation if tar fails
      return await createTarGzFallback(
        folderPathLong,
        zipPathLong,
        compressionLevel,
      );
    }
  } else {
    // ZIP format
    if (platform === "win32") {
      // Use PowerShell Compress-Archive with compression level
      const ps = "powershell.exe";
      const args = [
        "-NoProfile",
        "-Command",
        `$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal; if (${compressionLevel} -eq 0) { $compressionLevel = [System.IO.Compression.CompressionLevel]::NoCompression } elseif (${compressionLevel} -lt 5) { $compressionLevel = [System.IO.Compression.CompressionLevel]::Fastest }; Compress-Archive -LiteralPath '${folderPathLong.replace(/'/g, "''")}' -DestinationPath '${zipPathLong.replace(/'/g, "''")}' -CompressionLevel $compressionLevel -Force`,
      ];
      await execFileAsync(ps, args, { windowsHide: true });
    } else {
      // Use zip command with compression level - проверяем доступность
      const zipAvailable = await checkCommandExists("zip");
      if (zipAvailable) {
        try {
          await execFileAsync(
            "zip",
            [
              "-r",
              "-q",
              `-${compressionLevel}`,
              zipPathLong,
              path.basename(folderPathLong),
            ],
            {
              cwd: path.dirname(folderPathLong),
            },
          );
        } catch (e) {
          // fallback: create tar.gz if zip is not available
          log.warn(`[backup] zip failed, falling back to tar.gz: ${e.message}`);
          const tgz = zipPathLong.replace(/\.zip$/i, ".tar.gz");
          return await zipFolder(
            folderPathLong,
            tgz,
            "tar.gz",
            compressionLevel,
          );
        }
      } else {
        // zip not available, use tar.gz directly
        log.warn(`[backup] zip command not available, using tar.gz instead`);
        const tgz = zipPathLong.replace(/\.zip$/i, ".tar.gz");
        return await zipFolder(folderPathLong, tgz, "tar.gz", compressionLevel);
      }
    }
    return zipPathLong;
  }
}

// Fallback implementation for tar.gz using node.js
async function createTarGzFallback(folderPath, zipPath, compressionLevel) {
  return new Promise((resolve, reject) => {
    const tar = require("tar");
    tar
      .c(
        {
          gzip: { level: compressionLevel },
          file: zipPath,
          cwd: path.dirname(folderPath),
        },
        [path.basename(folderPath)],
      )
      .then(() => resolve(zipPath))
      .catch(reject);
  });
}

async function moveOldBackups(backupDir, programName, keep = 7) {
  try {
    const backupDirLong = prepareLongPath(backupDir);
    const entries = await fsp.readdir(backupDirLong, { withFileTypes: true });
    const prefix = `${programName}_Backup_`;
    const targets = [];
    for (const e of entries) {
      if (
        e.isFile() &&
        e.name.startsWith(prefix) &&
        (e.name.endsWith(".zip") || e.name.endsWith(".tar.gz"))
      ) {
        const full = path.join(backupDirLong, e.name);
        const st = await fsp.stat(full);
        targets.push({ file: full, mtimeMs: st.mtimeMs });
      }
    }
    targets.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (targets.length > keep) {
      for (const t of targets.slice(keep)) {
        try {
          const st = await fsp.stat(t.file).catch(() => null);
          if (st && st.isFile()) {
            await fsp.unlink(t.file);
            log.info(`[backup] Old backup deleted: ${t.file}`);
          } else {
            log.warn(`[backup] Skipping non-file or missing: ${t.file}`);
          }
        } catch (err) {
          log.warn(
            `[backup] Failed to delete old backup: ${t.file} - ${err.message}`,
          );
        }
      }
    }
  } catch (e) {
    log.warn("[backup] moveOldBackups error:", e?.message || e);
  }
}

// Pre-flight checks
function buildPreflightIssue(code, message, hint, severity = "error") {
  return { code, message, hint, severity };
}

function getInstallHint(tool) {
  if (process.platform === "darwin") return `Установите через Homebrew: brew install ${tool}`;
  if (process.platform === "win32")
    return `Установите ${tool} (например, через winget/choco) или добавьте в PATH`;
  return `Установите ${tool} через пакетный менеджер (apt/yum/pacman) и добавьте в PATH`;
}

async function preFlightChecksDetailed(program) {
  const name = program?.name || "Без имени";
  const result = {
    name,
    archiveType: program?.archive_type || "zip",
    errors: [],
    warnings: [],
    status: "ok",
  };

  if (!program) {
    result.errors.push(
      buildPreflightIssue(
        "invalid-config",
        "Повреждён профиль резервного копирования",
        "Создайте профиль заново или отредактируйте его.",
      ),
    );
    result.status = "error";
    return result;
  }

  // Проверка исходной директории
  if (!program.source_path) {
    result.errors.push(
      buildPreflightIssue(
        "src-missing",
        "Не указан исходный путь",
        "Заполните поле «Исходная папка» в профиле.",
      ),
    );
  } else {
    const srcLong = prepareLongPath(program.source_path);
    try {
      await fsp.access(srcLong);
    } catch {
      result.errors.push(
        buildPreflightIssue(
          "src-access",
          `Исходный путь не существует или недоступен: ${program.source_path}`,
          "Проверьте путь и права доступа или выберите другую папку.",
        ),
      );
    }
  }

  // Проверка целевой директории
  if (!program.backup_path) {
    result.errors.push(
      buildPreflightIssue(
        "dst-missing",
        "Не указана папка бэкапа",
        "Заполните поле «Папка бэкапа» или выберите путь через кнопку папки.",
      ),
    );
  } else {
    const dstLong = prepareLongPath(program.backup_path);
    try {
      await fsp.access(dstLong, fs.constants.W_OK);
    } catch {
      result.errors.push(
        buildPreflightIssue(
          "dst-access",
          `Нет прав записи в целевую директорию: ${program.backup_path}`,
          "Откройте права записи или выберите другую папку назначения.",
        ),
      );
    }
  }

  // Проверка профильной директории если указана
  if (program.profile_path) {
    try {
      const profileLong = prepareLongPath(program.profile_path);
      await fsp.access(profileLong);
    } catch {
      result.errors.push(
        buildPreflightIssue(
          "profile-access",
          `Папка профиля не найдена: ${program.profile_path}`,
          "Укажите существующую папку профилей или очистите поле, если она не нужна.",
        ),
      );
    }
  }

  // Проверка дискового пространства
  if (program.backup_path) {
    try {
      const freeSpace = await getFreeDiskSpace(program.backup_path);
      if (freeSpace && freeSpace < 500) {
        result.errors.push(
          buildPreflightIssue(
            "disk-space",
            `Мало свободного места: ${freeSpace} MB`,
            "Освободите место или выберите другую папку бэкапа (рекомендуется ≥ 500 MB).",
          ),
        );
      } else if (!freeSpace) {
        result.warnings.push(
          buildPreflightIssue(
            "disk-unknown",
            "Не удалось определить свободное место",
            "Проверьте права доступа к диску или попробуйте другой путь назначения.",
            "warning",
          ),
        );
      }
    } catch (error) {
      log.warn(
        `[backup] Disk space check failed for ${name}: ${error.message}`,
      );
    }
  }

  // Проверка команд архивации
  if (program.archive_type === "zip" && process.platform !== "win32") {
    const zipAvailable = await checkCommandExists("zip");
    if (!zipAvailable) {
      result.errors.push(
        buildPreflightIssue(
          "zip-missing",
          "Команда zip не найдена",
          getInstallHint("zip"),
        ),
      );
    }
  }

  if (program.archive_type === "tar.gz") {
    const tarAvailable = await checkCommandExists("tar");
    if (!tarAvailable) {
      result.errors.push(
        buildPreflightIssue(
          "tar-missing",
          "Команда tar не найдена",
          getInstallHint("tar"),
        ),
      );
    }
  }

  result.status = result.errors.length
    ? "error"
    : result.warnings.length
      ? "warning"
      : "ok";

  return result;
}

async function preFlightChecks(program) {
  const detailed = await preFlightChecksDetailed(program);
  return detailed.errors.map((err) => err.message);
}

async function runBackup(program) {
  const name = program?.name;
  const src = program?.source_path;
  const dstRoot = program?.backup_path;
  const profile = program?.profile_path || null;
  const patterns = Array.isArray(program?.config_patterns)
    ? program.config_patterns
    : [];
  const archiveType = program?.archive_type || "zip";
  const compressionLevel = program?.compression_level ?? 6;

  if (!name || !src || !dstRoot) throw new Error("Invalid program config");

  log.info(
    `[backup] Starting backup for program: ${name}, type: ${archiveType}, compression: ${compressionLevel}`,
  );
  log.info(`[backup] Platform: ${process.platform}, Arch: ${process.arch}`);
  log.info(`[backup] Node.js: ${process.version}`);

  // Pre-flight checks
  const preflightErrors = await preFlightChecks(program);
  if (preflightErrors.length > 0) {
    const errorMsg = `Pre-flight checks failed for ${name}:\n${preflightErrors.join("\n")}`;
    log.error(`[backup] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const ts = new Date();
  const timestamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}_${String(ts.getHours()).padStart(2, "0")}-${String(ts.getMinutes()).padStart(2, "0")}-${String(ts.getSeconds()).padStart(2, "0")}`;
  const uniq = `${timestamp}_${process.pid}`;
  const tmpFolder = path.join(os.tmpdir(), `${name}_Backup_${uniq}`);
  const zipOutTmp = path.join(
    os.tmpdir(),
    `${name}_Backup_${uniq}.${archiveType}`,
  );

  // ИСПРАВЛЕНИЕ: объявляем startTime ДО блока try
  const startTime = Date.now();

  try {
    // Check available commands
    const zipAvailable = await checkCommandExists("zip");
    const tarAvailable = await checkCommandExists("tar");
    log.info(
      `[backup] Available commands: zip=${zipAvailable}, tar=${tarAvailable}`,
    );

    const srcStat = await fsp.stat(src).catch(() => null);
    if (!srcStat || !srcStat.isDirectory())
      throw new Error(`Source not found: ${src}`);
    await ensureDir(dstRoot);
    await moveOldBackups(dstRoot, name, 7);
    await ensureDir(tmpFolder);
    await copyTreeFiltered(src, tmpFolder, patterns);
    await copyProfile(profile, tmpFolder);
    const finalZipTmp = await zipFolder(
      tmpFolder,
      zipOutTmp,
      archiveType,
      compressionLevel,
    );
    const finalZipDst = path.join(dstRoot, path.basename(finalZipTmp));
    await fsp.rename(finalZipTmp, finalZipDst).catch(async () => {
      await fsp.copyFile(finalZipTmp, finalZipDst);
      await fsp.unlink(finalZipTmp);
    });
    log.info(`[backup] Backup completed successfully for program: ${name}`);
    return { zipPath: finalZipDst };
  } catch (error) {
    log.error(
      `[backup] Backup failed for program: ${name} - ${error?.message || error}`,
    );
    throw error;
  } finally {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`[backup] Backup for '${name}' finished in ${elapsedSec}s`);

    // Enhanced cleanup - remove both temp folder and temp archive
    try {
      // Clean temp folder
      const tmpFolderExists = await fsp
        .stat(tmpFolder)
        .then(() => true)
        .catch(() => false);
      if (tmpFolderExists) {
        const remainingFiles = await fsp.readdir(tmpFolder).catch(() => []);
        if (remainingFiles.length > 0) {
          log.warn(
            `[backup] Temporary backup folder '${tmpFolder}' not empty before deletion. Remaining files: ${remainingFiles.join(", ")}`,
          );
        }
        await fsp.rm(tmpFolder, { recursive: true, force: true });
        log.info(`[backup] Temporary folder cleaned: ${tmpFolder}`);
      }

      // Clean temp archive file if it exists
      const zipTmpExists = await fsp
        .stat(zipOutTmp)
        .then(() => true)
        .catch(() => false);
      if (zipTmpExists) {
        await fsp.unlink(zipOutTmp).catch(() => {});
        log.info(`[backup] Temporary archive cleaned: ${zipOutTmp}`);
      }
    } catch (cleanupError) {
      log.warn(`[backup] Cleanup error: ${cleanupError.message}`);
    }
  }
}

async function runBackupBatch(programs, parallel = false) {
  log.info("[backup] Starting batch backup for programs");
  const results = [];
  const chunkSize = 7;
  if (parallel) {
    if (programs.length > chunkSize) {
      for (let i = 0; i < programs.length; i += chunkSize) {
        const chunk = programs.slice(i, i + chunkSize);
        const promises = chunk.map((p) => {
          log.info(`[backup] Starting backup for program: ${p.name}`);
          return runBackup(p)
            .then((r) => ({ name: p.name, success: true, ...r }))
            .catch((e) => {
              log.error(
                `[backup] Backup failed for program: ${p?.name || "unknown"} - ${e?.message || String(e)}`,
              );
              return {
                name: p?.name || "unknown",
                success: false,
                error: e?.message || String(e),
              };
            });
        });
        const settled = await Promise.allSettled(promises);
        for (const res of settled) {
          if (res.status === "fulfilled") {
            results.push(res.value);
          } else {
            results.push({
              name: "unknown",
              success: false,
              error: res.reason?.message || String(res.reason),
            });
            log.error(
              `[backup] Backup failed with unexpected error: ${res.reason?.message || String(res.reason)}`,
            );
          }
        }
      }
    } else {
      const promises = programs.map((p) => {
        log.info(`[backup] Starting backup for program: ${p.name}`);
        return runBackup(p)
          .then((r) => ({ name: p.name, success: true, ...r }))
          .catch((e) => {
            log.error(
              `[backup] Backup failed for program: ${p?.name || "unknown"} - ${e?.message || String(e)}`,
            );
            return {
              name: p?.name || "unknown",
              success: false,
              error: e?.message || String(e),
            };
          });
      });
      const settled = await Promise.allSettled(promises);
      for (const res of settled) {
        if (res.status === "fulfilled") {
          results.push(res.value);
        } else {
          results.push({
            name: "unknown",
            success: false,
            error: res.reason?.message || String(res.reason),
          });
          log.error(
            `[backup] Backup failed with unexpected error: ${res.reason?.message || String(res.reason)}`,
          );
        }
      }
    }
  } else {
    for (const p of programs) {
      log.info(`[backup] Starting backup for program: ${p.name}`);
      try {
        const r = await runBackup(p);
        results.push({ name: p.name, success: true, ...r });
      } catch (e) {
        log.error(
          `[backup] Backup failed for program: ${p?.name || "unknown"} - ${e?.message || String(e)}`,
        );
        results.push({
          name: p?.name || "unknown",
          success: false,
          error: e?.message || String(e),
        });
      }
    }
  }
  // Итоговое логирование после выполнения всех задач
  const ok = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success).length;
  log.info(
    `[backup] Batch complete: ${ok} successful, ${fail} failed out of ${results.length}`,
  );
  return results;
}

async function chooseDir(mainWindow) {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled) return null;
  return res.filePaths && res.filePaths[0] ? res.filePaths[0] : null;
}

async function openPath(input) {
  if (!input) return { success: false, error: "No path" };
  let folder, profileName;

  if (typeof input === "string") {
    folder = input;
  } else if (typeof input === "object") {
    folder = input.folder;
    profileName = input.profileName;
  }

  if (!folder) return { success: false, error: "No folder specified" };

  const st = await fsp.stat(folder).catch(() => null);
  if (!st) return { success: false, error: "Path not found" };

  // Если указан profileName — ищем последний архив этого профиля
  if (profileName && st.isDirectory()) {
    try {
      const entries = await fsp.readdir(folder, { withFileTypes: true });
      const prefix = `${profileName}_Backup_`;
      const archives = entries
        .filter(
          (e) =>
            e.isFile() &&
            e.name.startsWith(prefix) &&
            (e.name.endsWith(".zip") || e.name.endsWith(".tar.gz")),
        )
        .map((e) => path.join(folder, e.name));

      if (archives.length > 0) {
        let latest = null;
        for (const arch of archives) {
          const stz = await fsp.stat(arch);
          if (!latest || stz.mtimeMs > latest.mtimeMs)
            latest = { file: arch, mtimeMs: stz.mtimeMs };
        }
        if (latest) {
          shell.showItemInFolder(latest.file);
          return { success: true, revealed: latest.file };
        }
      }
    } catch (err) {
      log.warn(
        `[backup] Failed to find latest archive for '${profileName}': ${err?.message || err}`,
      );
    }
  }

  // Если не найден архив — открыть сам путь
  if (st.isDirectory()) {
    await shell.openPath(folder);
  } else {
    shell.showItemInFolder(folder);
  }
  return { success: true };
}

module.exports = {
  getConfigPath,
  readPrograms,
  savePrograms,
  listLastTimes,
  runBackup,
  runBackupBatch,
  chooseDir,
  openPath,
  checkCommandExists,
  getFreeDiskSpace,
  normalizePath,
  prepareLongPath,
  preFlightChecks,
  preFlightChecksDetailed,
};
