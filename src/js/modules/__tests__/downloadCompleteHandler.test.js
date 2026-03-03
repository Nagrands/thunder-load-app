/** @jest-environment jsdom */

const mockShowConfirmationDialog = jest.fn();
const mockShowToast = jest.fn();
const mockShowUrlActionButtons = jest.fn();

jest.mock("../modals.js", () => ({
  showConfirmationDialog: (...args) => mockShowConfirmationDialog(...args),
}));
jest.mock("../toast.js", () => ({
  showToast: (...args) => mockShowToast(...args),
}));
jest.mock("../urlInputHandler.js", () => ({
  showUrlActionButtons: (...args) => mockShowUrlActionButtons(...args),
}));

describe("downloadCompleteHandler", () => {
  beforeEach(() => {
    jest.resetModules();
    mockShowConfirmationDialog.mockClear();
    mockShowToast.mockClear();
    mockShowUrlActionButtons.mockClear();
    global.window = global.window || {};
  });

  test("does not open completion modal when setting is disabled", async () => {
    let handler = null;
    window.electron = {
      on: jest.fn((event, cb) => {
        if (event === "download-complete") handler = cb;
      }),
      invoke: jest.fn((channel) => {
        if (channel === "get-disable-complete-modal-status") {
          return Promise.resolve(true);
        }
        return Promise.resolve(null);
      }),
    };

    const { initDownloadCompleteHandler } = await import(
      "../downloadCompleteHandler.js"
    );
    initDownloadCompleteHandler();

    expect(typeof handler).toBe("function");
    await handler({ title: "demo", filePath: "/tmp/demo.mp4" });

    expect(mockShowUrlActionButtons).toHaveBeenCalledTimes(1);
    expect(mockShowConfirmationDialog).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("opens completion modal when setting is enabled", async () => {
    let handler = null;
    window.electron = {
      on: jest.fn((event, cb) => {
        if (event === "download-complete") handler = cb;
      }),
      invoke: jest.fn((channel) => {
        if (channel === "get-disable-complete-modal-status") {
          return Promise.resolve(false);
        }
        return Promise.resolve(null);
      }),
    };

    const { initDownloadCompleteHandler } = await import(
      "../downloadCompleteHandler.js"
    );
    initDownloadCompleteHandler();

    expect(typeof handler).toBe("function");
    await handler({ title: "demo", filePath: "/tmp/demo.mp4" });

    expect(mockShowUrlActionButtons).toHaveBeenCalledTimes(1);
    expect(mockShowConfirmationDialog).toHaveBeenCalledTimes(1);
  });
});
