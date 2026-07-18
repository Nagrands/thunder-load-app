import createMediaSessionManager from "../nowPlaying/mediaSessionManager.js";

function createHarness({
  unsupportedAction = null,
  positionImplementation = null,
} = {}) {
  const handlers = new Map();
  const mediaSession = {
    metadata: null,
    playbackState: "none",
    setActionHandler: jest.fn((action, handler) => {
      if (action === unsupportedAction) throw new Error("Unsupported action");
      handlers.set(action, handler);
    }),
    setPositionState: jest.fn(positionImplementation || (() => {})),
  };
  const snapshot = {
    currentTrack: {
      id: "track-one",
      title: "Thunder",
      artist: "NGR",
      album: "Storm",
      artworkUrl: "file:///cover.png",
    },
    isPlaying: true,
    isStopped: false,
    positionRevision: 0,
    currentTime: 12,
    duration: 120,
  };
  const controller = {
    play: jest.fn().mockResolvedValue(true),
    pause: jest.fn(),
    next: jest.fn().mockResolvedValue(true),
    previous: jest.fn().mockResolvedValue(true),
    stop: jest.fn(),
    seek: jest.fn((position) => {
      snapshot.currentTime = position;
    }),
    getSnapshot: jest.fn(() => ({ ...snapshot })),
  };
  const Metadata = jest.fn(function MediaMetadata(init) {
    Object.assign(this, init);
  });
  let time = 0;
  const manager = createMediaSessionManager({
    controller,
    mediaSession,
    Metadata,
    now: () => time,
    fallbackArtworkUrl: "../assets/icons/app/app-icon-512.png",
  });
  return {
    controller,
    handlers,
    manager,
    mediaSession,
    Metadata,
    snapshot,
    setTime(value) {
      time = value;
    },
  };
}

describe("MediaSessionManager", () => {
  test("publishes metadata, provider artwork and position state", () => {
    const { manager, mediaSession, Metadata, snapshot } = createHarness();

    manager.sync(snapshot);

    expect(Metadata).toHaveBeenCalledWith({
      title: "Thunder",
      artist: "NGR",
      album: "Storm",
      artwork: [{ src: "file:///cover.png" }],
    });
    expect(mediaSession.metadata).toMatchObject({
      title: "Thunder",
      artist: "NGR",
    });
    expect(mediaSession.playbackState).toBe("playing");
    expect(mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 120,
      position: 12,
      playbackRate: 1,
    });
  });

  test("uses the packaged 512px app icon when artwork is missing", () => {
    const { manager, Metadata, snapshot } = createHarness();
    snapshot.currentTrack.artworkUrl = "";

    manager.sync(snapshot);

    expect(Metadata.mock.calls[0][0].artwork).toEqual([
      {
        src: "../assets/icons/app/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ]);
  });

  test("routes transport and seek actions to the playback controller", () => {
    const { controller, handlers, manager, snapshot } = createHarness();
    manager.sync(snapshot);

    handlers.get("play")();
    handlers.get("pause")();
    handlers.get("nexttrack")();
    handlers.get("previoustrack")();
    handlers.get("seekto")({ seekTime: 500 });
    expect(controller.seek).toHaveBeenLastCalledWith(120);
    snapshot.currentTime = 50;
    handlers.get("seekbackward")({});
    expect(controller.seek).toHaveBeenLastCalledWith(40);
    handlers.get("seekforward")({ seekOffset: 7 });
    expect(controller.seek).toHaveBeenLastCalledWith(47);
    handlers.get("stop")();

    expect(controller.play).toHaveBeenCalledTimes(1);
    expect(controller.pause).toHaveBeenCalledTimes(1);
    expect(controller.next).toHaveBeenCalledTimes(1);
    expect(controller.previous).toHaveBeenCalledTimes(1);
    expect(controller.stop).toHaveBeenCalledTimes(1);
  });

  test("updates position immediately after a system seek", () => {
    const { handlers, manager, mediaSession, snapshot } = createHarness();
    manager.sync(snapshot);
    mediaSession.setPositionState.mockClear();

    handlers.get("seekto")({ seekTime: 35 });

    expect(mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 120,
      position: 35,
      playbackRate: 1,
    });
  });

  test("updates position immediately after a controller seek", () => {
    const { manager, mediaSession, snapshot } = createHarness();
    manager.sync(snapshot);
    mediaSession.setPositionState.mockClear();

    snapshot.currentTime = 12.25;
    snapshot.positionRevision += 1;
    manager.sync(snapshot);

    expect(mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 120,
      position: 12.25,
      playbackRate: 1,
    });
  });

  test("throttles ordinary playing progress to one update per second", () => {
    const { manager, mediaSession, setTime, snapshot } = createHarness();
    manager.sync(snapshot);
    mediaSession.setPositionState.mockClear();

    setTime(250);
    snapshot.currentTime = 12.25;
    manager.sync(snapshot);
    setTime(999);
    snapshot.currentTime = 30;
    manager.sync(snapshot);
    expect(mediaSession.setPositionState).not.toHaveBeenCalled();

    setTime(1000);
    snapshot.currentTime = 13;
    manager.sync(snapshot);
    expect(mediaSession.setPositionState).toHaveBeenCalledTimes(1);
  });

  test("updates immediately on track and playback state changes", () => {
    const { manager, mediaSession, snapshot } = createHarness();
    manager.sync(snapshot);
    mediaSession.setPositionState.mockClear();

    snapshot.isPlaying = false;
    manager.sync(snapshot);
    expect(mediaSession.playbackState).toBe("paused");
    expect(mediaSession.setPositionState).toHaveBeenCalledTimes(1);

    mediaSession.setPositionState.mockClear();
    snapshot.currentTrack = {
      ...snapshot.currentTrack,
      id: "track-two",
      title: "Lightning",
    };
    snapshot.currentTime = 0;
    manager.sync(snapshot);
    expect(mediaSession.metadata.title).toBe("Lightning");
    expect(mediaSession.setPositionState).toHaveBeenCalledTimes(1);
  });

  test("does not publish invalid duration and clamps snapshot position", () => {
    const { manager, mediaSession, snapshot } = createHarness();
    snapshot.duration = 0;
    manager.sync(snapshot);
    expect(mediaSession.setPositionState).not.toHaveBeenCalled();

    snapshot.duration = 30;
    snapshot.currentTime = 50;
    manager.sync(snapshot);
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith({
      duration: 30,
      position: 30,
      playbackRate: 1,
    });
  });

  test("continues registering actions when one action is unsupported", () => {
    const { handlers, mediaSession } = createHarness({
      unsupportedAction: "seekforward",
    });

    expect(mediaSession.setActionHandler).toHaveBeenCalledWith(
      "seekforward",
      expect.any(Function),
    );
    expect(handlers.has("seekforward")).toBe(false);
    expect(handlers.has("stop")).toBe(true);
  });

  test("isolates Media Session errors and unavailable APIs", () => {
    const { manager, mediaSession, snapshot } = createHarness({
      positionImplementation: () => {
        throw new Error("Position unavailable");
      },
    });

    expect(() => manager.sync(snapshot)).not.toThrow();
    expect(mediaSession.metadata.title).toBe("Thunder");
    const unavailableManager = createMediaSessionManager({
      controller: {},
      mediaSession: null,
    });
    expect(() => unavailableManager.sync(snapshot)).not.toThrow();
    expect(() => unavailableManager.dispose()).not.toThrow();
  });

  test("clears stopped sessions and unregisters every action on dispose", () => {
    const { manager, mediaSession, snapshot } = createHarness();
    manager.sync(snapshot);

    snapshot.isStopped = true;
    manager.sync(snapshot);
    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith();

    manager.dispose();
    expect(mediaSession.setActionHandler).toHaveBeenCalledWith("play", null);
    expect(mediaSession.setActionHandler).toHaveBeenCalledWith("stop", null);
    expect(() => manager.sync({ ...snapshot, isStopped: false })).not.toThrow();
    expect(mediaSession.metadata).toBeNull();
  });
});
