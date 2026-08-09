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

describe("preload history API", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    require("../preload");
  });

  test("exposes a safe history update subscription with cleanup", () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];
    const callback = jest.fn();
    const unsubscribe = api.onHistoryUpdated(callback);
    const wrappedListener = mockOn.mock.calls[0][1];

    wrappedListener({}, { count: 3 });
    unsubscribe();

    expect(mockOn).toHaveBeenCalledWith(
      "history-updated",
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith({ count: 3 });
    expect(mockRemoveListener).toHaveBeenCalledWith(
      "history-updated",
      wrappedListener,
    );
  });

  test("allows the batched history file inspection channel", async () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];
    const filePaths = ["/tmp/one.mp4", "/tmp/two.mp4"];

    await api.invoke("history:inspect-files", filePaths);

    expect(mockInvoke).toHaveBeenCalledWith("history:inspect-files", filePaths);
  });
});
