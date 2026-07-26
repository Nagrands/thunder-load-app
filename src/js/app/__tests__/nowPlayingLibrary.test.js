const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  importMediaPaths,
  isSupportedMediaPath,
  normalizeSourcePath,
  parseMediaPlaylist,
  refreshAvailability,
  scanMediaDirectory,
} = require("../nowPlayingLibrary");

describe("nowPlayingLibrary", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "now-playing-library-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("recursively scans media while skipping hidden and symlink folders", async () => {
    const nested = path.join(root, "Album", "Disc 1");
    const hidden = path.join(root, ".private");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(hidden, { recursive: true });
    fs.writeFileSync(path.join(root, "intro.mp3"), "audio");
    fs.writeFileSync(path.join(nested, "Трек 01.flac"), "audio");
    fs.writeFileSync(path.join(nested, "notes.txt"), "text");
    fs.writeFileSync(path.join(hidden, "hidden.mp3"), "audio");
    fs.symlinkSync(nested, path.join(root, "linked-album"), "dir");

    const result = await scanMediaDirectory(root);

    expect(result).toEqual([
      path.join(nested, "Трек 01.flac"),
      path.join(root, "intro.mp3"),
    ]);
  });

  test("imports supported absolute files with fallback metadata", async () => {
    const mediaPath = path.join(root, "My Song.mp3");
    fs.writeFileSync(mediaPath, "audio");

    const result = await importMediaPaths(
      [mediaPath, mediaPath, path.join(root, "ignored.txt"), "relative.mp3"],
      {},
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      providerId: "local",
      sourceRef: mediaPath,
      title: "My Song",
      duration: 0,
      artworkUrl: null,
      kind: "audio",
      availability: "available",
      mimeType: "audio/mpeg",
    });
    expect(result[0].playbackUrl).toMatch(/^file:/);
    expect(result[0].displayTitle).toBe("My Song");
    expect(result[0].sizeBytes).toBe(5);
  });

  test("supports AVI and MPEG files for the playback fallback", async () => {
    const aviPath = path.join(root, "clip.avi");
    const mpegPath = path.join(root, "movie.mpeg");
    fs.writeFileSync(aviPath, "video");
    fs.writeFileSync(mpegPath, "video");

    const result = await importMediaPaths([aviPath, mpegPath]);

    expect(isSupportedMediaPath(aviPath)).toBe(true);
    expect(result).toEqual([
      expect.objectContaining({ kind: "video", mimeType: "video/x-msvideo" }),
      expect.objectContaining({ kind: "video", mimeType: "video/mpeg" }),
    ]);
  });

  test("parses local M3U entries with safe relative and network media", async () => {
    const songPath = path.join(root, "Album", "song.mp3");
    const playlistPath = path.join(root, "mix.m3u8");
    fs.mkdirSync(path.dirname(songPath));
    fs.writeFileSync(songPath, "audio");
    fs.writeFileSync(
      playlistPath,
      [
        "\uFEFF#EXTM3U",
        "#EXTINF:1,Song",
        "Album/song.mp3",
        "https://media.example/live/stream.m3u8?token=1",
        "https://media.example/audio/remote.mp3",
        "https://youtu.be/abcdefghijk",
        "https://example.com/not-media",
        "nested.m3u",
      ].join("\n"),
    );

    const onWarning = jest.fn();
    await expect(
      parseMediaPlaylist(playlistPath, { onWarning }),
    ).resolves.toEqual([
      songPath,
      "https://media.example/live/stream.m3u8?token=1",
      "https://media.example/audio/remote.mp3",
    ]);
    expect(onWarning).toHaveBeenCalledWith({
      code: "YOUTUBE_REQUIRES_QUALITY",
      source: "https://youtu.be/abcdefghijk",
    });
    const imported = await importMediaPaths([playlistPath]);
    expect(imported).toEqual([
      expect.objectContaining({ providerId: "local", sourceRef: songPath }),
      expect.objectContaining({
        providerId: "network",
        mimeType: "application/vnd.apple.mpegurl",
      }),
      expect.objectContaining({
        providerId: "network",
        kind: "audio",
        playbackUrl: "https://media.example/audio/remote.mp3",
      }),
    ]);
  });

  test("enforces playlist byte and entry limits", async () => {
    const playlistPath = path.join(root, "limited.m3u");
    fs.writeFileSync(
      playlistPath,
      ["one.mp3", "two.mp3", "three.mp3"].join("\n"),
    );

    await expect(
      parseMediaPlaylist(playlistPath, { maxPlaylistEntries: 2 }),
    ).resolves.toEqual([path.join(root, "one.mp3"), path.join(root, "two.mp3")]);
    await expect(
      parseMediaPlaylist(playlistPath, { maxPlaylistBytes: 1 }),
    ).resolves.toEqual([]);
  });

  test("uses ffprobe metadata and extracts embedded artwork best-effort", async () => {
    if (process.platform === "win32") return;
    const mediaPath = path.join(root, "tagged.m4a");
    const ffprobePath = path.join(root, "ffprobe");
    const ffmpegPath = path.join(root, "ffmpeg");
    const artworkDir = path.join(root, "artwork");
    fs.writeFileSync(mediaPath, "audio");
    fs.writeFileSync(
      ffprobePath,
      `#!/bin/sh
printf '%s' '{"format":{"duration":"125.5","format_name":"mov,mp4","tags":{"title":"Thunder Song","artist":"NGR","album":"Blue"}},"streams":[{"index":0,"codec_type":"audio","codec_name":"aac"},{"index":1,"codec_type":"video","codec_name":"mjpeg","disposition":{"attached_pic":1}}]}'
`,
    );
    fs.writeFileSync(
      ffmpegPath,
      `#!/bin/sh
for last do true; done
printf '%s' cover > "$last"
`,
    );
    fs.chmodSync(ffprobePath, 0o755);
    fs.chmodSync(ffmpegPath, 0o755);

    const [track] = await importMediaPaths([mediaPath], {
      artworkDir,
      ffmpegPath,
      ffprobePath,
    });

    expect(track).toMatchObject({
      title: "Thunder Song",
      artist: "NGR",
      album: "Blue",
      duration: 125.5,
      mediaInfo: {
        audioCodec: "aac",
        container: "mov",
        height: 0,
        videoCodec: "",
        width: 0,
      },
    });
    expect(track.artworkUrl).toMatch(/^file:/);
    expect(fs.readdirSync(artworkDir)).toHaveLength(1);
  });

  test("refreshes missing file availability without rejecting the track", async () => {
    const mediaPath = path.join(root, "missing.mp4");
    const track = {
      id: "missing",
      sourceRef: mediaPath,
      availability: "available",
    };

    const missing = await refreshAvailability(track);
    fs.writeFileSync(mediaPath, "video");
    const restored = await refreshAvailability(track);

    expect(missing).toMatchObject({
      availability: "missing",
      playbackUrl: null,
    });
    expect(restored.availability).toBe("available");
    expect(restored.playbackUrl).toMatch(/^file:/);
  });

  test("normalizes equivalent source paths for deduplication", () => {
    expect(normalizeSourcePath(path.join(root, "a", "..", "song.mp3"))).toBe(
      normalizeSourcePath(path.join(root, "song.mp3")),
    );
  });

  test("does not traverse a selected symlink directory", async () => {
    if (process.platform === "win32") return;
    const album = path.join(root, "album");
    const link = path.join(root, "album-link");
    fs.mkdirSync(album);
    fs.writeFileSync(path.join(album, "track.mp3"), "audio");
    fs.symlinkSync(album, link, "dir");

    await expect(scanMediaDirectory(link)).resolves.toEqual([]);
  });
});
