const fs = require("fs");
const path = require("path");

const { getEffectiveToolsDir, getExecName } = require("./toolsPaths");

const DEPENDENCY_IDS = Object.freeze(["ytDlp", "ffmpeg", "deno"]);
const DEPENDENCY_ACTIONS = Object.freeze(["install", "update", "reinstall"]);

const TOOL_NAMES = Object.freeze({
  ytDlp: "yt-dlp",
  ffmpeg: "ffmpeg",
  deno: "deno",
});

function normalizeDependencyActionPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const id = String(payload.id || "");
  const action = String(payload.action || "");
  if (!DEPENDENCY_IDS.includes(id) || !DEPENDENCY_ACTIONS.includes(action)) {
    return null;
  }
  return { id, action };
}

function getDependencyPaths(id, store) {
  const toolsDir = getEffectiveToolsDir(store);
  const executable = path.join(toolsDir, getExecName(TOOL_NAMES[id]));
  if (id !== "ffmpeg") return [executable];
  return [
    executable,
    path.join(toolsDir, process.platform === "win32" ? "ffprobe.exe" : "ffprobe"),
  ];
}

function readToolVersion(versions, id) {
  const value = versions?.[id]?.version;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isVerifiedTarget(versions, id, targetPath) {
  const installed = versions?.[id];
  if (
    !installed?.ok ||
    typeof installed.path !== "string" ||
    !readToolVersion(versions, id)
  ) {
    return false;
  }
  return path.resolve(installed.path) === path.resolve(targetPath);
}

function createDependencyActions({
  store,
  installYtDlp,
  installFfmpeg,
  installDeno,
  getToolsVersions,
  log = console,
}) {
  const installers = {
    ytDlp: installYtDlp,
    ffmpeg: installFfmpeg,
    deno: installDeno,
  };
  const inFlight = new Map();

  const runInstaller = async (id, targetPaths) => {
    if (id === "ytDlp") {
      const targetPath = targetPaths[0];
      const temporaryPath = `${targetPath}.install-${Date.now()}`;
      try {
        await installYtDlp({ targetPath: temporaryPath });
        await fs.promises.rename(temporaryPath, targetPath);
      } finally {
        await fs.promises.unlink(temporaryPath).catch(() => {});
      }
      return;
    }
    await installers[id]();
  };

  const execute = async ({ id, action }) => {
    const targetPaths = getDependencyPaths(id, store);
    const existingPaths = targetPaths.filter((targetPath) =>
      fs.existsSync(targetPath),
    );

    if (action === "install" && existingPaths.length) {
      const versions = await getToolsVersions(store);
      if (isVerifiedTarget(versions, id, targetPaths[0])) {
        return {
          success: true,
          toolId: id,
          version: readToolVersion(versions, id),
        };
      }
    }

    const backups = [];
    try {
      for (const targetPath of existingPaths) {
        const backupPath = `${targetPath}.backup-${Date.now()}-${backups.length}`;
        await fs.promises.rename(targetPath, backupPath);
        backups.push({ targetPath, backupPath });
      }

      await runInstaller(id, targetPaths);
      const versions = await getToolsVersions(store);
      if (!isVerifiedTarget(versions, id, targetPaths[0])) {
        throw new Error(`${TOOL_NAMES[id]} version verification failed`);
      }

      await Promise.all(
        backups.map(({ backupPath }) =>
          fs.promises.unlink(backupPath).catch(() => {}),
        ),
      );
      return {
        success: true,
        toolId: id,
        version: readToolVersion(versions, id),
      };
    } catch (error) {
      await Promise.all(
        targetPaths.map((targetPath) =>
          fs.promises.unlink(targetPath).catch(() => {}),
        ),
      );
      for (const { targetPath, backupPath } of backups.reverse()) {
        if (fs.existsSync(backupPath)) {
          await fs.promises.rename(backupPath, targetPath).catch(() => {});
        }
      }
      log.error?.(`[dependencyActions] ${action} ${id} failed`);
      return {
        success: false,
        toolId: id,
        error: error?.message || String(error),
      };
    }
  };

  const run = async (payload) => {
    const normalized = normalizeDependencyActionPayload(payload);
    if (!normalized) {
      return { success: false, error: "Invalid dependency action payload" };
    }
    if (
      normalized.id === "ffmpeg" &&
      normalized.action === "update" &&
      process.platform === "darwin"
    ) {
      return {
        success: false,
        toolId: "ffmpeg",
        error: "ffmpeg update is unavailable on macOS; use reinstall",
      };
    }
    const key = normalized.id;
    if (inFlight.has(key)) return inFlight.get(key);
    const operation = execute(normalized).finally(() => inFlight.delete(key));
    inFlight.set(key, operation);
    return operation;
  };

  return { run };
}

module.exports = {
  DEPENDENCY_ACTIONS,
  DEPENDENCY_IDS,
  createDependencyActions,
  normalizeDependencyActionPayload,
};
