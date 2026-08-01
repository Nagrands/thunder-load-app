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
    const actionRowStart = template.indexOf(
      '<nav\n          class="button-group downloader-action-row url-input-action-row"',
    );

    expect(inputStart).toBeGreaterThan(-1);
    expect(rowStart).toBeGreaterThan(-1);
    expect(rowStart).toBeGreaterThan(inputStart);
    expect(dropZoneStart).toBeGreaterThan(rowStart);
    expect(actionRowStart).toBeGreaterThan(rowStart);
    expect(actionRowStart).toBeGreaterThan(dropZoneStart);

    const redesignedShellHtml = template.slice(inputStart, actionRowStart);

    expect(redesignedShellHtml).toContain('id="url-helper-text"');
    expect(redesignedShellHtml).toContain('class="downloader-view-mode"');
    expect(redesignedShellHtml).toContain('id="downloader-view-detailed"');
    expect(redesignedShellHtml).toContain('id="downloader-view-compact"');
    expect(redesignedShellHtml).toContain('id="downloader-view-mode-label"');
    expect(redesignedShellHtml).toContain(
      'data-i18n="quality.compact.modeDetailed"',
    );
    expect(redesignedShellHtml).toContain('for="url"');
    expect(redesignedShellHtml).toContain('data-i18n="input.url.drop.title"');
    expect(redesignedShellHtml).toContain('data-i18n="input.url.drop.hint"');
    expect(redesignedShellHtml).not.toContain('class="url-input-shortcuts"');
  });
});
