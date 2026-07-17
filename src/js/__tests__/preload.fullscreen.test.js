const mockExposeInMainWorld = jest.fn();
const mockInvoke = jest.fn();
const mockOn = jest.fn();
const mockRemoveListener = jest.fn();

jest.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    once: jest.fn(),
    removeListener: mockRemoveListener,
    removeAllListeners: jest.fn(),
    send: jest.fn(),
  },
  webUtils: { getPathForFile: jest.fn() },
}));

describe("preload fullscreen API", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    require("../preload");
  });

  test("exposes whitelisted fullscreen invokes", async () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];

    await api.fullscreen.getState();
    await api.fullscreen.setState(true);

    expect(mockInvoke.mock.calls).toEqual([
      ["window:get-fullscreen"],
      ["window:set-fullscreen", true],
    ]);
  });

  test("unwraps native fullscreen events to a boolean and unsubscribes", () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];
    const callback = jest.fn();
    const unsubscribe = api.fullscreen.onChanged(callback);
    const wrappedListener = mockOn.mock.calls[0][1];

    wrappedListener({}, { isFullscreen: true });
    unsubscribe();

    expect(mockOn).toHaveBeenCalledWith(
      "window:fullscreen-changed",
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith(true);
    expect(mockRemoveListener).toHaveBeenCalledWith(
      "window:fullscreen-changed",
      wrappedListener,
    );
  });
});
