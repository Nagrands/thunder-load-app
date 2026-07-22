import {
  NetworkMediaProvider,
  normalizeNetworkUrl,
} from "../nowPlaying/networkMediaProvider.js";

describe("NetworkMediaProvider", () => {
  test("accepts credential-free HTTP(S) URLs", () => {
    expect(normalizeNetworkUrl("https://media.example/song.mp3")).toBe(
      "https://media.example/song.mp3",
    );
    expect(normalizeNetworkUrl("https://user:secret@example.com/a.mp3")).toBe(
      "",
    );
    expect(normalizeNetworkUrl("file:///tmp/a.mp3")).toBe("");
  });

  test("marks HLS manifests for the HLS playback adapter", async () => {
    const provider = new NetworkMediaProvider();
    await expect(
      provider.resolveTrack({
        sourceRef: "https://media.example/live.m3u8",
        mimeType: "application/vnd.apple.mpegurl",
      }),
    ).resolves.toMatchObject({ kind: "hls" });
  });
});
