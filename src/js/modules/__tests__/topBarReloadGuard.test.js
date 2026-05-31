/** @jest-environment jsdom */

describe("topBarReloadGuard", () => {
  let reloadSpy;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="reload-app" type="button" title="Обновить окно"></button>
    `;
    reloadSpy = jest.fn();
    window.__thunderReload = reloadSpy;
  });

  afterEach(() => {
    delete window.__thunderReload;
  });

  test("reloads when there is no active download", async () => {
    const { initTopBarReloadGuard } = await import("../topBarReloadGuard.js");
    initTopBarReloadGuard();

    document.getElementById("reload-app").click();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  test("disables reload button during active download and restores it after", async () => {
    const { initTopBarReloadGuard } = await import("../topBarReloadGuard.js");
    const button = document.getElementById("reload-app");
    initTopBarReloadGuard();

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 1 },
      }),
    );
    button.click();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(reloadSpy).not.toHaveBeenCalled();

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: false, activeCount: 0 },
      }),
    );
    button.click();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
