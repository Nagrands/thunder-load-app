import fs from "fs";
import path from "path";

describe("main view header template", () => {
  test("keeps downloader mode switch in the URL helper row", () => {
    const templatePath = path.resolve(
      process.cwd(),
      "templates/partials/main-view/header.njk",
    );
    const template = fs.readFileSync(templatePath, "utf8");
    const rowStart = template.indexOf('<div class="url-input-service-row">');
    const actionRowStart = template.indexOf(
      '<nav\n          class="button-group downloader-action-row url-input-action-row"',
    );

    expect(rowStart).toBeGreaterThan(-1);
    expect(actionRowStart).toBeGreaterThan(rowStart);

    const serviceRowHtml = template.slice(rowStart, actionRowStart);

    expect(serviceRowHtml).toContain('id="url-helper-text"');
    expect(serviceRowHtml).toContain('class="downloader-view-mode"');
    expect(serviceRowHtml).toContain('id="downloader-view-detailed"');
    expect(serviceRowHtml).toContain('id="downloader-view-compact"');
    expect(serviceRowHtml).toContain('id="downloader-view-mode-label"');
    expect(serviceRowHtml).toContain('data-i18n="quality.compact.modeDetailed"');
    expect(serviceRowHtml).not.toContain('class="url-input-shortcuts"');
  });
});
