/** @jest-environment jsdom */

import renderDownloader from "../views/downloaderView.js";

const buildWrapper = () => {
  const wrapper = document.createElement("div");
  wrapper.id = "downloader-view";
  wrapper.innerHTML = `
    <header><div class="input-container"></div></header>
    <nav class="button-group"></nav>
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

  test("builds full-width hero with separate meta row and preserved ids", () => {
    const { wrapper } = buildWrapper();

    renderDownloader(wrapper);

    const header = wrapper.querySelector(".downloader-shell-header");
    const hero = wrapper.querySelector(".downloader-shell-header__hero");
    const meta = wrapper.querySelector(".downloader-shell-header__meta");
    expect(header).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(hero?.querySelector(".title-content")).not.toBeNull();
    expect(meta?.querySelector("#downloader-job-summary")).not.toBeNull();
    expect(meta?.querySelector("#dl-tools-status")).not.toBeNull();
    expect(
      wrapper.querySelector("#downloader-job-summary-title")?.textContent,
    ).toBeTruthy();
    expect(wrapper.querySelector("#downloader-job-summary-meta")).not.toBeNull();
    expect(wrapper.querySelector("#dl-tools-icon")).not.toBeNull();
    expect(wrapper.querySelector("#dl-tools-text")).not.toBeNull();
    expect(wrapper.querySelector("#dl-tools-badges")).not.toBeNull();
    expect(wrapper.querySelector("#dl-tools-toggle")).not.toBeNull();
    expect(wrapper.querySelector("#dl-tools-reinstall")).not.toBeNull();
    expect(wrapper.querySelector(".downloader-breadcrumbs")).toBeNull();
  });
});
