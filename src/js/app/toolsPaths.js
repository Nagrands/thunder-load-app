// src/js/app/toolsPaths.js
// Централизованная работа с путями для инструментов yt-dlp и ffmpeg
// Работает в главном процессе Electron

/**
 * ВАЖНО: модуль не лезет в UI/IPC —
 * только вычисляет пути, гарантирует существование каталога,
 * проверяет наличие бинарников и (опционально) мигрирует из "старых" мест.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const TOOLS_KEY = 'tools.dir'; // ключ настроек для кастомной папки инструментов
const TOOL_NAMES = /** @type {const} */ (['yt-dlp', 'ffmpeg']);

/**
 * Возвращает имя исполняемого файла под платформу
 * @param {('yt-dlp'|'ffmpeg')} tool
 */
function getExecName(tool) {
  const base = tool;
  if (process.platform === 'win32') return `${base}.exe`;
  return base;
}

/**
 * Путь по умолчанию (переживает обновления приложения):
 *   userData/tools
 * macOS: ~/Library/Application Support/<App Name>/tools
 * Windows: %APPDATA%/<App Name>/tools
 */
function getDefaultToolsDir() {
  return path.join(app.getPath('userData'), 'tools');
}

/**
 * Нормализует путь к каталогу (убирает трailing слеши и т.п.)
 * @param {string} dir
 */
function normalizeDir(dir) {
  // expand ~ на *nix
  if (dir && dir.startsWith('~')) dir = path.join(os.homedir(), dir.slice(1));
  return path.resolve(dir);
}

/**
 * Чтение пользовательского пути инструментов из стора/настроек.
 * @param {{get?: Function}|((key:string)=>string|undefined)|null} storeOrGetter
 */
function readCustomDir(storeOrGetter) {
  try {
    if (!storeOrGetter) return undefined;
    if (typeof storeOrGetter === 'function') return storeOrGetter(TOOLS_KEY) || undefined;
    if (typeof storeOrGetter.get === 'function') return storeOrGetter.get(TOOLS_KEY) || undefined;
  } catch {}
  return undefined;
}

/**
 * Эффективный каталог инструментов: кастомный или дефолтный
 * @param {{get?: Function}|((key:string)=>string|undefined)|null} storeOrGetter
 */
function getEffectiveToolsDir(storeOrGetter) {
  const custom = readCustomDir(storeOrGetter);
  return custom ? normalizeDir(String(custom)) : getDefaultToolsDir();
}

/**
 * Гарантирует существование каталога инструментов
 * @param {string} dir
 */
async function ensureToolsDir(dir) {
  const target = normalizeDir(dir);
  await fsp.mkdir(target, { recursive: true });
  return target;
}

/**
 * Абсолютный путь к бинарнику инструмента в выбранной папке
 * @param {('yt-dlp'|'ffmpeg')} tool
 * @param {string} dir
 */
function resolveToolPath(tool, dir) {
  return path.join(normalizeDir(dir), getExecName(tool));
}

/**
 * Проверка наличия бинарника и исполнимости (где это применимо)
 * @param {('yt-dlp'|'ffmpeg')} tool
 * @param {string} dir
 */
async function isToolPresent(tool, dir) {
  const file = resolveToolPath(tool, dir);
  try {
    await fsp.access(file, fs.constants.F_OK);
    // Доп.проверка исполнимости на *nix
    if (process.platform !== 'win32') {
      await fsp.access(file, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Кандидаты "наследованных" локаций, откуда можно перенести инструменты
 * (старые сборки могли класть рядом с ресурсами/в корень)
 */
function legacyCandidates() {
  const candidates = new Set();
  const exeDir = path.dirname(app.getPath('exe'));
  const appPath = app.getAppPath();
  const resPath = process.resourcesPath;

  const possible = [
    // Рядом с exe / приложением
    exeDir,
    path.join(exeDir, 'bin'),
    appPath,
    path.join(appPath, 'bin'),
    // В ресурсах
    resPath,
    path.join(resPath, 'bin'),
    path.join(resPath, 'app.asar.unpacked', 'bin'),
    // Рабочая директория
    process.cwd(),
    path.join(process.cwd(), 'bin'),
  ];

  for (const p of possible) candidates.add(p);
  return Array.from(candidates);
}

/**
 * Ищет старые установки инструментов и возвращает найденные пути
 * @returns {Promise<{dir:string, tools:Partial<Record<'yt-dlp'|'ffmpeg', string>>}[]>}
 */
async function detectLegacyLocations() {
  const out = [];
  for (const dir of legacyCandidates()) {
    const tools = {};
    for (const t of TOOL_NAMES) {
      const file = path.join(dir, getExecName(t));
      try {
        await fsp.access(file, fs.constants.F_OK);
        tools[t] = file;
      } catch {}
    }
    if (Object.keys(tools).length) out.push({ dir, tools });
  }
  return out;
}

/**
 * Копирует найденные старые бинарники в новый каталог
 * @param {string} toDir
 * @param {{overwrite?: boolean}} [opts]
 * @returns {Promise<{copied: string[], skipped: string[]}>}
 */
async function migrateLegacy(toDir, opts = {}) {
  const overwrite = !!opts.overwrite;
  const targetDir = await ensureToolsDir(toDir);
  const found = await detectLegacyLocations();
  const copied = []; const skipped = [];

  for (const loc of found) {
    for (const t of TOOL_NAMES) {
      const src = loc.tools[t];
      if (!src) continue;
      const dst = resolveToolPath(t, targetDir);
      try {
        if (!overwrite) {
          // если уже есть — пропускаем
          await fsp.access(dst, fs.constants.F_OK);
          skipped.push(dst);
          continue;
        }
      } catch {
        // файла нет — можно копировать
      }
      await fsp.copyFile(src, dst);
      if (process.platform !== 'win32') {
        try { await fsp.chmod(dst, 0o755); } catch {}
      }
      copied.push(dst);
    }
  }
  return { copied, skipped };
}

module.exports = {
  TOOLS_KEY,
  getDefaultToolsDir,
  getEffectiveToolsDir,
  ensureToolsDir,
  resolveToolPath,
  isToolPresent,
  detectLegacyLocations,
  migrateLegacy,
  getExecName,
  normalizeDir,
};