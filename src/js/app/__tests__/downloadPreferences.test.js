const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDownloadPreferences, normalizeCookies } = require("../download/preferences");

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe("download preferences", () => {
  let root;
  let store;
  let values;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "download-preferences-"));
    values = {};
    store = {
      get: jest.fn((key, fallback) => values[key] ?? fallback),
      set: jest.fn((key, value) => {
        values[key] = value;
      }),
    };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("returns immutable normalized cookies settings", () => {
    const settings = normalizeCookies({
      mode: "browser",
      browser: "firefox",
      filePath: " /tmp/cookies.txt ",
      ignored: true,
    });
    expect(settings).toEqual({
      mode: "browser",
      browser: "firefox",
      filePath: "/tmp/cookies.txt",
    });
    expect(Object.isFrozen(settings)).toBe(true);
  });

  test("keeps resume artifacts while runtime is busy", async () => {
    const oldPath = path.join(root, "old");
    const newPath = path.join(root, "new");
    const resumePath = path.join(oldPath, ".thunderload-resume");
    fs.mkdirSync(resumePath, { recursive: true });
    fs.mkdirSync(newPath, { recursive: true });
    const preferences = createDownloadPreferences({
      store,
      initialPath: oldPath,
      isBusy: () => true,
    });

    await expect(preferences.setPath(newPath)).resolves.toEqual({
      success: true,
      path: newPath,
    });
    expect(fs.existsSync(resumePath)).toBe(true);
  });

  test("removes only the previous destination resume directory when idle", async () => {
    const oldPath = path.join(root, "old");
    const newPath = path.join(root, "new");
    const resumePath = path.join(oldPath, ".thunderload-resume");
    fs.mkdirSync(resumePath, { recursive: true });
    fs.mkdirSync(newPath, { recursive: true });
    const preferences = createDownloadPreferences({
      store,
      initialPath: oldPath,
      isBusy: () => false,
    });

    await preferences.setPath(newPath);
    expect(fs.existsSync(resumePath)).toBe(false);
    expect(preferences.getPath()).toBe(newPath);
  });
});
