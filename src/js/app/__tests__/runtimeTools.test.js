jest.mock("../toolsPaths", () => ({
  getEffectiveToolsDir: jest.fn(() => "/custom/tools"),
  getDefaultToolsDir: jest.fn(() => "/default/tools"),
  resolveToolPath: jest.fn((tool, dir) => `${dir}/${tool}`),
}));

const mockAccessSync = jest.fn();

jest.mock("fs", () => ({
  accessSync: (...args) => mockAccessSync(...args),
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
  beforeEach(() => {
    jest.resetModules();
    mockAccessSync.mockReset();
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
});
