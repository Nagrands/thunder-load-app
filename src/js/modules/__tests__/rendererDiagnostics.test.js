import {
  logRendererError,
  logRendererEvent,
  serializeRendererError,
} from "../rendererDiagnostics.js";

describe("rendererDiagnostics", () => {
  beforeEach(() => {
    window.electron = { diagnostics: { log: jest.fn() } };
  });

  test("forwards structured renderer events to the safe preload API", () => {
    logRendererEvent("Settings", "info", "setting-changed", {
      enabled: true,
    });

    expect(window.electron.diagnostics.log).toHaveBeenCalledWith(
      "Settings",
      "info",
      "setting-changed",
      { enabled: true },
    );
  });

  test("serializes errors without exposing a stack", () => {
    const error = Object.assign(new Error("failed"), { code: "E_TEST" });

    expect(serializeRendererError(error)).toEqual({
      name: "Error",
      code: "E_TEST",
      message: "failed",
    });
    logRendererError("Settings", "operation-failed", error, { attempt: 2 });

    expect(window.electron.diagnostics.log).toHaveBeenCalledWith(
      "Settings",
      "error",
      "operation-failed",
      {
        attempt: 2,
        error: { name: "Error", code: "E_TEST", message: "failed" },
      },
    );
  });

  test("does not throw when diagnostics bridge is unavailable", () => {
    delete window.electron;
    expect(() =>
      logRendererEvent("Main", "debug", "bridge-unavailable"),
    ).not.toThrow();
  });
});
