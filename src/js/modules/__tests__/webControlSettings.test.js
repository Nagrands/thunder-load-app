describe("webControlSettings", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <input id="settings-web-control-toggle" type="checkbox" />
      <input id="settings-web-control-url" readonly />
      <input id="settings-web-control-lan-url" readonly />
      <button id="settings-web-control-open"></button>
      <button id="settings-web-control-restart"></button>
      <button id="settings-web-control-copy-lan"></button>
      <div class="settings-web-control-panel__status-row">
        <span id="settings-web-control-status"></span>
      </div>`;
    Object.defineProperty(global.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    window.electron = {
      invoke: jest.fn(async (channel, value) => {
        if (channel === "web:getStatus") {
          return {
            success: true,
            status: {
              enabled: true,
              running: true,
              localUrl: "http://127.0.0.1:4321/",
              lanUrls: ["http://192.168.1.10:4321/"],
              port: 4321,
            },
          };
        }
        if (channel === "web:setEnabled") {
          return {
            success: true,
            status: {
              enabled: Boolean(value),
              running: Boolean(value),
              localUrl: value ? "http://127.0.0.1:4321/" : "",
              lanUrls: value ? ["http://192.168.1.10:4321/"] : [],
              port: value ? 4321 : 0,
            },
          };
        }
        if (channel === "web:restart" || channel === "web:open") {
          return {
            success: true,
            status: {
              enabled: true,
              running: true,
              localUrl: "http://127.0.0.1:4321/",
              lanUrls: ["http://192.168.1.10:4321/"],
              port: 4321,
            },
          };
        }
        return false;
      }),
    };
  });

  it("renders status and wires web-control actions", async () => {
    const { initWebControlSettings } = require("../features/settings/webControlSettings.js");

    initWebControlSettings();
    await Promise.resolve();

    const toggle = document.getElementById("settings-web-control-toggle");
    const status = document.getElementById("settings-web-control-status");
    const localUrl = document.getElementById("settings-web-control-url");
    const lanUrl = document.getElementById("settings-web-control-lan-url");
    const copyLan = document.getElementById("settings-web-control-copy-lan");

    expect(status?.textContent).toBe("Работает на порту 4321");
    expect(localUrl?.value).toBe("http://127.0.0.1:4321/");
    expect(lanUrl?.value).toBe("http://192.168.1.10:4321/");
    expect(copyLan?.disabled).toBe(false);

    copyLan.click();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://192.168.1.10:4321/",
    );
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "toast",
      "Адрес для телефона скопирован",
      "success",
    );

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "web:setEnabled",
      false,
    );
  });

  it("reinitializes without duplicating DOM listeners", async () => {
    const { initWebControlSettings } = require("../features/settings/webControlSettings.js");
    const toggle = document.getElementById("settings-web-control-toggle");

    initWebControlSettings();
    initWebControlSettings();
    await Promise.resolve();

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await Promise.resolve();

    const setEnabledCalls = window.electron.invoke.mock.calls.filter(
      ([channel]) => channel === "web:setEnabled",
    );
    expect(setEnabledCalls).toHaveLength(1);
  });

  it("keeps the latest async status when requests resolve out of order", async () => {
    const pending = [];
    window.electron.invoke = jest.fn((channel, value) => {
      if (channel === "web:getStatus") {
        return Promise.resolve({
          success: true,
          status: { enabled: true, running: true, port: 1111 },
        });
      }
      if (channel === "web:setEnabled") {
        return new Promise((resolve) => {
          pending.push({ value, resolve });
        });
      }
      return Promise.resolve(false);
    });
    const { initWebControlSettings } = require("../features/settings/webControlSettings.js");
    const toggle = document.getElementById("settings-web-control-toggle");
    const status = document.getElementById("settings-web-control-status");

    initWebControlSettings();
    await Promise.resolve();

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    pending[1].resolve({
      success: true,
      status: { enabled: true, running: true, port: 2222 },
    });
    await Promise.resolve();
    pending[0].resolve({
      success: true,
      status: { enabled: false, running: false, port: 0 },
    });
    await Promise.resolve();

    expect(status?.textContent).toBe("Работает на порту 2222");
    expect(toggle.checked).toBe(true);
  });
});
