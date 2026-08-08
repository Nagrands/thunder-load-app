const { createTrackedIpcMain } = require("../ipcRuntime");

describe("ipcRuntime", () => {
  test("removes only owned handlers and listeners once", async () => {
    const ipcMain = {
      handle: jest.fn(),
      on: jest.fn(),
      removeHandler: jest.fn(),
      removeListener: jest.fn(),
    };
    const runtime = createTrackedIpcMain(ipcMain);
    const listener = jest.fn();
    runtime.api.handle("test:invoke", jest.fn());
    runtime.api.on("test:event", listener);
    await runtime.dispose();
    await runtime.dispose();
    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(1);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith("test:invoke");
    expect(ipcMain.removeListener).toHaveBeenCalledTimes(1);
    expect(ipcMain.removeListener).toHaveBeenCalledWith(
      "test:event",
      expect.any(Function),
    );
  });
});
