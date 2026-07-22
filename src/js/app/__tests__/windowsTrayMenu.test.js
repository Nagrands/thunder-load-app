const { EventEmitter } = require("events");

jest.mock("electron", () => ({ BrowserWindow: jest.fn(), screen: {} }));

const {
  calculateTrayMenuPosition,
  createWindowsTrayMenuController,
} = require("../windowsTrayMenu");

class PopupMock extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.visible = false;
    this.destroyed = false;
    this.webContents = {};
    this.loadFile = jest.fn().mockResolvedValue(undefined);
    this.setMenuBarVisibility = jest.fn();
    this.setPosition = jest.fn();
    this.show = jest.fn(() => {
      this.visible = true;
    });
    this.hide = jest.fn(() => {
      this.visible = false;
    });
    this.focus = jest.fn();
    this.destroy = jest.fn(() => {
      this.destroyed = true;
    });
  }

  isVisible() {
    return this.visible;
  }

  isDestroyed() {
    return this.destroyed;
  }
}

describe("Windows tray panel controller", () => {
  let platformDescriptor;

  beforeEach(() => {
    platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
  });

  afterEach(() => {
    if (platformDescriptor) {
      Object.defineProperty(process, "platform", platformDescriptor);
    }
  });

  test("positions the panel above a bottom taskbar and clamps it to work area", () => {
    expect(
      calculateTrayMenuPosition({
        trayBounds: { x: 1860, y: 1040, width: 24, height: 24 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        panelSize: { width: 320, height: 256 },
      }),
    ).toEqual({ x: 1592, y: 776 });
  });

  test("positions the panel below a top taskbar", () => {
    expect(
      calculateTrayMenuPosition({
        trayBounds: { x: 20, y: 0, width: 24, height: 24 },
        workArea: { x: 0, y: 24, width: 1600, height: 876 },
        panelSize: { width: 320, height: 256 },
      }),
    ).toEqual({ x: 8, y: 32 });
  });

  test("keeps the panel inside a negative-coordinate secondary display", () => {
    const position = calculateTrayMenuPosition({
      trayBounds: { x: -30, y: 900, width: 24, height: 24 },
      workArea: { x: -1280, y: 0, width: 1280, height: 900 },
      panelSize: { width: 320, height: 256 },
    });
    expect(position.x).toBeLessThanOrEqual(-328);
    expect(position.x).toBeGreaterThanOrEqual(-1272);
    expect(position.y).toBeGreaterThanOrEqual(8);
  });

  test("reuses one popup and toggles it on repeated right clicks", async () => {
    const windows = [];
    const controller = createWindowsTrayMenuController({
      BrowserWindowClass: class extends PopupMock {
        constructor(options) {
          super(options);
          windows.push(this);
        }
      },
      screenApi: {
        getDisplayNearestPoint: () => ({
          workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        }),
      },
    });
    controller.configure({
      app: { getAppPath: () => "/app" },
      tray: { getBounds: () => ({ x: 1800, y: 1040, width: 24, height: 24 }) },
    });

    expect(await controller.toggle()).toBe(true);
    expect(windows).toHaveLength(1);
    expect(windows[0].show).toHaveBeenCalledTimes(1);
    expect(windows[0].options.skipTaskbar).toBe(true);
    expect(await controller.toggle()).toBe(true);
    expect(windows).toHaveLength(1);
    expect(windows[0].hide).toHaveBeenCalledTimes(1);
  });

  test("returns safe state and rejects unavailable or unknown actions", async () => {
    const open = jest.fn();
    const controller = createWindowsTrayMenuController();
    controller.configure({
      getState: () => ({
        lastVideo: { enabled: false, fileName: "/private/path/video.mp4" },
        downloads: { enabled: true },
      }),
      handlers: { open },
    });

    expect(controller.getSafeState()).toEqual({
      lastVideo: { enabled: false, fileName: "video.mp4" },
      downloads: { enabled: true },
    });
    expect(await controller.performAction("last-video")).toEqual({
      success: false,
      error: "TRAY_ACTION_UNAVAILABLE",
    });
    expect(await controller.performAction("invalid")).toEqual({
      success: false,
      error: "INVALID_TRAY_ACTION",
    });
    expect(await controller.performAction("open")).toEqual({
      success: true,
      data: null,
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  test("returns false so the native menu can be used when HTML fails", async () => {
    class FailedPopup extends PopupMock {
      constructor(options) {
        super(options);
        this.loadFile.mockRejectedValue(new Error("missing HTML"));
      }
    }
    const controller = createWindowsTrayMenuController({
      BrowserWindowClass: FailedPopup,
      screenApi: {},
    });
    controller.configure({ app: { getAppPath: () => "/app" } });

    await expect(controller.toggle()).resolves.toBe(false);
  });
});
