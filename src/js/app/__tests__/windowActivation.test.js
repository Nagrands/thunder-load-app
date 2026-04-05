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

describe("expandMainWindowForToggle", () => {
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

  test("maximizes visible non-maximized window on Windows", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    const { expandMainWindowForToggle } = require("../windowActivation");
    const mainWindow = {
      isDestroyed: jest.fn(() => false),
      isVisible: jest.fn(() => true),
      isMinimized: jest.fn(() => false),
      isMaximized: jest.fn(() => false),
      restore: jest.fn(),
      maximize: jest.fn(),
      show: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      focus: jest.fn(),
      moveTop: jest.fn(),
    };

    const ok = expandMainWindowForToggle(mainWindow);

    expect(ok).toBe(true);
    expect(mockApp.focus).toHaveBeenCalled();
    expect(mainWindow.restore).not.toHaveBeenCalled();
    expect(mainWindow.maximize).toHaveBeenCalledTimes(1);
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.setAlwaysOnTop).toHaveBeenNthCalledWith(
      1,
      true,
      "screen-saver",
    );
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
    expect(mainWindow.moveTop).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(85);
    expect(mainWindow.show).toHaveBeenCalledTimes(2);
    expect(mainWindow.focus).toHaveBeenCalledTimes(2);
    expect(mainWindow.moveTop).toHaveBeenCalledTimes(2);
    expect(mainWindow.setAlwaysOnTop).toHaveBeenNthCalledWith(2, false);
  });

  test("restores and maximizes minimized window on Windows", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    const { expandMainWindowForToggle } = require("../windowActivation");
    const mainWindow = {
      isDestroyed: jest.fn(() => false),
      isVisible: jest.fn(() => true),
      isMinimized: jest.fn(() => true),
      isMaximized: jest.fn(() => false),
      restore: jest.fn(),
      maximize: jest.fn(),
      show: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      focus: jest.fn(),
      moveTop: jest.fn(),
    };

    const ok = expandMainWindowForToggle(mainWindow);

    expect(ok).toBe(true);
    expect(mockApp.focus).toHaveBeenCalled();
    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.maximize).toHaveBeenCalledTimes(1);
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.setAlwaysOnTop).toHaveBeenNthCalledWith(
      1,
      true,
      "screen-saver",
    );
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
    expect(mainWindow.moveTop).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(85);
    expect(mainWindow.show).toHaveBeenCalledTimes(2);
    expect(mainWindow.focus).toHaveBeenCalledTimes(2);
    expect(mainWindow.moveTop).toHaveBeenCalledTimes(2);
    expect(mainWindow.setAlwaysOnTop).toHaveBeenNthCalledWith(2, false);
  });

  test("does nothing for hidden window on Windows", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    const { expandMainWindowForToggle } = require("../windowActivation");
    const mainWindow = {
      isDestroyed: jest.fn(() => false),
      isVisible: jest.fn(() => false),
      isMinimized: jest.fn(() => true),
      isMaximized: jest.fn(() => false),
      restore: jest.fn(),
      maximize: jest.fn(),
      show: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      focus: jest.fn(),
      moveTop: jest.fn(),
    };

    const ok = expandMainWindowForToggle(mainWindow);

    expect(ok).toBe(false);
    expect(mainWindow.restore).not.toHaveBeenCalled();
    expect(mainWindow.maximize).not.toHaveBeenCalled();
    expect(mainWindow.show).not.toHaveBeenCalled();
    expect(mainWindow.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(mainWindow.focus).not.toHaveBeenCalled();
    expect(mainWindow.moveTop).not.toHaveBeenCalled();
  });

  test("keeps non-Windows behavior unchanged", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { expandMainWindowForToggle } = require("../windowActivation");
    const mainWindow = {
      isDestroyed: jest.fn(() => false),
      isVisible: jest.fn(() => false),
      isMinimized: jest.fn(() => true),
      isMaximized: jest.fn(() => false),
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
      moveTop: jest.fn(),
    };

    const ok = expandMainWindowForToggle(mainWindow);

    expect(ok).toBe(true);
    expect(mockApp.dock.show).toHaveBeenCalled();
    expect(mockApp.focus).toHaveBeenCalledWith({ steal: true });
    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });
});
