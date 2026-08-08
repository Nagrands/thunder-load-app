"use strict";

const { spawn: spawnChild } = require("child_process");
const treeKill = require("tree-kill");
const { createCorrelationId } = require("./diagnosticsLogger");

const DEFAULT_TERMINATE_GRACE_MS = 2000;

function inferTool(command) {
  const value = String(command || "").toLowerCase();
  if (value.includes("yt-dlp")) return "yt-dlp";
  if (value.includes("ffprobe")) return "ffprobe";
  if (value.includes("ffmpeg")) return "FFmpeg";
  return "process";
}

function killProcessTree(child, signal) {
  return new Promise((resolve) => {
    if (!child?.pid || child.exitCode !== null) {
      resolve(false);
      return;
    }
    treeKill(child.pid, signal, () => resolve(true));
  });
}

class ProcessSupervisor {
  constructor({
    spawnImpl = spawnChild,
    terminateGraceMs = DEFAULT_TERMINATE_GRACE_MS,
    killTree = killProcessTree,
  } = {}) {
    this.spawnImpl = spawnImpl;
    this.terminateGraceMs = terminateGraceMs;
    this.killTree = killTree;
    this.entries = new Map();
    this.logger = null;
  }

  setLogger(logger) {
    this.logger = logger || null;
  }

  spawn(command, args = [], options = {}, metadata = {}) {
    const tool = metadata.tool || inferTool(command);
    const owner = metadata.owner || "Main";
    const correlationId = metadata.correlationId || createCorrelationId(tool.toLowerCase());
    const startedAt = Date.now();
    const child = this.spawnImpl(command, args, options);
    const entry = { child, command, tool, owner, correlationId, startedAt, timeout: null, abortCleanup: null };
    const processLogger = this.logger?.createScope?.(
      ["FFmpeg", "yt-dlp"].includes(tool) ? tool : owner,
    );
    this.entries.set(child, entry);
    processLogger?.info("child-process-started", { owner, tool, correlationId, pid: child.pid });

    const cleanup = (code, signal) => {
      if (!this.entries.delete(child)) return;
      if (entry.timeout) clearTimeout(entry.timeout);
      entry.abortCleanup?.();
      processLogger?.info("child-process-finished", {
        owner,
        tool,
        correlationId,
        pid: child.pid,
        code,
        signal,
        duration: Date.now() - startedAt,
      });
    };
    child.once?.("close", cleanup);
    child.once?.("error", (error) => {
      processLogger?.error("child-process-error", { owner, tool, correlationId, error });
    });

    if (Number.isFinite(metadata.timeoutMs) && metadata.timeoutMs > 0) {
      entry.timeout = setTimeout(() => {
        processLogger?.warning("child-process-timeout", { owner, tool, correlationId, pid: child.pid });
        void this.terminate(child, { reason: "timeout" });
      }, metadata.timeoutMs);
      entry.timeout.unref?.();
    }
    if (metadata.signal) {
      const onAbort = () => void this.terminate(child, { reason: "aborted" });
      if (metadata.signal.aborted) onAbort();
      else metadata.signal.addEventListener("abort", onAbort, { once: true });
      entry.abortCleanup = () => metadata.signal.removeEventListener("abort", onAbort);
    }
    return child;
  }

  execFile(command, args = [], options = {}, metadata = {}) {
    const maxBuffer = Number(options.maxBuffer) || 10 * 1024 * 1024;
    const encoding = options.encoding || "utf8";
    const child = this.spawn(
      command,
      args,
      { ...options, stdio: ["ignore", "pipe", "pipe"] },
      { ...metadata, timeoutMs: metadata.timeoutMs || options.timeout },
    );
    return new Promise((resolve, reject) => {
      const stdout = [];
      const stderr = [];
      let totalBytes = 0;
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const collect = (target) => (chunk) => {
        const buffer = Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > maxBuffer) {
          const error = Object.assign(new Error("Process output exceeded maxBuffer"), {
            code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
          });
          void this.terminate(child, { reason: "max-buffer" });
          finish(reject, error);
          return;
        }
        target.push(buffer);
      };
      child.stdout?.on?.("data", collect(stdout));
      child.stderr?.on?.("data", collect(stderr));
      child.once?.("error", (error) => finish(reject, error));
      child.once?.("close", (code, signal) => {
        const stdoutValue = Buffer.concat(stdout).toString(encoding);
        const stderrValue = Buffer.concat(stderr).toString(encoding);
        if (code === 0) {
          finish(resolve, { stdout: stdoutValue, stderr: stderrValue });
          return;
        }
        const error = Object.assign(
          new Error(stderrValue.trim() || `Process exited with code ${code}`),
          { code, signal, stdout: stdoutValue, stderr: stderrValue },
        );
        finish(reject, error);
      });
    });
  }

  async terminate(child, { reason = "shutdown" } = {}) {
    const entry = this.entries.get(child);
    if (!child || child.exitCode !== null) return false;
    this.logger?.createScope?.(
      ["FFmpeg", "yt-dlp"].includes(entry?.tool) ? entry.tool : entry?.owner || "Main",
    )?.info("child-process-stopping", {
      owner: entry?.owner,
      tool: entry?.tool,
      correlationId: entry?.correlationId,
      pid: child.pid,
      reason,
    });
    await this.killTree(child, "SIGTERM");
    if (child.exitCode !== null) return true;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, this.terminateGraceMs);
      child.once?.("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (child.exitCode === null) {
      await this.killTree(child, "SIGKILL");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, Math.min(500, this.terminateGraceMs));
        child.once?.("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    return true;
  }

  async terminateAll(reason = "shutdown") {
    const children = [...this.entries.keys()];
    await Promise.all(children.map((child) => this.terminate(child, { reason })));
    return children.length;
  }

  getSnapshot() {
    return [...this.entries.values()].map((entry) => ({
      owner: entry.owner,
      tool: entry.tool,
      correlationId: entry.correlationId,
      pid: entry.child.pid,
      startedAt: entry.startedAt,
    }));
  }
}

const processSupervisor = new ProcessSupervisor();

module.exports = {
  DEFAULT_TERMINATE_GRACE_MS,
  ProcessSupervisor,
  inferTool,
  processSupervisor,
};
