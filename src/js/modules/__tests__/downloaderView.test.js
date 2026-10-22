/** @jest-environment jsdom */

import renderDownloader from "../views/downloaderView.js";

const buildWrapper = () => {
  const wrapper = document.createElement("div");
  wrapper.id = "downloader-view";
  wrapper.innerHTML = `
    <header>
      <div class="input-container">
        <div class="url-entry-shell">
          <div class="url-input-wrapper url-input-wrapper--downloader">
          </div>
        </div>
      </div>
    </header>
    <section class="downloads-toolbar" aria-label="Quick access">
      <div class="downloads-toolbar__title"><strong>Downloads</strong></div>
      <div class="downloads-toolbar__actions">
      <button id="open-last-video"></button>
      <button id="open-folder"></button>
      </div>
    </section>
    <div id="download-queue-info" class="download-queue-info hidden">
      <button id="queue-start-button"></button>
      <button id="queue-pause-button"></button>
      <button id="queue-clear-button"></button>
    </div>
    <div id="queue-start-indicator" class="queue-start-indicator hidden"></div>
    <section id="history-container">
      <div class="history-toolbar"></div>
      <div id="history"></div>
    </section>
  `;
  document.body.appendChild(wrapper);

  return { wrapper };
};

describe("downloaderView hero", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  test("builds illustrated hero with integrated quick access and preserved ids", () => {
    const { wrapper } = buildWrapper();

    renderDownloader(wrapper);

    const header = wrapper.querySelector(".downloader-shell-header");
    const hero = wrapper.querySelector(".downloader-shell-header__hero");
    const heroPanel = hero?.querySelector(".downloader-hero");
    const heroArt = wrapper.querySelector(".downloader-hero__art img");
    const meta = wrapper.querySelector(".downloader-shell-header__meta");
    expect(header).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(heroPanel?.classList.contains("tab-hero")).toBe(true);
    expect(heroPanel?.querySelector(".tab-hero__content")).not.toBeNull();
    expect(heroPanel?.querySelector(".tab-hero__icon")).not.toBeNull();
    expect(heroPanel?.querySelector(".tab-hero__art")).not.toBeNull();
    expect(hero?.querySelector(".downloader-hero__icon")).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(hero?.querySelector(".title-content")).not.toBeNull();
    expect(heroArt?.getAttribute("src")).toBe(
      "../assets/img/downloader-hero.png",
    );
    expect(heroArt?.getAttribute("alt")).toBe("");
    expect(meta?.querySelector("#downloader-job-summary")).not.toBeNull();
    expect(meta?.querySelector("#dl-tools-status")).toBeNull();
    expect(
      wrapper.querySelector("#downloader-job-summary-title")?.textContent,
    ).toBeTruthy();
    expect(
      wrapper.querySelector("#downloader-job-summary-meta"),
    ).not.toBeNull();
    expect(wrapper.querySelector("#inspect-last-video")).toBeNull();
    expect(
      wrapper.querySelector("#downloader-media-inspector-slot"),
    ).toBeNull();
    expect(wrapper.querySelector(".downloads-toolbar")).not.toBeNull();
    expect(
      wrapper.querySelector(
        ".url-input-wrapper--downloader > .downloads-toolbar",
      ),
    ).not.toBeNull();
    expect(wrapper.querySelector(".wg-glass > .downloads-toolbar")).toBeNull();
    const urlWrapper = wrapper.querySelector(".url-input-wrapper--downloader");
    const queueInfo = urlWrapper?.querySelector(":scope > #download-queue-info");
    const queueStart = urlWrapper?.querySelector(":scope > #queue-start-indicator");
    const quickAccess = urlWrapper?.querySelector(":scope > .downloads-toolbar");
    const historyContainer = urlWrapper?.querySelector(":scope > #history-container");
    expect(queueInfo).not.toBeNull();
    expect(queueStart).not.toBeNull();
    expect(queueInfo.closest(".url-input-wrapper--downloader")).toBe(urlWrapper);
    expect(queueInfo.querySelector("#queue-start-button")).not.toBeNull();
    expect(queueInfo.querySelector("#queue-pause-button")).not.toBeNull();
    expect(queueInfo.querySelector("#queue-clear-button")).not.toBeNull();
    expect(queueInfo.nextElementSibling).toBe(queueStart);
    expect(queueStart.nextElementSibling).toBe(quickAccess);
    expect(historyContainer).not.toBeNull();
    expect(quickAccess.nextElementSibling).toBe(historyContainer);
    expect(wrapper.querySelector(".wg-glass > #download-queue-info")).toBeNull();
    expect(wrapper.querySelector(".downloads-toolbar").getAttribute("aria-label")).toBe(
      "Quick access",
    );
    expect(
      wrapper.querySelector(".downloads-toolbar #open-last-video"),
    ).not.toBeNull();
    expect(
      wrapper.querySelector(".downloads-toolbar #open-folder"),
    ).not.toBeNull();
    expect(wrapper.querySelector(".downloader-breadcrumbs")).toBeNull();
  });
});
