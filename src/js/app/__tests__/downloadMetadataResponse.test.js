jest.mock("../downloaderBackgroundPreview", () => ({
  selectYouTubeBackgroundPreview: jest.fn(() => null),
  selectYouTubeLivePreview: jest.fn(() => null),
}));

const { formatVideoInfoResponse } = require("../download/metadataResponse");

describe("download metadata response", () => {
  test("adds structured playlist items and preserves legacy entries", () => {
    const result = formatVideoInfoResponse(
      {
        title: "Playlist",
        extractor: "youtube:tab",
        entries: [
          {
            id: "one",
            title: "First",
            duration: 61,
            thumbnail: "https://img.example/one.jpg",
            uploader: "Channel",
          },
          {
            id: "private",
            title: "Private",
            availability: "private",
          },
        ],
      },
      "https://www.youtube.com/playlist?list=demo",
    );

    expect(result.entries).toEqual([
      "https://www.youtube.com/watch?v=one",
      "https://www.youtube.com/watch?v=private",
    ]);
    expect(result.playlistItems).toEqual([
      expect.objectContaining({
        id: "one",
        index: 1,
        title: "First",
        duration: 61,
        available: true,
      }),
      expect.objectContaining({
        id: "private",
        index: 2,
        available: false,
      }),
    ]);
  });
});
