// src/js/app/backupManager.js
// Main-process helper for Backup tab logic
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { app, dialog, shell } = require('electron');
const log = require('electron-log');
const { promisify } = require('util');
const { execFile } = require('child_process');
const execFileAsync = promisify(execFile);

function getUserDataDir() {
  try { return app.getPath('userData'); } catch (_) { return path.join(os.homedir(), '.thunder-load'); }
}

function getBackupRoot() {
  return path.join(getUserDataDir(), 'backup');
}

function getConfigPath() {
  return path.join(getBackupRoot(), 'config.json');
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function wildcardToRegex(pattern) {
  // Very simple glob → regex: supports * and ? on filename only
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchByPatterns(fileName, patterns) {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return true;
  return patterns.some((p) => wildcardToRegex(p).test(fileName));
}

async function readPrograms() {
  try {
    const p = getConfigPath();
    await ensureDir(path.dirname(p));
    const raw = await fsp.readFile(p, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.programs) ? data.programs : [];
  } catch (e) {
    return [];
  }
}

async function savePrograms(programs) {
  const p = getConfigPath();
  await ensureDir(path.dirname(p));
  const payload = { programs: Array.isArray(programs) ? programs : [] };
  await fsp.writeFile(p, JSON.stringify(payload, null, 2), 'utf-8');
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
        .filter((e) => e.isFile() && e.name.startsWith(prefix) && e.name.endsWith('.zip'))
        .map((e) => path.join(dir, e.name));
      let latest = null;
      for (const z of zips) {
        const st = await fsp.stat(z);
        if (!latest || st.mtimeMs > latest.mtimeMs) latest = { file: z, mtimeMs: st.mtimeMs };
      }
      if (latest) result[name] = latest.mtimeMs;
    } catch (_) {}
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
  const stack = ['']; // relative paths
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
          await fsp.copyFile(srcPath, dstPath);
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
    const dst = path.join(dstRoot, 'Profiles');
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
      await fsp.copyFile(s, d);
    }
  }
}

async function zipFolder(folderPath, zipPath) {
  const platform = process.platform;
  if (platform === 'win32') {
    // Use PowerShell Compress-Archive
    const ps = 'powershell.exe';
    const args = [
      '-NoProfile',
      '-Command',
      `Compress-Archive -LiteralPath '${folderPath.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ];
    await execFileAsync(ps, args, { windowsHide: true });
  } else {
    // Try zip -r
    try {
      await execFileAsync('zip', ['-r', zipPath, path.basename(folderPath)], { cwd: path.dirname(folderPath) });
    } catch (e) {
      // fallback: create tar.gz (different extension)
      const tgz = zipPath.replace(/\.zip$/i, '.tar.gz');
      await execFileAsync('tar', ['-czf', tgz, path.basename(folderPath)], { cwd: path.dirname(folderPath) });
      return tgz;
    }
  }
  return zipPath;
}

async function moveOldBackups(backupDir, programName, keep = 5) {
  try {
    const entries = await fsp.readdir(backupDir, { withFileTypes: true });
    const prefix = `${programName}_Backup_`;
    const targets = [];
    for (const e of entries) {
      if (e.isFile() && e.name.startsWith(prefix) && e.name.endsWith('.zip')) {
        const full = path.join(backupDir, e.name);
        const st = await fsp.stat(full);
        targets.push({ file: full, mtimeMs: st.mtimeMs });
      }
    }
    targets.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (targets.length > keep) {
      const archiveDir = path.join(backupDir, '_archive');
      await ensureDir(archiveDir);
      for (const t of targets.slice(keep)) {
        const dest = path.join(archiveDir, path.basename(t.file));
        await fsp.rename(t.file, dest).catch(async () => {
          // fallback to copy+unlink
          await fsp.copyFile(t.file, dest);
          await fsp.unlink(t.file);
        });
      }
    }
  } catch (e) {
    log.warn('[backup] moveOldBackups error:', e?.message || e);
  }
}

async function runBackup(program) {
  const name = program?.name;
  const src = program?.source_path;
  const dstRoot = program?.backup_path;
  const profile = program?.profile_path || null;
  const patterns = Array.isArray(program?.config_patterns) ? program.config_patterns : [];
  if (!name || !src || !dstRoot) throw new Error('Invalid program config');
  log.info(`[backup] Starting backup for program: ${name}`);
  const ts = new Date();
  const timestamp = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}-${String(ts.getMinutes()).padStart(2,'0')}-${String(ts.getSeconds()).padStart(2,'0')}`;
  const tmpFolder = path.join(dstRoot, `${name}_Backup_${timestamp}`);
  try {
    const srcStat = await fsp.stat(src).catch(() => null);
    if (!srcStat || !srcStat.isDirectory()) throw new Error(`Source not found: ${src}`);
    await ensureDir(dstRoot);
    await moveOldBackups(dstRoot, name, 5);
    await ensureDir(tmpFolder);
    await copyTreeFiltered(src, tmpFolder, patterns);
    await copyProfile(profile, tmpFolder);
    const zipOut = path.join(dstRoot, `${name}_Backup_${timestamp}.zip`);
    const finalZip = await zipFolder(tmpFolder, zipOut);
    log.info(`[backup] Backup completed successfully for program: ${name}`);
    return { zipPath: finalZip };
  } catch (error) {
    log.error(`[backup] Backup failed for program: ${name} - ${error?.message || error}`);
    throw error;
  } finally {
    try { await fsp.rm(tmpFolder, { recursive: true, force: true }); } catch (_) {}
  }
}

async function runBackupBatch(programs) {
  log.info('[backup] Starting batch backup for programs');
  const results = [];
  for (const p of programs) {
    log.info(`[backup] Starting backup for program: ${p.name}`);
    try {
      const r = await runBackup(p);
      results.push({ name: p.name, success: true, ...r });
    } catch (e) {
      log.error(`[backup] Backup failed for program: ${p?.name || 'unknown'} - ${e?.message || String(e)}`);
      results.push({ name: p?.name || 'unknown', success: false, error: e?.message || String(e) });
    }
  }
  return results;
}

async function chooseDir(mainWindow) {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled) return null;
  return res.filePaths && res.filePaths[0] ? res.filePaths[0] : null;
}

async function openPath(p) {
  if (!p) return { success: false, error: 'No path' };
  const st = await fsp.stat(p).catch(() => null);
  if (!st) return { success: false, error: 'Path not found' };
  if (st.isDirectory()) {
    await shell.openPath(p);
  } else {
    shell.showItemInFolder(p);
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
