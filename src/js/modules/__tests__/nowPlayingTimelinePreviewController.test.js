import { createTimelinePreviewController } from "../nowPlaying/timelinePreviewController.js";

describe("timelinePreviewController", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <section>
        <span data-ui="timeline-preview" hidden>
          <img data-ui="timeline-preview-image" alt="" />
          <span data-ui="timeline-preview-time"></span>
        </span>
        <input data-action="seek" type="range" min="0" max="100" value="0" />
      </section>
    `;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("debounces frame requests and does not seek active playback", async () => {
    const root = document.querySelector("section");
    const progress = root.querySelector("input");
    progress.getBoundingClientRect = jest.fn(() => ({
      left: 100,
      width: 400,
    }));
    const controller = {
      getPreviewContext: jest.fn(() => ({ sessionId: "session" })),
      getSnapshot: jest.fn(() => ({
        currentTrack: {
          id: "video",
          kind: "video",
          artworkUrl: "",
        },
        duration: 100,
      })),
      seek: jest.fn(),
    };
    const api = {
      cancelTimelinePreview: jest.fn(),
      getTimelinePreview: jest.fn().mockResolvedValue({
        success: true,
        data: {
          dataUrl: "data:image/jpeg;base64,frame",
          requestId: "preview",
          timestamp: 50,
        },
      }),
    };
    const onPreviewImage = jest.fn();
    const previewController = createTimelinePreviewController({
      api,
      controller,
      onPreviewImage,
      progress,
      root,
    });

    progress.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 300 }),
    );
    expect(root.querySelector('[data-ui="timeline-preview"]').hidden).toBe(
      false,
    );
    expect(root.querySelector('[data-ui="timeline-preview-time"]').textContent)
      .toBe("0:50");
    jest.advanceTimersByTime(120);
    await Promise.resolve();
    await Promise.resolve();

    expect(api.getTimelinePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session",
        timestamp: 50,
        trackId: "video",
      }),
    );
    expect(controller.seek).not.toHaveBeenCalled();
    expect(onPreviewImage).toHaveBeenCalledWith(
      "video",
      "data:image/jpeg;base64,frame",
    );
    previewController.dispose();
  });

  test("cancels a pending request when pointer leaves", () => {
    const root = document.querySelector("section");
    const progress = root.querySelector("input");
    progress.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      width: 100,
    }));
    const api = {
      cancelTimelinePreview: jest.fn(),
      getTimelinePreview: jest.fn(() => new Promise(() => {})),
    };
    const previewController = createTimelinePreviewController({
      api,
      controller: {
        getPreviewContext: () => ({}),
        getSnapshot: () => ({
          currentTrack: { id: "video", kind: "video" },
          duration: 100,
        }),
      },
      progress,
      root,
    });

    progress.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 25 }),
    );
    jest.advanceTimersByTime(120);
    progress.dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));

    expect(api.cancelTimelinePreview).toHaveBeenCalledWith(
      expect.stringMatching(/^timeline-/),
    );
    previewController.dispose();
  });

  test("requests the first video frame immediately when the active track changes", async () => {
    const root = document.querySelector("section");
    const progress = root.querySelector("input");
    const onPreviewImage = jest.fn();
    const api = {
      cancelTimelinePreview: jest.fn(),
      getTimelinePreview: jest.fn().mockResolvedValue({
        success: true,
        data: {
          dataUrl: "data:image/jpeg;base64,eager-frame",
          timestamp: 2,
        },
      }),
    };
    const previewController = createTimelinePreviewController({
      api,
      controller: {
        getPreviewContext: () => ({ sessionId: "active-session" }),
      },
      onPreviewImage,
      progress,
      root,
    });
    const snapshot = {
      currentTrack: {
        id: "video",
        kind: "video",
        duration: 80,
      },
      duration: 80,
    };

    previewController.update(snapshot);
    await Promise.resolve();
    await Promise.resolve();

    expect(api.getTimelinePreview).toHaveBeenCalledTimes(1);
    expect(api.getTimelinePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.stringMatching(/^timeline-/),
        sessionId: "active-session",
        timestamp: 2,
        trackId: "video",
      }),
    );
    expect(onPreviewImage).toHaveBeenCalledWith(
      "video",
      "data:image/jpeg;base64,eager-frame",
    );

    previewController.update(snapshot);
    expect(api.getTimelinePreview).toHaveBeenCalledTimes(1);
    previewController.dispose();
  });
});
