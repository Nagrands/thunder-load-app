const fs = require("fs");
const os = require("os");
const path = require("path");

let mockToolsDir;

jest.mock("../toolsPaths", () => ({
  getEffectiveToolsDir: jest.fn(() => mockToolsDir),
  getExecName: jest.fn((name) => name),
}));

const {
  createDependencyActions,
  normalizeDependencyActionPayload,
} = require("../dependencyActions");

describe("dependencyActions", () => {
  let installers;
  let getToolsVersions;
  let service;

  const toolPath = (name) => path.join(mockToolsDir, name);

  beforeEach(() => {
    mockToolsDir = fs.mkdtempSync(path.join(os.tmpdir(), "thunder-deps-"));
    installers = {
      installYtDlp: jest.fn(async ({ targetPath }) => {
        fs.writeFileSync(targetPath, "new-yt");
      }),
      installFfmpeg: jest.fn(async () => {
        fs.writeFileSync(toolPath("ffmpeg"), "new-ffmpeg");
        fs.writeFileSync(toolPath("ffprobe"), "new-ffprobe");
      }),
      installDeno: jest.fn(async () => {
        fs.writeFileSync(toolPath("deno"), "new-deno");
      }),
    };
    getToolsVersions = jest.fn().mockResolvedValue({
      ytDlp: {
        ok: fs.existsSync(toolPath("yt-dlp")),
        path: toolPath("yt-dlp"),
        version: "2026.07.29",
      },
      ffmpeg: {
        ok: fs.existsSync(toolPath("ffmpeg")),
        path: toolPath("ffmpeg"),
        version: "ffmpeg version 8.0",
      },
      deno: {
        ok: fs.existsSync(toolPath("deno")),
        path: toolPath("deno"),
        version: "deno 2.4.0",
      },
    });
    service = createDependencyActions({
      store: {},
      ...installers,
      getToolsVersions,
      log: { error: jest.fn() },
    });
  });

  afterEach(() => {
    fs.rmSync(mockToolsDir, { recursive: true, force: true });
  });

  test("accepts only supported ids and actions", () => {
    expect(
      normalizeDependencyActionPayload({ id: "deno", action: "update" }),
    ).toEqual({ id: "deno", action: "update" });
    expect(
      normalizeDependencyActionPayload({ id: "../deno", action: "update" }),
    ).toBeNull();
    expect(
      normalizeDependencyActionPayload({ id: "deno", action: "remove" }),
    ).toBeNull();
    expect(normalizeDependencyActionPayload("deno")).toBeNull();
  });

  test.each([
    ["ytDlp", "yt-dlp", "installYtDlp"],
    ["ffmpeg", "ffmpeg", "installFfmpeg"],
    ["deno", "deno", "installDeno"],
  ])("installs and verifies %s", async (id, executable, installer) => {
    getToolsVersions.mockImplementation(async () => ({
      [id]: {
        ok: fs.existsSync(toolPath(executable)),
        path: toolPath(executable),
        version: id === "ffmpeg" ? "ffmpeg version 8.0" : "2026.07.29",
      },
    }));

    const result = await service.run({ id, action: "install" });

    expect(result).toMatchObject({ success: true, toolId: id });
    expect(installers[installer]).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(toolPath(executable))).toBe(true);
  });

  test.each([
    ["ytDlp", ["yt-dlp"]],
    ["ffmpeg", ["ffmpeg", "ffprobe"]],
    ["deno", ["deno"]],
  ])("restores every %s binary when verification fails", async (id, names) => {
    names.forEach((name) => fs.writeFileSync(toolPath(name), `old-${name}`));
    getToolsVersions.mockResolvedValueOnce({
      [id]: { ok: false, error: "broken" },
    });

    const result = await service.run({ id, action: "reinstall" });

    expect(result).toMatchObject({ success: false, toolId: id });
    names.forEach((name) => {
      expect(fs.readFileSync(toolPath(name), "utf8")).toBe(`old-${name}`);
    });
  });

  test("deduplicates simultaneous operations for the same tool", async () => {
    let release;
    installers.installDeno.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            fs.writeFileSync(toolPath("deno"), "new-deno");
            resolve();
          };
        }),
    );

    const first = service.run({ id: "deno", action: "install" });
    const second = service.run({ id: "deno", action: "install" });
    release();
    await Promise.all([first, second]);

    expect(installers.installDeno).toHaveBeenCalledTimes(1);
  });

  test("rejects malformed payloads without running an installer", async () => {
    await expect(
      service.run({ id: "ytDlp", action: "delete" }),
    ).resolves.toEqual({
      success: false,
      error: "Invalid dependency action payload",
    });
    expect(installers.installYtDlp).not.toHaveBeenCalled();
  });

  test("keeps ffmpeg update disabled on macOS while allowing reinstall", async () => {
    if (process.platform !== "darwin") return;
    fs.writeFileSync(toolPath("ffmpeg"), "old-ffmpeg");
    fs.writeFileSync(toolPath("ffprobe"), "old-ffprobe");
    getToolsVersions.mockResolvedValue({
      ffmpeg: {
        ok: true,
        path: toolPath("ffmpeg"),
        version: "ffmpeg version 8.0",
      },
    });

    await expect(
      service.run({ id: "ffmpeg", action: "update" }),
    ).resolves.toMatchObject({
      success: false,
      toolId: "ffmpeg",
      error: expect.stringContaining("unavailable on macOS"),
    });
    await expect(
      service.run({ id: "ffmpeg", action: "reinstall" }),
    ).resolves.toMatchObject({ success: true, toolId: "ffmpeg" });
  });
});
