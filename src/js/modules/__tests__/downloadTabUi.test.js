describe("downloadTabUi", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div class="group-menu">
        <button class="menu-item" data-menu="download">
          <span class="menu-progress" aria-hidden="true"></span>
          <span class="menu-main">
            <span class="menu-text">Downloader</span>
            <span class="menu-badge" aria-hidden="true"></span>
          </span>
        </button>
      </div>
    `;
  });

  test("keeps queue count in aria label when progress is not active", async () => {
    jest.doMock("../i18n.js", () => ({
      t: jest.fn((key, vars = {}) => {
        if (key === "tabs.download") return "Downloader";
        if (key === "tabs.download.countOnly") {
          return `${vars.base} (${vars.count})`;
        }
        if (key === "tabs.download.progressOnly") {
          return `${vars.base} - ${vars.progress}%`;
        }
        if (key === "tabs.download.progressWithCount") {
          return `${vars.base} - ${vars.progress}% (${vars.count})`;
        }
        return key;
      }),
    }));

    const { syncDownloadTabAccessibility, getDownloadTabButton } =
      await import("../downloadTabUi.js");

    const tab = getDownloadTabButton();
    syncDownloadTabAccessibility(tab, { count: 7 });

    expect(tab.getAttribute("aria-label")).toBe("Downloader (7)");
    expect(tab.getAttribute("title")).toBe("Downloader (7)");
  });

  test("combines queue count and progress in aria label", async () => {
    jest.doMock("../i18n.js", () => ({
      t: jest.fn((key, vars = {}) => {
        if (key === "tabs.download") return "Downloader";
        if (key === "tabs.download.countOnly") {
          return `${vars.base} (${vars.count})`;
        }
        if (key === "tabs.download.progressOnly") {
          return `${vars.base} - ${vars.progress}%`;
        }
        if (key === "tabs.download.progressWithCount") {
          return `${vars.base} - ${vars.progress}% (${vars.count})`;
        }
        return key;
      }),
    }));

    const { syncDownloadTabAccessibility, updateDownloadTabProgress } =
      await import("../downloadTabUi.js");

    const tab = document.querySelector('[data-menu="download"]');
    syncDownloadTabAccessibility(tab, { count: 7 });
    updateDownloadTabProgress(42, { active: true, complete: false, tab });

    expect(tab.classList.contains("is-progress-active")).toBe(true);
    expect(tab.style.getPropertyValue("--download-tab-progress")).toBe("0.42");
    expect(tab.getAttribute("aria-label")).toBe("Downloader - 42.0% (7)");
  });
});
