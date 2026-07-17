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
});
