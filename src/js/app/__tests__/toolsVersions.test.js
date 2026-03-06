const { EventEmitter } = require("events");

jest.mock("../toolsPaths", () => ({
  getEffectiveToolsDir: jest.fn(() => "/tmp/tools"),
  resolveToolPath: jest.fn((tool, dir) => `${dir}/${tool}`),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  constants: {
    X_OK: 1,
  },
}));

jest.mock("fs/promises", () => ({
  access: jest.fn(async () => undefined),
  chmod: jest.fn(async () => undefined),
}));

const mockSpawn = jest.fn();

jest.mock("node:child_process", () => ({
  spawn: (...args) => mockSpawn(...args),
}));

function createProc({ code = 0, stdout = "", stderr = "" } = {}) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();

  process.nextTick(() => {
    if (stdout) proc.stdout.emit("data", Buffer.from(stdout));
    if (stderr) proc.stderr.emit("data", Buffer.from(stderr));
    proc.emit("close", code);
  });

  return proc;
}

describe("getToolsVersions", () => {
  beforeEach(() => {
    jest.resetModules();
    mockSpawn.mockReset();
    const fs = require("fs");
    fs.existsSync.mockReturnValue(true);
    const fsPromises = require("fs/promises");
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.chmod.mockResolvedValue(undefined);
  });

  test("reads yt-dlp version from stdout", async () => {
    mockSpawn
      .mockImplementationOnce(() => createProc({ stdout: "2026.03.01\n" }))
      .mockImplementationOnce(() =>
        createProc({ stdout: "ffmpeg version 7.1\n" }),
      )
      .mockImplementationOnce(() => createProc({ stdout: "deno 2.2.0\n" }));

    const { getToolsVersions } = require("../toolsVersions");
    const versions = await getToolsVersions();

    expect(versions.ytDlp.version).toBe("2026.03.01");
    expect(mockSpawn).toHaveBeenCalledWith(
      "/tmp/tools/yt-dlp",
      ["--version"],
      expect.objectContaining({
        env: expect.any(Object),
        windowsHide: true,
      }),
    );
  });

  test("falls back to stderr output for yt-dlp version", async () => {
    mockSpawn
      .mockImplementationOnce(() =>
        createProc({ stderr: "2026.03.05\n", stdout: "" }),
      )
      .mockImplementationOnce(() =>
        createProc({ stdout: "ffmpeg version 7.1\n" }),
      )
      .mockImplementationOnce(() => createProc({ stdout: "deno 2.2.0\n" }));

    const { getToolsVersions } = require("../toolsVersions");
    const versions = await getToolsVersions();

    expect(versions.ytDlp.version).toBe("2026.03.05");
  });
});
