import fs from "fs";
import path from "path";

describe("settings template backup placement", () => {
  test("includes Thunder Spark brand lockup in the footer", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('class="app-footer__brand"');
    expect(html).toContain('class="app-footer__brand-mark"');
    expect(html).toContain('class="app-footer__brand-title"');
    expect(html).toContain('id="app-version-label"');
    expect(html).not.toContain('class="top-bar__left"');
    expect(html).not.toContain('data-ui="brand-chip"');
    expect(html).toContain("Thunder Spark");
    expect(html).toContain('id="footer-app-version"');
  });

  test("keeps queue filters in the queue header pills", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).not.toContain('id="queue-filters"');
    expect(html).toContain('id="queue-total-count"');
    expect(html).toContain('class="queue-title-count"');
    expect(html).toContain('id="queue-error-count"');
    expect(html).not.toContain('data-queue-filter="all"');
    expect(html).toContain('data-queue-filter="error"');
    expect(html).toContain("data-queue-filter-count");
  });

  test("keeps preview live player trigger on the thumbnail", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const previewStart = html.indexOf('<div id="preview-card"');
    const livePlayerStart = html.indexOf('<div\n  id="preview-live-player"');
    const previewHtml = html.slice(previewStart, livePlayerStart);
    const thumbStart = previewHtml.indexOf('class="preview-thumb-wrap"');
    const actionsStart = previewHtml.indexOf('id="preview-actions"');
    const thumbHtml = previewHtml.slice(thumbStart, actionsStart);
    const actionsHtml = previewHtml.slice(actionsStart);

    expect(previewHtml).toContain('id="preview-duration-overlay"');
    expect(thumbHtml).toContain('id="preview-open-live"');
    expect(thumbHtml).toContain('class="preview-live-play hidden"');
    expect(actionsHtml).not.toContain('id="preview-open-live"');
    expect(actionsHtml).not.toContain("Открыть live preview");
  });

  test("keeps Backup controls inside Tools and removes separate sidebar tab", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('data-tab="wgunlock-settings"');
    expect(html).not.toContain('data-tab="backup-settings"');
    expect(html).not.toContain('<div id="backup-settings" class="tab-pane">');

    const toolsPaneStart = html.indexOf('id="wgunlock-settings"');
    const appearancePaneStart = html.indexOf('id="appearance-settings"');
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

  test("uses compact appearance panel and preserves control ids", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const appearancePaneStart = html.indexOf('id="appearance-settings"');
    const aboutPaneStart = html.indexOf('id="about-settings"');
    const appearancePaneHtml = html.slice(appearancePaneStart, aboutPaneStart);

    expect(appearancePaneHtml).toContain("settings-card--appearance-panel");
    expect(appearancePaneHtml).not.toContain("settings-card--appearance-main");
    expect(appearancePaneHtml).not.toContain(
      "settings-card--appearance-secondary",
    );
    [
      "language-dropdown-btn",
      "language-dropdown-menu",
      "language-selected-label",
      "font-size-dropdown-btn",
      "font-size-dropdown-menu",
      "font-size-selected-label",
      "reset-font-size",
      "theme-dropdown-btn",
      "theme-dropdown-menu",
      "theme-selected-label",
      "reset-theme",
      "settings-low-effects-toggle",
    ].forEach((id) => {
      expect(appearancePaneHtml).toContain(`id="${id}"`);
    });
  });

  test("uses accessible tabs and appearance listboxes", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain(
      'class="settings-tabs"\n                  role="tablist"',
    );
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="settings-section-tab-general"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
  });

  test("moves downloader tools block out of downloader settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const downloaderPaneStart = html.indexOf('id="window-settings"');
    const toolsPaneStart = html.indexOf('id="wgunlock-settings"');
    const downloaderPaneHtml = html.slice(downloaderPaneStart, toolsPaneStart);

    expect(downloaderPaneHtml).not.toContain('id="tools-info"');
    expect(downloaderPaneHtml).not.toContain("settings-card--tools-compact");
    expect(downloaderPaneHtml).toContain('id="settings-show-tools-status"');
    expect(downloaderPaneHtml).toContain('id="settings-ytdlp-cookies-mode"');
    expect(downloaderPaneHtml).toContain('id="quality-profile-segment"');
  });

  test("includes about app tab and version fields in settings template", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('data-tab="about-settings"');
    expect(html).toContain('id="about-settings"');
    expect(html).toContain('aria-labelledby="settings-section-tab-about"');
    expect(html).toContain('id="settings-app-version"');
    expect(html).toContain('id="settings-about-electron-version"');
    expect(html).toContain('id="settings-about-chrome-version"');
    expect(html).toContain('id="settings-about-node-version"');
    expect(html).toContain('id="settings-about-whats-new-button"');
    expect(html).toContain('id="settings-about-copy-info-button"');
    expect(html).toContain('id="settings-about-check-updates-button"');
  });

  test("includes auto quality modal toggle in downloader settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('id="settings-auto-open-quality-modal"');
    expect(html).toContain(
      'data-i18n-html="settings.downloader.autoQualityModal"',
    );
  });

  test("includes yt-dlp cookies controls in downloader settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('id="settings-ytdlp-cookies-mode"');
    expect(html).toContain('id="settings-ytdlp-cookies-mode-trigger"');
    expect(html).toContain('id="settings-ytdlp-cookies-mode-menu"');
    expect(html).toContain('id="settings-ytdlp-cookies-browser"');
    expect(html).toContain('id="settings-ytdlp-cookies-browser-trigger"');
    expect(html).toContain('id="settings-ytdlp-cookies-browser-menu"');
    expect(html).toContain('class="settings-cookies-select__option"');
    expect(html).toContain('id="settings-ytdlp-cookies-file-button"');
    expect(html).toContain('data-i18n="settings.downloader.cookies.title"');
  });

  test("builds the standalone notifications lab page", () => {
    const labPath = path.resolve(process.cwd(), "src/notifications-lab.html");
    const html = fs.readFileSync(labPath, "utf8");

    expect(html).toContain('id="toast-container"');
    expect(html).toContain('data-ui="toast-container"');
    expect(html).toContain('data-toast="success"');
    expect(html).toContain('data-scenario="stack"');
    expect(html).toContain('data-update="progress"');
  });
});
