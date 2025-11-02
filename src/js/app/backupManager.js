// src/js/app/backupManager.js
// Main-process helper for Backup tab logic
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const { app, dialog, shell } = require("electron");
const log = require("electron-log");
const { promisify } = require("util");
const { execFile } = require("child_process");
const execFileAsync = promisify(execFile);

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
  await fsp.mkdir(dir, { recursive: true });
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
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fsp.access(src, fs.constants.R_OK);
      await fsp.copyFile(src, dst);
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
      const zips = entries
        .filter(
          (e) =>
            e.isFile() && e.name.startsWith(prefix) && e.name.endsWith(".zip"),
        )
        .map((e) => path.join(dir, e.name));
      let latest = null;
      for (const z of zips) {
        const st = await fsp.stat(z);
        if (!latest || st.mtimeMs > latest.mtimeMs)
          latest = { file: z, mtimeMs: st.mtimeMs };
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
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(srcDir, entry.name);
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
  const st = await fsp.stat(src);
  if (!st.isDirectory()) throw new Error(`Source is not a directory: ${src}`);
  const stack = [""]; // relative paths
  while (stack.length) {
    const rel = stack.pop();
    const curSrc = path.join(src, rel);
    const curDst = path.join(dst, rel);
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
    const st = await fsp.stat(profilePath);
    if (!st.isDirectory()) return;
    const dst = path.join(dstRoot, "Profiles");
    await copyDir(profilePath, dst);
  } catch (_) {}
}

async function copyDir(src, dst) {
  const st = await fsp.stat(src);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${src}`);
  await ensureDir(dst);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await ensureDir(path.dirname(d));
      await copyFileWithRetry(s, d); // Use retry helper
    }
  }
}

async function zipFolder(folderPath, zipPath) {
  const platform = process.platform;
  if (platform === "win32") {
    // Use PowerShell Compress-Archive
    const ps = "powershell.exe";
    const args = [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath '${folderPath.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ];
    await execFileAsync(ps, args, { windowsHide: true });
  } else {
    // Try zip -r
    try {
      await execFileAsync("zip", ["-r", zipPath, path.basename(folderPath)], {
        cwd: path.dirname(folderPath),
      });
    } catch (e) {
      // fallback: create tar.gz (different extension)
      const tgz = zipPath.replace(/\.zip$/i, ".tar.gz");
      await execFileAsync("tar", ["-czf", tgz, path.basename(folderPath)], {
        cwd: path.dirname(folderPath),
      });
      return tgz;
    }
  }
  return zipPath;
}

async function moveOldBackups(backupDir, programName, keep = 7) {
  try {
    const entries = await fsp.readdir(backupDir, { withFileTypes: true });
    const prefix = `${programName}_Backup_`;
    const targets = [];
    for (const e of entries) {
      if (e.isFile() && e.name.startsWith(prefix) && e.name.endsWith(".zip")) {
        const full = path.join(backupDir, e.name);
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

async function runBackup(program) {
  const name = program?.name;
  const src = program?.source_path;
  const dstRoot = program?.backup_path;
  const profile = program?.profile_path || null;
  const patterns = Array.isArray(program?.config_patterns)
    ? program.config_patterns
    : [];
  if (!name || !src || !dstRoot) throw new Error("Invalid program config");
  log.info(`[backup] Starting backup for program: ${name}`);
  const ts = new Date();
  const timestamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}_${String(ts.getHours()).padStart(2, "0")}-${String(ts.getMinutes()).padStart(2, "0")}-${String(ts.getSeconds()).padStart(2, "0")}`;
  const tmpFolder = path.join(os.tmpdir(), `${name}_Backup_${timestamp}`);

  const { available } = (await fsp.statvfs?.(dstRoot).catch(() => ({}))) || {};
  try {
    const diskInfo = await fsp.statvfs?.(dstRoot);
    if (diskInfo && diskInfo.f_bavail && diskInfo.f_bsize) {
      const freeMB = Math.round(
        (diskInfo.f_bavail * diskInfo.f_bsize) / 1024 / 1024,
      );
      if (freeMB < 500) {
        log.warn(
          `[backup] Low disk space detected at '${dstRoot}': only ${freeMB} MB available`,
        );
      }
    }
  } catch {
    // fallback for platforms without statvfs
    const freeSpace = os.freemem?.()
      ? Math.round(os.freemem() / 1024 / 1024)
      : null;
    if (freeSpace && freeSpace < 500) {
      log.warn(`[backup] System memory low, only ${freeSpace} MB free`);
    }
  }
  const startTime = Date.now();

  try {
    const srcStat = await fsp.stat(src).catch(() => null);
    if (!srcStat || !srcStat.isDirectory())
      throw new Error(`Source not found: ${src}`);
    await ensureDir(dstRoot);
    await moveOldBackups(dstRoot, name, 7);
    await ensureDir(tmpFolder);
    await copyTreeFiltered(src, tmpFolder, patterns);
    await copyProfile(profile, tmpFolder);
    const zipOutTmp = path.join(os.tmpdir(), `${name}_Backup_${timestamp}.zip`);
    const finalZipTmp = await zipFolder(tmpFolder, zipOutTmp);
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
    try {
      const exists = await fsp
        .stat(tmpFolder)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const remainingFiles = await fsp.readdir(tmpFolder);
        if (remainingFiles.length > 0) {
          log.warn(
            `[backup] Temporary backup folder '${tmpFolder}' not empty before deletion. Remaining files: ${remainingFiles.join(", ")}`,
          );
        }
        log.warn(
          `[backup] Temporary backup folder '${tmpFolder}' will be removed.`,
        );
        await fsp.rm(tmpFolder, { recursive: true, force: true });
      }
    } catch (_) {}
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
      const zips = entries
        .filter(
          (e) =>
            e.isFile() && e.name.startsWith(prefix) && e.name.endsWith(".zip"),
        )
        .map((e) => path.join(folder, e.name));

      if (zips.length > 0) {
        let latest = null;
        for (const z of zips) {
          const stz = await fsp.stat(z);
          if (!latest || stz.mtimeMs > latest.mtimeMs)
            latest = { file: z, mtimeMs: stz.mtimeMs };
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
};
