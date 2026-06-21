const { EventEmitter } = require("events");

jest.mock("../toolsPaths", () => ({
  getEffectiveToolsDir: jest.fn(() => "/tmp/tools"),
  getDefaultToolsDir: jest.fn(() => "/tmp/tools"),
  resolveToolPath: jest.fn((tool, dir) => `${dir}/${tool}`),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  accessSync: jest.fn(),
  openSync: jest.fn(),
  readSync: jest.fn(),
  closeSync: jest.fn(),
  constants: {
    F_OK: 0,
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

describe("toolsVersions", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.resetModules();
    mockSpawn.mockReset();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
    const fs = require("fs");
    fs.existsSync.mockReturnValue(true);
    fs.accessSync.mockReturnValue(undefined);
    fs.openSync.mockReset();
    fs.readSync.mockReset();
    fs.closeSync.mockReset();
    const fsPromises = require("fs/promises");
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.chmod.mockResolvedValue(undefined);
  });

  afterAll(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
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

  test("returns availability without spawning binaries", () => {
    const { getToolsAvailability } = require("../toolsVersions");
    const availability = getToolsAvailability();

    expect(availability).toMatchObject({
      ytDlp: { ok: true, path: "/tmp/tools/yt-dlp", source: "preferred" },
      ffmpeg: { ok: true, path: "/tmp/tools/ffmpeg", source: "preferred" },
      deno: { ok: true, path: "/tmp/tools/deno", source: "preferred" },
    });
    expect(mockSpawn).not.toHaveBeenCalled();
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

  test("does not spawn Python-backed yt-dlp on macOS", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
    });
    const fs = require("fs");
    fs.openSync.mockImplementation((targetPath) => targetPath);
    fs.readSync.mockImplementation((fd, buffer) => {
      const header = String(fd).includes("yt-dlp")
        ? "#!/Library/Frameworks/Python.framework/Versions/3.14/bin/python3\n"
        : "\u0000\u0000standalone-binary";
      buffer.write(header);
      return header.length;
    });
    mockSpawn
      .mockImplementationOnce(() =>
        createProc({ stdout: "ffmpeg version 7.1\n" }),
      )
      .mockImplementationOnce(() => createProc({ stdout: "deno 2.2.0\n" }));

    const { getToolsVersions } = require("../toolsVersions");
    const versions = await getToolsVersions();

    expect(versions.ytDlp).toMatchObject({
      ok: false,
      path: "/tmp/tools/yt-dlp",
    });
    expect(mockSpawn).not.toHaveBeenCalledWith(
      "/tmp/tools/yt-dlp",
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      "/tmp/tools/ffmpeg",
      ["-version"],
      expect.any(Object),
    );
  });
});
