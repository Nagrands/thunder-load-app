jest.mock("../toolsPaths", () => ({
  getEffectiveToolsDir: jest.fn(() => "/custom/tools"),
  getDefaultToolsDir: jest.fn(() => "/default/tools"),
  resolveToolPath: jest.fn((tool, dir) => `${dir}/${tool}`),
}));

const mockAccessSync = jest.fn();
const mockOpenSync = jest.fn();
const mockReadSync = jest.fn();
const mockCloseSync = jest.fn();

jest.mock("fs", () => ({
  accessSync: (...args) => mockAccessSync(...args),
  openSync: (...args) => mockOpenSync(...args),
  readSync: (...args) => mockReadSync(...args),
  closeSync: (...args) => mockCloseSync(...args),
  constants: {
    F_OK: 0,
    X_OK: 1,
  },
  promises: {
    access: jest.fn(),
    chmod: jest.fn(),
  },
  existsSync: jest.fn(() => true),
}));

describe("runtimeTools", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.resetModules();
    mockAccessSync.mockReset();
    mockOpenSync.mockReset();
    mockReadSync.mockReset();
    mockCloseSync.mockReset();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
  });

  afterAll(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
  });

  test("falls back from preferred yt-dlp path to default path when preferred is not executable", () => {
    mockAccessSync.mockImplementation((targetPath, mode) => {
      if (String(targetPath).includes("/custom/tools/yt-dlp")) {
        throw new Error(`not executable: ${mode}`);
      }
      return undefined;
    });

    const { resolveRuntimeBinaryDetails } = require("../runtimeTools");
    const resolved = resolveRuntimeBinaryDetails("yt-dlp");

    expect(resolved).toMatchObject({
      path: "/default/tools/yt-dlp",
      source: "default",
      executable: true,
    });
  });

  test("blocks Python-backed yt-dlp launchers on macOS", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
    });
    mockOpenSync.mockImplementation((targetPath) => targetPath);
    mockReadSync.mockImplementation((fd, buffer) => {
      const header = String(fd).includes("/custom/tools/yt-dlp")
        ? "#!/Library/Frameworks/Python.framework/Versions/3.14/bin/python3\n"
        : "\u0000\u0000standalone-binary";
      buffer.write(header);
      return header.length;
    });

    const { resolveRuntimeBinaryDetails } = require("../runtimeTools");
    const resolved = resolveRuntimeBinaryDetails("yt-dlp");

    expect(resolved).toMatchObject({
      path: "/default/tools/yt-dlp",
      source: "default",
      executable: true,
      blockedReason: null,
    });
    expect(mockOpenSync).toHaveBeenCalledWith("/custom/tools/yt-dlp", "r");
    expect(mockOpenSync).toHaveBeenCalledWith("/default/tools/yt-dlp", "r");
    expect(mockCloseSync).toHaveBeenCalled();
  });
});
