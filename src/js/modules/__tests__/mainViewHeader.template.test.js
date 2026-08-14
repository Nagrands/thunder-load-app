import fs from "fs";
import path from "path";

describe("main view header template", () => {
  test("keeps the redesigned URL shell and existing downloader contracts", () => {
    const templatePath = path.resolve(
      process.cwd(),
      "templates/partials/main-view/header.njk",
    );
    const template = fs.readFileSync(templatePath, "utf8");
    const inputStart = template.indexOf('class="url-input-main"');
    const rowStart = template.indexOf('<div class="url-input-service-row">');
    const dropZoneStart = template.indexOf('class="url-drop-zone"');
    const destinationStart = template.indexOf('class="download-destination"');
    const cardStart = template.indexOf('id="preview-card"');

    expect(inputStart).toBeGreaterThan(-1);
    expect(rowStart).toBeGreaterThan(-1);
    expect(rowStart).toBeGreaterThan(inputStart);
    expect(dropZoneStart).toBeGreaterThan(rowStart);
    expect(destinationStart).toBeGreaterThan(rowStart);
    expect(cardStart).toBeGreaterThan(dropZoneStart);

    const redesignedShellHtml = template.slice(inputStart, cardStart);

    expect(redesignedShellHtml).toContain('id="url-helper-text"');
    expect(redesignedShellHtml).toContain('id="download-destination-path"');
    expect(redesignedShellHtml).not.toContain("downloader-view-mode");
    expect(redesignedShellHtml).toContain('for="url"');
    expect(redesignedShellHtml).toContain('data-i18n="input.url.drop.title"');
    expect(redesignedShellHtml).toContain('data-i18n="input.url.drop.hint"');
    expect(redesignedShellHtml).not.toContain('class="url-input-shortcuts"');
    expect(template).toContain('id="downloader-video-quality"');
    expect(template).toContain('id="downloader-audio-quality"');
    expect(template).toContain('id="downloader-subtitle-quality"');
    expect(template).toContain('id="downloader-advanced-formats"');
    expect(template).toContain('id="enqueue-button"');
    expect(template).not.toContain('id="open-last-video"');
    expect(template).not.toContain('id="open-folder"');

    const queueTemplate = fs.readFileSync(
      path.resolve(process.cwd(), "templates/partials/main-view/queue.njk"),
      "utf8",
    );
    expect(queueTemplate).toContain('id="open-last-video"');
    expect(queueTemplate).toContain('id="open-folder"');
  });
});
