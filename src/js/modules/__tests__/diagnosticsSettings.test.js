import { initDiagnosticsSettings } from "../features/settings/diagnosticsSettings.js";

jest.mock("../i18n.js", () => ({ t: (key) => key }));
jest.mock("../toast.js", () => ({ showToast: jest.fn() }));

describe("diagnosticsSettings", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="settings-diagnostics-debug-toggle" type="checkbox" />
      <button id="settings-diagnostics-export" type="button"></button>
    `;
    window.electron = {
      diagnostics: {
        getLevel: jest.fn().mockResolvedValue("info"),
        setLevel: jest.fn().mockResolvedValue("debug"),
        export: jest.fn().mockResolvedValue({ ok: true, data: { filePath: "/tmp/logs.zip" } }),
      },
    };
  });

  test("loads, changes and exports diagnostics without duplicate handlers", async () => {
    initDiagnosticsSettings();
    initDiagnosticsSettings();
    await Promise.resolve();
    const toggle = document.getElementById("settings-diagnostics-debug-toggle");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    document.getElementById("settings-diagnostics-export").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(window.electron.diagnostics.getLevel).toHaveBeenCalledTimes(1);
    expect(window.electron.diagnostics.setLevel).toHaveBeenCalledTimes(1);
    expect(window.electron.diagnostics.export).toHaveBeenCalledTimes(1);
  });
});
