const {
  selectYouTubeBackgroundPreview,
  selectYouTubeLivePreview,
} = require("../downloaderBackgroundPreview");

describe("selectYouTubeBackgroundPreview", () => {
  test("selects a moderate playable YouTube mp4/webm source", () => {
    const result = selectYouTubeBackgroundPreview(
      {
        thumbnails: [
          { url: "https://i.ytimg.com/vi/demo/default.jpg", width: 120 },
          { url: "https://i.ytimg.com/vi/demo/maxresdefault.jpg", width: 1280 },
        ],
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
            width: 640,
            height: 360,
            tbr: 900,
          },
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=22",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.64001F",
            acodec: "mp4a.40.2",
            width: 1920,
            height: 1080,
            tbr: 6000,
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result).toEqual({
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
      poster: "https://i.ytimg.com/vi/demo/maxresdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 640,
      height: 360,
    });
  });

  test("returns null for live YouTube videos", () => {
    const result = selectYouTubeBackgroundPreview(
      {
        is_live: true,
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result).toBeNull();
  });

  test("returns null for video-less or unsupported YouTube formats", () => {
    const result = selectYouTubeBackgroundPreview(
      {
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=140",
            ext: "m4a",
            protocol: "https",
            vcodec: "none",
            acodec: "mp4a.40.2",
          },
          {
            url: "https://rr1---sn.example.googlevideo.com/api/manifest.m3u8",
            ext: "mp4",
            protocol: "m3u8_native",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result).toBeNull();
  });

  test("returns null for non-YouTube URLs", () => {
    const result = selectYouTubeBackgroundPreview(
      {
        formats: [
          {
            url: "https://cdn.example.com/video.mp4",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
            width: 854,
            height: 480,
          },
        ],
      },
      "https://vimeo.com/123",
    );

    expect(result).toBeNull();
  });

  test("selects a moderate playable YouTube audio-video live preview source", () => {
    const result = selectYouTubeLivePreview(
      {
        thumbnails: [
          { url: "https://i.ytimg.com/vi/demo/default.jpg", width: 120 },
          { url: "https://i.ytimg.com/vi/demo/maxresdefault.jpg", width: 1280 },
        ],
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=137",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.640028",
            acodec: "mp4a.40.2",
            width: 1920,
            height: 1080,
            tbr: 4500,
            abr: 128,
          },
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
            width: 640,
            height: 360,
            tbr: 900,
            abr: 96,
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result).toEqual({
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
      poster: "https://i.ytimg.com/vi/demo/maxresdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 640,
      height: 360,
    });
  });

  test("returns null for live, audio-less, manifest-based, or non-YouTube live preview candidates", () => {
    const live = selectYouTubeLivePreview(
      {
        is_live: true,
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );
    const audioLess = selectYouTubeLivePreview(
      {
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=135",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.4d401e",
            acodec: "none",
            width: 854,
            height: 480,
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );
    const manifest = selectYouTubeLivePreview(
      {
        formats: [
          {
            url: "https://rr1---sn.example.googlevideo.com/api/manifest.m3u8",
            ext: "mp4",
            protocol: "m3u8_native",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
          },
        ],
      },
      "https://www.youtube.com/watch?v=demo",
    );
    const nonYoutube = selectYouTubeLivePreview(
      {
        formats: [
          {
            url: "https://cdn.example.com/video.mp4",
            ext: "mp4",
            protocol: "https",
            vcodec: "avc1.42001E",
            acodec: "mp4a.40.2",
          },
        ],
      },
      "https://vimeo.com/123",
    );

    expect(live).toBeNull();
    expect(audioLess).toBeNull();
    expect(manifest).toBeNull();
    expect(nonYoutube).toBeNull();
  });

  test("keeps background and live preview selection independent", () => {
    const info = {
      thumbnails: [
        { url: "https://i.ytimg.com/vi/demo/maxresdefault.jpg", width: 1280 },
      ],
      formats: [
        {
          url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "none",
          width: 640,
          height: 360,
          tbr: 900,
        },
        {
          url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=22",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.64001F",
          acodec: "mp4a.40.2",
          width: 1280,
          height: 720,
          tbr: 2500,
          abr: 128,
        },
      ],
    };

    const backgroundPreview = selectYouTubeBackgroundPreview(
      info,
      "https://www.youtube.com/watch?v=demo",
    );
    const livePreview = selectYouTubeLivePreview(
      info,
      "https://www.youtube.com/watch?v=demo",
    );

    expect(backgroundPreview).toEqual(
      expect.objectContaining({
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
      }),
    );
    expect(livePreview).toEqual(
      expect.objectContaining({
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=22",
      }),
    );
  });
});
