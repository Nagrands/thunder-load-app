const mockApp = {
  dock: { show: jest.fn() },
  focus: jest.fn(),
  show: jest.fn(),
};

jest.mock("electron", () => ({
  app: mockApp,
}));

describe("bringMainWindowToFront", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  test("activates and focuses window on macOS", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { bringMainWindowToFront } = require("../windowActivation");
    const mainWindow = {
      isDestroyed: jest.fn(() => false),
      isMinimized: jest.fn(() => true),
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
      moveTop: jest.fn(),
    };

    const ok = bringMainWindowToFront(mainWindow);

    expect(ok).toBe(true);
    expect(mockApp.dock.show).toHaveBeenCalled();
    expect(mockApp.focus).toHaveBeenCalledWith({ steal: true });
    expect(mainWindow.restore).toHaveBeenCalled();
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();

    jest.advanceTimersByTime(35);
    expect(mainWindow.show).toHaveBeenCalledTimes(2);
    expect(mainWindow.focus).toHaveBeenCalledTimes(2);
  });

  test("returns false for missing window", () => {
    const { bringMainWindowToFront } = require("../windowActivation");
    expect(bringMainWindowToFront(null)).toBe(false);
  });
});
