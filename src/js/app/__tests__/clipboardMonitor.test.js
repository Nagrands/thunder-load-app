jest.mock("electron", () => ({
  clipboard: {
    readText: jest.fn(() => ""),
  },
}));

const mockExpandMainWindowForToggle = jest.fn();

jest.mock("../windowActivation", () => ({
  expandMainWindowForToggle: (...args) =>
    mockExpandMainWindowForToggle(...args),
}));

describe("ClipboardMonitor", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("expands window for valid supported URLs", () => {
    const { clipboard } = require("electron");
    const ClipboardMonitor = require("../clipboardMonitor");
    const store = {
      get: jest.fn((key, fallback) =>
        key === "openOnCopyUrl" ? true : fallback,
      ),
    };
    const mainWindow = { id: "main" };
    const monitor = new ClipboardMonitor(
      store,
      mainWindow,
      jest.fn(() => true),
      jest.fn(() => true),
    );

    clipboard.readText.mockReturnValue("https://example.com/video");
    monitor.start();
    jest.advanceTimersByTime(1000);

    expect(mockExpandMainWindowForToggle).toHaveBeenCalledTimes(1);
    expect(mockExpandMainWindowForToggle).toHaveBeenCalledWith(mainWindow);
  });

  test("does not start when open-on-copy is disabled", () => {
    const { clipboard } = require("electron");
    const ClipboardMonitor = require("../clipboardMonitor");
    const store = {
      get: jest.fn((key, fallback) =>
        key === "openOnCopyUrl" ? false : fallback,
      ),
    };
    const monitor = new ClipboardMonitor(
      store,
      { id: "main" },
      jest.fn(() => true),
      jest.fn(() => true),
    );

    clipboard.readText.mockReturnValue("https://example.com/video");
    monitor.start();
    jest.advanceTimersByTime(1000);

    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(mockExpandMainWindowForToggle).not.toHaveBeenCalled();
  });

  test("does not expand window for invalid or unsupported URLs", () => {
    const { clipboard } = require("electron");
    const ClipboardMonitor = require("../clipboardMonitor");
    const store = {
      get: jest.fn((key, fallback) =>
        key === "openOnCopyUrl" ? true : fallback,
      ),
    };
    const mainWindow = { id: "main" };
    const isValidUrl = jest.fn(() => false);
    const isSupportedUrl = jest.fn(() => true);
    const monitor = new ClipboardMonitor(
      store,
      mainWindow,
      isValidUrl,
      isSupportedUrl,
    );

    clipboard.readText.mockReturnValue("not-a-url");
    monitor.start();
    jest.advanceTimersByTime(1000);

    expect(isValidUrl).toHaveBeenCalledWith("not-a-url");
    expect(isSupportedUrl).not.toHaveBeenCalled();
    expect(mockExpandMainWindowForToggle).not.toHaveBeenCalled();
  });
});
