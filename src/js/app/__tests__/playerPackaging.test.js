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
    expect(packageJson.build.nsis).toMatchObject({ perMachine: true });
  });
});
