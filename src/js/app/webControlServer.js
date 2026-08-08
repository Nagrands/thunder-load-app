"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { shell } = require("electron");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const { serializeError } = require("./appError");

const HOST = "0.0.0.0";
const LOCAL_HOST = "127.0.0.1";
const DEFAULT_PORT = 0;
const REQUEST_TIMEOUT_MS = 8000;
const SPA_ROUTES = new Set(["/downloader", "/settings"]);
const STORE_KEYS = Object.freeze({
  enabled: "webControl.enabled",
  token: "webControl.token",
  port: "webControl.port",
});

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
});

function createJsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function createErrorResponse(res, statusCode, code, message, options = {}) {
  createJsonResponse(res, statusCode, {
    success: false,
    error: serializeError(new Error(message), {
      code,
      category: options.category || "web-control",
      retryable: Boolean(options.retryable),
      correlationId: options.correlationId,
    }),
  });
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) return DEFAULT_PORT;
  return port;
}

function normalizeToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{24,128}$/.test(token) ? token : "";
}

function ensureToken(store) {
  const existing = normalizeToken(store.get(STORE_KEYS.token, ""));
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  store.set(STORE_KEYS.token, token);
  return token;
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  Object.values(interfaces).forEach((entries = []) => {
    entries.forEach((entry = {}) => {
      if (entry.family !== "IPv4" || entry.internal || !entry.address) return;
      addresses.push(entry.address);
    });
  });
  return [...new Set(addresses)].sort();
}

function buildUrl(host, port) {
  return `http://${host}:${port}/`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function normalizePreviewUrl(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  if (!candidate || /\s/.test(candidate)) return "";

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function createWebControlServer({ appPath, store, diagnosticsLogger = null }) {
  let server = null;
  let mainWindow = null;
  let runningPort = 0;
  let requestCounter = 1;
  const pendingRequests = new Map();
  const eventClients = new Set();
  const eventClientTimers = new Map();
  let lifecycleOperation = Promise.resolve();
  let windowDestroyedCleanup = null;
  const webLog = diagnosticsLogger?.createScope?.("WebControl");

  const staticDir = path.join(appPath, "src", "web-control");

  function getUrl() {
    if (!runningPort) return "";
    return buildUrl(LOCAL_HOST, runningPort);
  }

  function getStatus() {
    const lanAddresses = runningPort ? getLanAddresses() : [];
    const lanUrls = lanAddresses.map((address) =>
      buildUrl(address, runningPort),
    );
    const localUrl = getUrl();
    return {
      enabled: store.get(STORE_KEYS.enabled, false) === true,
      running: Boolean(server && runningPort),
      host: HOST,
      localUrl,
      lanUrls,
      urls: {
        local: localUrl,
        lan: lanUrls,
      },
      port: runningPort || normalizePort(store.get(STORE_KEYS.port, 0)),
      url: lanUrls[0] || localUrl,
    };
  }

  function assertRendererReady() {
    if (!mainWindow || mainWindow.isDestroyed?.() || !mainWindow.webContents) {
      throw new Error("Renderer window is not available");
    }
  }

  function requestRenderer(command, payload = {}) {
    assertRendererReady();
    const requestId = `web-${Date.now()}-${requestCounter++}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        webLog?.warning("renderer-request-timeout", { requestId, command });
        reject(new Error("Renderer request timed out"));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(requestId, { resolve, reject, timeout });
      mainWindow.webContents.send(CHANNELS.WEB_RENDERER_REQUEST, {
        requestId,
        command,
        payload,
      });
    });
  }

  function rejectPendingRequests(code, message) {
    for (const [requestId, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      const error = Object.assign(new Error(message), {
        code,
        correlationId: requestId,
      });
      pending.reject(error);
    }
    pendingRequests.clear();
  }

  function resolveRendererResponse(payload = {}) {
    const requestId = String(payload.requestId || "");
    const pending = pendingRequests.get(requestId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    pendingRequests.delete(requestId);
    if (payload.success === false) {
      const rendererError =
        payload.error && typeof payload.error === "object"
          ? payload.error
          : { message: payload.error || "Renderer request failed" };
      pending.reject(
        Object.assign(new Error(rendererError.message), {
          code: rendererError.code || "RENDERER_REQUEST_FAILED",
          correlationId: rendererError.correlationId || requestId,
        }),
      );
      return true;
    }
    pending.resolve(payload.result);
    return true;
  }

  async function serveStatic(reqUrl, res) {
    const pathname =
      reqUrl.pathname === "/" || SPA_ROUTES.has(reqUrl.pathname)
        ? "/index.html"
        : reqUrl.pathname;
    const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(staticDir, normalized);
    const relative = path.relative(staticDir, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      createErrorResponse(res, 403, "FORBIDDEN", "Forbidden");
      return;
    }

    try {
      const content = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch {
      createErrorResponse(res, 404, "NOT_FOUND", "Not found");
    }
  }

  function broadcastEvent(event, data) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of eventClients) {
      client.write(frame);
    }
  }

  async function handleApi(req, res, reqUrl) {
    if (req.method === "GET" && reqUrl.pathname === "/api/status") {
      createJsonResponse(res, 200, { success: true, status: getStatus() });
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/state") {
      const state = await requestRenderer("snapshot");
      createJsonResponse(res, 200, { success: true, state });
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/settings") {
      const settings = await requestRenderer("settings:get");
      createJsonResponse(res, 200, { success: true, settings });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/action") {
      const body = await readRequestBody(req);
      const result = await requestRenderer(body.action, body.payload || {});
      broadcastEvent("state", result);
      createJsonResponse(res, 200, { success: true, result });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/preview") {
      const body = await readRequestBody(req);
      const url = normalizePreviewUrl(body.url);
      if (!url) {
        createErrorResponse(
          res,
          400,
          "INVALID_URL",
          "A single valid HTTP(S) URL is required",
        );
        return;
      }
      const preview = await requestRenderer("preview:get", { url });
      createJsonResponse(res, 200, { success: true, preview });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/settings") {
      const body = await readRequestBody(req);
      const result = await requestRenderer("settings:set", body || {});
      broadcastEvent("settings", result);
      createJsonResponse(res, 200, { success: true, result });
      return;
    }

    createErrorResponse(res, 404, "UNKNOWN_API", "Unknown API");
  }

  function handleEvents(req, res, _reqUrl) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("event: ready\ndata: {}\n\n");
    eventClients.add(res);
    const interval = setInterval(() => {
      requestRenderer("snapshot")
        .then((state) => {
          res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
        })
        .catch(() => {});
    }, 2000);
    eventClientTimers.set(res, interval);
    req.on("close", () => {
      clearInterval(interval);
      eventClients.delete(res);
      eventClientTimers.delete(res);
    });
  }

  async function handleRequest(req, res) {
    try {
      const reqUrl = new URL(req.url || "/", `http://${HOST}`);
      if (reqUrl.pathname === "/events") {
        handleEvents(req, res, reqUrl);
        return;
      }
      if (reqUrl.pathname.startsWith("/api/")) {
        await handleApi(req, res, reqUrl);
        return;
      }
      if (req.method !== "GET") {
        createErrorResponse(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
        return;
      }
      await serveStatic(reqUrl, res);
    } catch (error) {
      const correlationId = error?.correlationId || `web-${Date.now().toString(36)}`;
      webLog?.error("request-failed", {
        correlationId,
        method: req.method,
        path: req.url,
        error,
      });
      log.warn("[web-control] request failed:", error);
      createJsonResponse(res, 500, {
        success: false,
        error: serializeError(error, {
          code: "WEB_REQUEST_FAILED",
          category: "web-control",
          message: "Internal error",
          retryable: true,
          correlationId,
        }),
      });
    }
  }

  async function startInternal() {
    if (server) return getStatus();
    ensureToken(store);
    const preferredPort = normalizePort(store.get(STORE_KEYS.port, 0));
    const listen = (port) =>
      new Promise((resolve, reject) => {
        server = http.createServer(handleRequest);
        server.once("error", reject);
        server.listen(port, HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
    try {
      await listen(preferredPort);
    } catch (error) {
      if (preferredPort === 0 || error?.code !== "EADDRINUSE") {
        server = null;
        throw error;
      }
      log.warn(
        `[web-control] port ${preferredPort} is busy, falling back to a random port`,
      );
      server = null;
      await listen(0);
    }
    runningPort = server.address()?.port || 0;
    store.set(STORE_KEYS.port, runningPort);
    log.info(`[web-control] listening on ${HOST}:${runningPort}`);
    webLog?.info("server-started", { port: runningPort, host: HOST });
    return getStatus();
  }

  async function stopInternal() {
    rejectPendingRequests("WEB_CONTROL_STOPPED", "Web Control stopped");
    for (const interval of eventClientTimers.values()) clearInterval(interval);
    eventClientTimers.clear();
    if (!server) {
      runningPort = 0;
      return getStatus();
    }
    const currentServer = server;
    server = null;
    runningPort = 0;
    for (const client of eventClients) client.end();
    eventClients.clear();
    await new Promise((resolve) => currentServer.close(resolve));
    webLog?.info("server-stopped", {});
    return getStatus();
  }

  function runLifecycle(task) {
    const result = lifecycleOperation.then(task, task);
    lifecycleOperation = result.catch(() => {});
    return result;
  }

  function start() {
    return runLifecycle(startInternal);
  }

  function stop() {
    return runLifecycle(stopInternal);
  }

  function restart() {
    return runLifecycle(async () => {
      await stopInternal();
      return startInternal();
    });
  }

  async function setEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    store.set(STORE_KEYS.enabled, nextEnabled);
    return runLifecycle(() => (nextEnabled ? startInternal() : stopInternal()));
  }

  async function open() {
    const status = server ? getStatus() : await start();
    if (status.localUrl) await shell.openExternal(status.localUrl);
    return status;
  }

  function setMainWindow(nextMainWindow) {
    windowDestroyedCleanup?.();
    windowDestroyedCleanup = null;
    mainWindow = nextMainWindow;
    const webContents = nextMainWindow?.webContents;
    if (typeof webContents?.once === "function") {
      const onDestroyed = () => {
        if (mainWindow === nextMainWindow) mainWindow = null;
        rejectPendingRequests("RENDERER_UNAVAILABLE", "Renderer window was closed");
      };
      webContents.once("destroyed", onDestroyed);
      windowDestroyedCleanup = () => webContents.removeListener?.("destroyed", onDestroyed);
    }
  }

  async function dispose() {
    await stop();
    windowDestroyedCleanup?.();
    windowDestroyedCleanup = null;
    mainWindow = null;
  }

  async function startIfEnabled() {
    if (store.get(STORE_KEYS.enabled, false) === true) {
      return start();
    }
    return getStatus();
  }

  return {
    getStatus,
    setEnabled,
    restart,
    open,
    startIfEnabled,
    stop,
    setMainWindow,
    dispose,
    requestRenderer,
    resolveRendererResponse,
  };
}

module.exports = {
  createWebControlServer,
  STORE_KEYS,
  HOST,
  LOCAL_HOST,
  getLanAddresses,
};
