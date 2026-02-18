import renderBackup from "../views/backupView.js";

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn(async () => true),
}));

jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: jest.fn((key) => key),
}));

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makePrograms = (count) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Profile ${i + 1}`,
    source_path: `/src/${i + 1}`,
    backup_path: `/dst/${i + 1}`,
    archive_type: i % 2 === 0 ? "zip" : "tar.gz",
  }));

const setupBootstrapTooltipMock = () => {
  const instances = new Map();
  const Tooltip = {
    getInstance: jest.fn((el) => instances.get(el) || null),
    getOrCreateInstance: jest.fn((el) => {
      if (!instances.has(el)) {
        instances.set(el, { dispose: jest.fn() });
      }
      return instances.get(el);
    }),
  };
  global.bootstrap = { Tooltip };
  return { Tooltip, instances };
};

const setupWindowElectronMock = (programs = makePrograms(10)) => {
  const invoke = jest.fn(async (channel) => {
    if (channel === "backup:getPrograms") {
      return { success: true, programs };
    }
    if (channel === "backup:getLastTimes") {
      return { success: true, map: {} };
    }
    if (channel === "backup:savePrograms") {
      return { success: true };
    }
    if (channel === "check-file-exists") {
      return true;
    }
    return { success: true };
  });

  window.electron = {
    ipcRenderer: { invoke },
  };
};

describe("backupView performance behaviors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div class="group-menu">
        <button class="menu-item active" data-menu="download">Download</button>
        <button class="menu-item" data-menu="backup">Backup</button>
      </div>
    `;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
    delete global.bootstrap;
    delete window.electron;
    jest.clearAllMocks();
  });

  test("hints timer starts only when backup tab is active and pauses on tab switch", async () => {
    setupBootstrapTooltipMock();
    setupWindowElectronMock();
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const view = renderBackup();
    document.body.appendChild(view);
    await flush();

    const hintIntervalCallsBefore = setIntervalSpy.mock.calls.filter(
      (call) => call[1] === 10000,
    ).length;
    expect(hintIntervalCallsBefore).toBe(0);

    const activeDownload = document.querySelector(
      '.group-menu .menu-item[data-menu="download"]',
    );
    const backupTab = document.querySelector(
      '.group-menu .menu-item[data-menu="backup"]',
    );
    activeDownload?.classList.remove("active");
    backupTab?.classList.add("active");

    window.dispatchEvent(new CustomEvent("tabs:activated", { detail: { id: "backup" } }));
    const hintIntervalCallsAfter = setIntervalSpy.mock.calls.filter(
      (call) => call[1] === 10000,
    ).length;
    expect(hintIntervalCallsAfter).toBe(1);

    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "download" } }),
    );
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  test("renders downloader-like backup header and places hints below it", async () => {
    setupBootstrapTooltipMock();
    setupWindowElectronMock();
    const view = renderBackup();
    document.body.appendChild(view);
    await flush();

    const header = view.querySelector(".backup-shell-header");
    const headerExtra = view.querySelector("#backup-header-extra");
    const hints = view.querySelector(".bk-hints");

    expect(header).toBeTruthy();
    expect(header?.querySelector(".title-content")).toBeTruthy();
    expect(headerExtra).toBeTruthy();
    expect(hints).toBeTruthy();
    expect(header?.contains(hints)).toBe(false);
    expect(headerExtra?.contains(hints)).toBe(true);
  });

  test("large backup list uses no-animation mode on rerenders", async () => {
    setupBootstrapTooltipMock();
    setupWindowElectronMock(makePrograms(30));
    const view = renderBackup();
    document.body.appendChild(view);
    window.dispatchEvent(new CustomEvent("tabs:activated", { detail: { id: "backup" } }));
    await flush();

    const list = view.querySelector("#bk-list");
    expect(list.classList.contains("bk-list-no-anim")).toBe(true);

    const filterInput = view.querySelector("#bk-filter");
    filterInput.value = "Profile 1";
    filterInput.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(150);
    await flush();

    expect(list.classList.contains("bk-list-no-anim")).toBe(true);
  });

  test("list rerender does not mass-dispose tooltip instances", async () => {
    const { instances } = setupBootstrapTooltipMock();
    setupWindowElectronMock(makePrograms(25));
    const view = renderBackup();
    document.body.appendChild(view);
    window.dispatchEvent(new CustomEvent("tabs:activated", { detail: { id: "backup" } }));
    await flush();

    instances.forEach((instance) => instance.dispose.mockClear());

    const filterInput = view.querySelector("#bk-filter");
    filterInput.value = "Profile 2";
    filterInput.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(150);
    await flush();

    const totalDisposeCalls = Array.from(instances.values()).reduce(
      (sum, instance) => sum + instance.dispose.mock.calls.length,
      0,
    );
    expect(totalDisposeCalls).toBeLessThanOrEqual(3);
  });

  test("virtualizes backup rows for large pages", async () => {
    setupBootstrapTooltipMock();
    setupWindowElectronMock(makePrograms(120));
    const view = renderBackup();
    document.body.appendChild(view);
    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "backup" } }),
    );
    await flush();

    const pageSize = view.querySelector("#bk-page-size");
    pageSize.value = "25";
    pageSize.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const list = view.querySelector("#bk-list");
    const renderedRows = list.querySelectorAll(".bk-row").length;
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(25);
  });
});
