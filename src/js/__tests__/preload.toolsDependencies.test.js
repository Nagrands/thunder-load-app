const mockExposeInMainWorld = jest.fn();
const mockInvoke = jest.fn();

jest.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
  ipcRenderer: {
    invoke: mockInvoke,
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn(),
  },
  webUtils: { getPathForFile: jest.fn() },
}));

describe("preload dependency tools API", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    require("../preload");
  });

  test("exposes the validated dependency action channel", async () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];
    const payload = { id: "deno", action: "reinstall" };

    await api.tools.runDependencyAction(payload);

    expect(mockInvoke).toHaveBeenCalledWith(
      "tools:runDependencyAction",
      payload,
    );
  });

  test("preserves legacy dependency methods", async () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];

    await api.tools.installAll();
    await api.tools.updateYtDlp();
    await api.tools.updateFfmpeg();
    await api.tools.getVersions();
    await api.tools.checkUpdates({ noCache: true });

    expect(mockInvoke.mock.calls).toEqual([
      ["tools:installAll"],
      ["tools:updateYtDlp"],
      ["tools:updateFfmpeg"],
      ["tools:getVersions"],
      ["tools:checkUpdates", { noCache: true }],
    ]);
  });
});
