/** @jest-environment jsdom */

const info = {
  success: true,
  duration: 120,
  formats: [
    {
      format_id: "137",
      ext: "mp4",
      height: 1080,
      fps: 30,
      vcodec: "avc1.640028",
      acodec: "none",
      filesize: 100 * 1024 * 1024,
    },
    {
      format_id: "140",
      ext: "m4a",
      vcodec: "none",
      acodec: "mp4a.40.2",
      abr: 128,
      filesize_approx: 2 * 1024 * 1024,
    },
  ],
  subtitles: [{ lang: "ru", formats: [] }],
  automatic_captions: [{ lang: "en", formats: [] }],
};

const translate = (key, vars = {}) => {
  const values = {
    "quality.label.video": "Video",
    "quality.label.audio": "Audio",
    "quality.quick.audioIncluded": "Included with video",
    "quality.label.videoWithAudio": `${vars.label} + audio`,
    "quality.label.videoNoAudio": `${vars.label} without audio`,
    "quality.compact.noVideo": "No video",
    "quality.compact.noVideoHint": "Audio only",
    "quality.compact.noAudio": "No audio",
    "quality.compact.noAudioHint": "Video only",
    "quality.label.audioMp3": "MP3",
    "quality.desc.audioMp3": "MP3",
    "quality.quick.subtitlesOff": "Off",
    "quality.subtitle.sourceManual": "manual",
    "quality.subtitle.sourceAutomatic": "auto",
    "quality.subtitle.optionTitle": `${vars.lang} subtitles (${vars.source})`,
    "quality.quick.sizeUnavailable": "Size unavailable",
    "quality.quick.subtitleOnlySummary": "SRT • Subtitles only",
  };
  return values[key] || key;
};

describe("downloader quality selection model", () => {
  test("builds media and subtitle companion payloads with approximate summary", async () => {
    const {
      buildCompactQualityOptions,
      buildDownloaderSelection,
      buildSubtitleQualityOptions,
    } = await import("../downloadQualityOptions.js");
    const groups = buildCompactQualityOptions(info, translate);
    const subtitles = buildSubtitleQualityOptions(info, translate);
    const selection = buildDownloaderSelection({
      videoOption: groups.videoOptions[0],
      audioOption: groups.audioOptions[0],
      subtitleOption: subtitles[1],
      t: translate,
    });

    expect(selection.mediaPayload).toMatchObject({
      type: "pair",
      videoFormatId: "137",
      audioFormatId: "140",
    });
    expect(selection.subtitlePayloads[0]).toMatchObject({
      type: "subtitle-only",
      subtitleLang: "ru",
      subtitleSource: "manual",
    });
    expect(selection.summary).toMatchObject({
      container: "MP4",
      codecs: ["H.264", "AAC"],
      approximate: true,
    });
    expect(selection.summary.text).toContain("≈");
  });

  test("supports subtitle-only and unavailable-size summaries", async () => {
    const {
      buildCompactQualityOptions,
      buildDownloaderSelection,
      buildSubtitleQualityOptions,
      buildOutputSummary,
    } = await import("../downloadQualityOptions.js");
    const groups = buildCompactQualityOptions(info, translate);
    const subtitles = buildSubtitleQualityOptions(info, translate);
    const noVideo = groups.videoOptions.find(
      (option) => option.kind === "none",
    );
    const noAudio = groups.audioOptions.find(
      (option) => option.kind === "none",
    );

    expect(
      buildDownloaderSelection({
        videoOption: noVideo,
        audioOption: noAudio,
        subtitleOption: subtitles[1],
        t: translate,
      }),
    ).toMatchObject({
      mediaPayload: null,
      subtitlePayloads: [{ subtitleLang: "ru" }],
    });

    const unknown = buildOutputSummary({
      videoOption: {
        kind: "video",
        source: "muxed",
        fmt: { format_id: "x", ext: "webm", vcodec: "vp9", acodec: "opus" },
        payload: { type: "muxed", videoFormatId: "x", videoExt: "webm" },
      },
      audioOption: { kind: "audio", fmt: null },
      t: translate,
    });
    expect(unknown.text).toBe("WEBM • VP9 + Opus • Size unavailable");
  });

  test("distinguishes exact size from bitrate-derived approximate size", async () => {
    const { buildCompactQualityOptions, buildOutputSummary } =
      await import("../downloadQualityOptions.js");
    const exactInfo = {
      success: true,
      duration: 100,
      formats: [
        {
          format_id: "18",
          ext: "mp4",
          height: 720,
          vcodec: "avc1",
          acodec: "mp4a",
          filesize: 50 * 1024 * 1024,
        },
      ],
    };
    const exactGroups = buildCompactQualityOptions(exactInfo, translate);
    const exactSummary = buildOutputSummary({
      videoOption: exactGroups.videoOptions[0],
      audioOption: exactGroups.audioOptions[0],
      t: translate,
    });
    expect(exactSummary.approximate).toBe(false);
    expect(exactSummary.text).not.toContain("≈");

    const bitrateInfo = {
      ...info,
      formats: info.formats.map((format) => ({
        ...format,
        filesize: undefined,
        filesize_approx: undefined,
      })),
    };
    const bitrateGroups = buildCompactQualityOptions(bitrateInfo, translate);
    const approximateSummary = buildOutputSummary({
      videoOption: bitrateGroups.videoOptions[0],
      audioOption: bitrateGroups.audioOptions[0],
      t: translate,
    });
    expect(approximateSummary.approximate).toBe(true);
    expect(approximateSummary.text).toContain("≈");
  });
});

describe("downloaderSelectionCard", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <input id="url" value="https://example.com/video" />
      <section id="preview-card">
        <select id="downloader-video-quality"></select>
        <select id="downloader-audio-quality"></select>
        <select id="downloader-subtitle-quality"></select>
        <span id="downloader-video-meta"></span>
        <span id="downloader-audio-meta"></span>
        <span id="downloader-subtitle-meta"></span>
        <span id="downloader-output-summary"></span>
        <span id="downloader-quality-status"></span>
        <button id="downloader-advanced-formats"></button>
        <button id="download-button"></button>
        <button id="enqueue-button"></button>
      </section>`;
    jest.doMock("../i18n.js", () => ({ t: translate }));
    jest.doMock("../videoInfoCache.js", () => ({
      getCachedVideoInfo: jest.fn(() => null),
      setCachedVideoInfo: jest.fn(),
    }));
    jest.doMock("../videoInfoBroker.js", () => ({
      getVideoInfo: jest.fn(async () => info),
    }));
    jest.doMock("../downloadQualityModal.js", () => ({
      openDownloadQualityModal: jest.fn(async () => ({
        type: "subtitle-only",
        subtitleLang: "ru",
        subtitleSource: "manual",
      })),
    }));
  });

  test("renders preview selections, applies Advanced result, and resets", async () => {
    const card = await import("../downloaderSelectionCard.js");
    card.initDownloaderSelectionCard();
    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, {
        detail: { info, url: "https://example.com/video" },
      }),
    );

    expect(
      document.getElementById("downloader-video-quality").options.length,
    ).toBeGreaterThan(1);
    expect(
      document.getElementById("downloader-output-summary").textContent,
    ).toContain("H.264");

    document.getElementById("downloader-advanced-formats").click();
    await Promise.resolve();
    expect(document.getElementById("downloader-subtitle-quality").value).toBe(
      "subtitle-manual-ru",
    );

    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, { detail: { info: null, url: "" } }),
    );
    expect(document.getElementById("downloader-video-quality").disabled).toBe(
      true,
    );
    expect(document.getElementById("download-button").disabled).toBe(true);
  });

  test("ignores stale preview metadata for a previous URL", async () => {
    const card = await import("../downloaderSelectionCard.js");
    card.initDownloaderSelectionCard();
    document.getElementById("url").value = "https://example.com/new";

    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, {
        detail: { info, url: "https://example.com/old" },
      }),
    );

    expect(document.getElementById("downloader-video-quality").disabled).toBe(
      true,
    );
  });

  test("shows loading and error states without opening Advanced Formats", async () => {
    const card = await import("../downloaderSelectionCard.js");
    const { openDownloadQualityModal } = require("../downloadQualityModal.js");
    card.initDownloaderSelectionCard();

    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, {
        detail: {
          info: { success: true, title: "Preview", formats: [] },
          url: "https://example.com/video",
        },
      }),
    );
    expect(
      document.getElementById("downloader-quality-status").textContent,
    ).toBe("quality.quick.loading");

    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, {
        detail: {
          info: null,
          url: "https://example.com/video",
          error: true,
        },
      }),
    );
    expect(
      document.getElementById("downloader-quality-status").textContent,
    ).toBe("quality.quick.error");
    expect(openDownloadQualityModal).not.toHaveBeenCalled();
  });

  test("keeps playlist media selection but suppresses subtitle companions", async () => {
    const card = await import("../downloaderSelectionCard.js");
    card.initDownloaderSelectionCard();
    const playlistInfo = { ...info, entries: [{ id: "1" }, { id: "2" }] };
    window.dispatchEvent(
      new CustomEvent(card.PREVIEW_EVENT, {
        detail: { info: playlistInfo, url: "https://example.com/video" },
      }),
    );
    const subtitleSelect = document.getElementById(
      "downloader-subtitle-quality",
    );
    subtitleSelect.value = "subtitle-manual-ru";
    subtitleSelect.dispatchEvent(new Event("change", { bubbles: true }));

    await expect(
      card.resolveDownloaderSelection("https://example.com/video"),
    ).resolves.toMatchObject({
      mediaPayload: expect.any(Object),
      subtitlePayloads: [],
    });
    expect(document.getElementById("downloader-quality-status").textContent).toBe(
      "quality.quick.subtitleSingleOnly",
    );
  });
});
