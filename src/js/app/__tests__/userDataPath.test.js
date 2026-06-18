const path = require("path");

const {
  LEGACY_USER_DATA_APP_NAME,
  configureLegacyUserDataPath,
} = require("../userDataPath.js");

describe("userDataPath", () => {
  test("creates and sets the legacy Thunder Load userData path", () => {
    const appDataPath = path.join("app-data", "Thunder");
    const app = {
      getPath: jest.fn(() => appDataPath),
      setPath: jest.fn(),
    };
    const fsModule = {
      mkdirSync: jest.fn(),
    };

    const legacyPath = configureLegacyUserDataPath(app, fsModule);

    expect(legacyPath).toBe(path.join(appDataPath, LEGACY_USER_DATA_APP_NAME));
    expect(fsModule.mkdirSync).toHaveBeenCalledWith(legacyPath, {
      recursive: true,
    });
    expect(app.setPath).toHaveBeenCalledWith("userData", legacyPath);
  });

  test("returns null when the legacy path cannot be configured", () => {
    const app = {
      getPath: jest.fn(() => "/tmp"),
      setPath: jest.fn(),
    };
    const fsModule = {
      mkdirSync: jest.fn(() => {
        throw new Error("denied");
      }),
    };
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(configureLegacyUserDataPath(app, fsModule)).toBeNull();
    expect(app.setPath).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
