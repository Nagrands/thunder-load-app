describe("Windows tray panel preload", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("exposes only the dedicated tray API", async () => {
    const exposeInMainWorld = jest.fn();
    const invoke = jest.fn().mockResolvedValue({ success: true });
    const send = jest.fn();
    jest.doMock("electron", () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer: { invoke, send },
    }));

    require("../windowsTrayMenuPreload");
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, api] = exposeInMainWorld.mock.calls[0];
    expect(name).toBe("windowsTrayMenu");
    expect(Object.keys(api).sort()).toEqual([
      "close",
      "getState",
      "performAction",
    ]);

    await api.getState();
    await api.performAction("open");
    api.close();
    expect(invoke).toHaveBeenNthCalledWith(1, "windows-tray-menu:get-state");
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "windows-tray-menu:action",
      "open",
    );
    expect(send).toHaveBeenCalledWith("windows-tray-menu:close");
  });
});
