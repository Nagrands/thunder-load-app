import fs from "fs";
import path from "path";

describe("settings template backup placement", () => {
  test("keeps Backup controls inside Tools and removes separate sidebar tab", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('data-tab="wgunlock-settings"');
    expect(html).not.toContain('data-tab="backup-settings"');
    expect(html).not.toContain('<div id="backup-settings" class="tab-pane">');

    const toolsPaneStart = html.indexOf(
      '<div id="wgunlock-settings" class="tab-pane">',
    );
    const appearancePaneStart = html.indexOf(
      '<div id="appearance-settings" class="tab-pane">',
    );
    const toolsPaneHtml = html.slice(toolsPaneStart, appearancePaneStart);

    expect(toolsPaneHtml).not.toContain('id="backup-disable-toggle"');
    expect(toolsPaneHtml).toContain('id="backup-compact-toggle"');
    expect(toolsPaneHtml).toContain('id="backup-log-toggle"');
    expect(toolsPaneHtml).toContain('id="settings-backup-status-badge"');
    expect(toolsPaneHtml).toContain('id="settings-backup-status-text"');
  });

  test("includes the emerald theme in settings and first-run templates", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('data-value="emerald"');
    expect(html).toContain('name="first-run-theme" value="emerald"');
    expect(html).not.toContain('data-value="light"');
    expect(html).not.toContain('name="first-run-theme" value="light"');
  });
});
