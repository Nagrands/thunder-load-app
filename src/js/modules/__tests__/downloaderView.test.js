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

  test("builds tools-like hero without breadcrumbs", () => {
    const { wrapper } = buildWrapper();

    renderDownloader(wrapper);

    expect(wrapper.querySelector(".downloader-shell-header")).not.toBeNull();
    expect(
      wrapper.querySelector(".downloader-shell-header .title-content"),
    ).not.toBeNull();
    expect(wrapper.querySelector("#downloader-job-summary")).not.toBeNull();
    expect(
      wrapper.querySelector("#downloader-job-summary-title")?.textContent,
    ).toBeTruthy();
    expect(wrapper.querySelector(".downloader-breadcrumbs")).toBeNull();
  });
});
