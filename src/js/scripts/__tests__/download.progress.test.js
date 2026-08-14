jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/tmp"),
    getAppPath: jest.fn(() => "/tmp"),
  },
}));

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { _parseDownloadProgress } = require("../download");

describe("yt-dlp progress parser", () => {
  test("parses exact byte metrics", () => {
    expect(
      _parseDownloadProgress(
        "THUNDER_PROGRESS:45.5%|1000|2000|NA|250|8",
      ),
    ).toEqual({
      progress: 45.5,
      downloadedBytes: 1000,
      totalBytes: 2000,
      totalBytesApproximate: false,
      speedBytesPerSec: 250,
      etaSeconds: 8,
    });
  });

  test("uses estimated total and normalizes unavailable values", () => {
    expect(
      _parseDownloadProgress("THUNDER_PROGRESS:10%|100|NA|900|NA|N/A"),
    ).toEqual({
      progress: 10,
      downloadedBytes: 100,
      totalBytes: 900,
      totalBytesApproximate: true,
      speedBytesPerSec: null,
      etaSeconds: null,
    });
  });

  test("keeps legacy percentage output compatible", () => {
    expect(_parseDownloadProgress("[download] 73.2% of 10MiB")).toEqual({
      progress: 73.2,
    });
  });
});
