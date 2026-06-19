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

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: body ? JSON.parse(body) : null,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

describe("webControlServer", () => {
  let server;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
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

    const response = await requestJson(url);
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
    const response = await requestJson(actionUrl, {
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
