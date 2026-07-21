jest.mock("electron", () => ({
  shell: { openExternal: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const http = require("http");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { createWebControlServer, HOST } = require("../webControlServer");
const { CHANNELS } = require("../../ipc/channels");

jest.spyOn(os, "networkInterfaces").mockReturnValue({
  en0: [
    {
      address: "192.168.1.20",
      family: "IPv4",
      internal: false,
    },
  ],
  lo0: [
    {
      address: "127.0.0.1",
      family: "IPv4",
      internal: true,
    },
  ],
});

function createStore() {
  const data = new Map();
  return {
    get: jest.fn((key, defaultValue) =>
      data.has(key) ? data.get(key) : defaultValue,
    ),
    set: jest.fn((key, value) => {
      data.set(key, value);
    }),
  };
}

function createFakeHttpServer(handleRequest) {
  const fakeServer = new EventEmitter();
  fakeServer.handleRequest = handleRequest;
  fakeServer.listen = jest.fn((_port, _host, callback) => {
    callback();
    return fakeServer;
  });
  fakeServer.address = jest.fn(() => ({ port: 45123 }));
  fakeServer.close = jest.fn((callback) => callback());
  return fakeServer;
}

async function requestJson(fakeServer, url, options = {}) {
  const req = new EventEmitter();
  req.method = options.method || "GET";
  req.url = `${url.pathname}${url.search}`;
  req.headers = options.headers || {};
  req.setEncoding = jest.fn();
  req.destroy = jest.fn();

  const responseDone = new Promise((resolve) => {
    const res = {
      statusCode: 0,
      body: "",
      writeHead: jest.fn((statusCode) => {
        res.statusCode = statusCode;
      }),
      write: jest.fn((chunk) => {
        res.body += String(chunk);
      }),
      end: jest.fn((chunk = "") => {
        res.body += String(chunk);
        resolve({
          statusCode: res.statusCode,
          body: res.body ? JSON.parse(res.body) : null,
        });
      }),
    };
    void fakeServer.handleRequest(req, res);
  });

  queueMicrotask(() => {
    if (options.body) req.emit("data", JSON.stringify(options.body));
    req.emit("end");
  });
  return responseDone;
}

async function requestRaw(fakeServer, url) {
  const req = new EventEmitter();
  req.method = "GET";
  req.url = `${url.pathname}${url.search}`;

  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      writeHead: jest.fn((statusCode, headers = {}) => {
        res.statusCode = statusCode;
        res.headers = headers;
      }),
      end: jest.fn((chunk = "") => {
        res.body += String(chunk);
        resolve(res);
      }),
    };
    void fakeServer.handleRequest(req, res);
  });
}

describe("webControlServer", () => {
  let server;
  let fakeHttpServer;
  let createServerSpy;

  beforeEach(() => {
    createServerSpy = jest
      .spyOn(http, "createServer")
      .mockImplementation((handleRequest) => {
        fakeHttpServer = createFakeHttpServer(handleRequest);
        return fakeHttpServer;
      });
  });

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
    createServerSpy.mockRestore();
  });

  it("is disabled by default and binds to LAN when enabled", async () => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });

    expect(server.getStatus()).toMatchObject({
      enabled: false,
      running: false,
      host: HOST,
    });

    const status = await server.setEnabled(true);
    expect(status.enabled).toBe(true);
    expect(status.running).toBe(true);
    expect(status.host).toBe("0.0.0.0");
    expect(status.localUrl).toContain("127.0.0.1");
    expect(status.lanUrls[0]).toContain("192.168.1.20");
    expect(fakeHttpServer.listen).toHaveBeenCalledWith(
      0,
      HOST,
      expect.any(Function),
    );
  });

  it("allows API requests without a token in LAN mode", async () => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });
    const status = await server.setEnabled(true);
    server.setMainWindow({
      isDestroyed: () => false,
      webContents: {
        send: jest.fn((channel, payload) => {
          server.resolveRendererResponse({
            requestId: payload.requestId,
            success: true,
            result: { ok: true },
          });
        }),
      },
    });
    const url = new URL("/api/status", status.localUrl);
    url.search = "";

    const response = await requestJson(fakeHttpServer, url);
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("forwards API actions to the renderer bridge", async () => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });
    const webContents = {
      send: jest.fn((channel, payload) => {
        expect(channel).toBe(CHANNELS.WEB_RENDERER_REQUEST);
        setTimeout(() => {
          server.resolveRendererResponse({
            requestId: payload.requestId,
            success: true,
            result: { ok: true, command: payload.command },
          });
        }, 0);
      }),
    };
    server.setMainWindow({
      isDestroyed: () => false,
      webContents,
    });
    const status = await server.setEnabled(true);

    const actionUrl = new URL("/api/action", status.localUrl);
    const response = await requestJson(fakeHttpServer, actionUrl, {
      method: "POST",
      body: { action: "downloader:pause" },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.result).toEqual({
      ok: true,
      command: "downloader:pause",
    });
  });

  it.each(["/", "/downloader", "/settings"])(
    "serves the web application for %s",
    async (pathname) => {
      const store = createStore();
      server = createWebControlServer({
        appPath: path.resolve(__dirname, "../../../.."),
        store,
      });
      const status = await server.setEnabled(true);

      const response = await requestRaw(
        fakeHttpServer,
        new URL(pathname, status.localUrl),
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers["Content-Type"]).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("<!doctype html>");
    },
  );

  it.each(["/tools", "/missing.js", "/unknown/path"])(
    "returns 404 for unknown route or asset %s",
    async (pathname) => {
      const store = createStore();
      server = createWebControlServer({
        appPath: path.resolve(__dirname, "../../../.."),
        store,
      });
      const status = await server.setEnabled(true);

      const response = await requestJson(
        fakeHttpServer,
        new URL(pathname, status.localUrl),
      );

      expect(response).toEqual({
        statusCode: 404,
        body: { success: false, error: "Not found" },
      });
    },
  );

  it("normalizes one URL and requests its preview from the renderer", async () => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });
    const webContents = {
      send: jest.fn((_channel, payload) => {
        server.resolveRendererResponse({
          requestId: payload.requestId,
          success: true,
          result: { title: "Video" },
        });
      }),
    };
    server.setMainWindow({
      isDestroyed: () => false,
      webContents,
    });
    const status = await server.setEnabled(true);

    const response = await requestJson(
      fakeHttpServer,
      new URL("/api/preview", status.localUrl),
      {
        method: "POST",
        body: { url: "  https://example.com/video  " },
      },
    );

    expect(response).toEqual({
      statusCode: 200,
      body: { success: true, preview: { title: "Video" } },
    });
    expect(webContents.send).toHaveBeenCalledWith(
      CHANNELS.WEB_RENDERER_REQUEST,
      expect.objectContaining({
        command: "preview:get",
        payload: { url: "https://example.com/video" },
      }),
    );
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "ftp://example.com/video",
    "https://example.com/one https://example.com/two",
  ])("rejects invalid preview URL %p", async (url) => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });
    const status = await server.setEnabled(true);

    const response = await requestJson(
      fakeHttpServer,
      new URL("/api/preview", status.localUrl),
      { method: "POST", body: { url } },
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("forwards a partial settings patch and returns the canonical snapshot", async () => {
    const store = createStore();
    server = createWebControlServer({
      appPath: path.resolve(__dirname, "../../../.."),
      store,
    });
    const webContents = {
      send: jest.fn((_channel, payload) => {
        server.resolveRendererResponse({
          requestId: payload.requestId,
          success: true,
          result: { theme: "violet", language: "ru" },
        });
      }),
    };
    server.setMainWindow({
      isDestroyed: () => false,
      webContents,
    });
    const status = await server.setEnabled(true);

    const response = await requestJson(
      fakeHttpServer,
      new URL("/api/settings", status.localUrl),
      { method: "POST", body: { theme: "violet" } },
    );

    expect(response.body).toEqual({
      success: true,
      result: { theme: "violet", language: "ru" },
    });
    expect(webContents.send).toHaveBeenCalledWith(
      CHANNELS.WEB_RENDERER_REQUEST,
      expect.objectContaining({
        command: "settings:set",
        payload: { theme: "violet" },
      }),
    );
  });
});
