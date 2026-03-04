jest.mock("electron", () => ({
  app: { getPath: jest.fn(() => "/tmp/thunder-load") },
  dialog: {},
  shell: {},
}));

const { __test } = require("../backupManager");

describe("backupManager isArchiveModuleLoadError", () => {
  test("returns true for Compress-Archive module autoload failure", () => {
    const error = {
      message: "Command failed: powershell.exe ... Compress-Archive ...",
      stderr:
        "Compress-Archive : The 'Compress-Archive' command was found in the module 'Microsoft.PowerShell.Archive', but the module could not be loaded. FullyQualifiedErrorId : CouldNotAutoloadMatchingModule",
    };

    expect(__test.isArchiveModuleLoadError(error)).toBe(true);
  });

  test("returns false for unrelated powershell error", () => {
    const error = {
      message: "Access to the path is denied",
      stderr: "UnauthorizedAccessException",
    };

    expect(__test.isArchiveModuleLoadError(error)).toBe(false);
  });
});
