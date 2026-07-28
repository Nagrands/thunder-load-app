/** @jest-environment jsdom */

import renderDownloader from "../views/downloaderView.js";

const buildWrapper = () => {
  const wrapper = document.createElement("div");
  wrapper.id = "downloader-view";
  wrapper.innerHTML = `
    <header>
      <div class="input-container">
        <div class="url-entry-shell">
          <div class="url-input-wrapper">
            <nav class="button-group">
              <button id="open-last-video"></button>
              <button id="open-folder"></button>
            </nav>
          </div>
        </div>
      </div>
    </header>
    <div id="download-queue-info" class="download-queue-info hidden"></div>
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

  test("builds illustrated hero with separate status row and preserved ids", () => {
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
    expect(
      wrapper.querySelector("header .url-input-wrapper nav.button-group"),
    ).not.toBeNull();
    expect(wrapper.querySelector(".downloader-breadcrumbs")).toBeNull();
  });
});
