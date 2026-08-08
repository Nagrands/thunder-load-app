const fs = require("fs");
const path = require("path");
const packageJson = require("../../../../package.json");

describe("Player packaging integration", () => {
  test("registers the requested media associations", () => {
    const extensions = new Set(
      packageJson.build.fileAssociations.flatMap((entry) => entry.ext),
    );
    expect(extensions).toEqual(
      new Set([
        "mp3",
        "m4a",
        "aac",
        "flac",
        "wav",
        "ogg",
        "opus",
        "mp4",
        "mkv",
        "webm",
        "mov",
        "avi",
        "mpeg",
        "mpg",
        "m3u",
        "m3u8",
      ]),
    );
  });

  test("uses the per-machine NSIS mode required for associations", () => {
    expect(packageJson.build.appId).toBe("com.thunderload.app");
    expect(packageJson.build.nsis).toMatchObject({
      perMachine: true,
      installerIcon: "assets/icons/app/app-icon.ico",
      uninstallerIcon: "assets/icons/app/app-icon.ico",
      installerHeaderIcon: "assets/icons/app/app-icon.ico",
      include: "scripts/windows-installer.nsh",
    });
  });

  test("ships a physical Windows icon outside app.asar for BrowserWindow", () => {
    expect(packageJson.build.extraResources).toContainEqual({
      from: "assets/icons/app/app-icon.ico",
      to: "app-icon.ico",
    });
  });

  test("refreshes legacy Windows shortcuts with the standalone Thunder ICO", () => {
    const installerInclude = fs.readFileSync(
      path.resolve(__dirname, "../../../../scripts/windows-installer.nsh"),
      "utf8",
    );
    expect(installerInclude).toContain(
      'Delete "$SMPROGRAMS\\${SHORTCUT_NAME}.lnk"',
    );
    expect(installerInclude).toContain('"$INSTDIR\\resources\\app-icon.ico"');
    expect(installerInclude).toContain("Shell32::SHChangeNotify");
  });
});
