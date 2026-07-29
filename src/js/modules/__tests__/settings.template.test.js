import fs from "fs";
import path from "path";

import { settingsTranslations } from "../../i18n/translations/settings.js";

describe("settings template structure", () => {
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

  test("removes Tools and Backup preferences from Settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).not.toContain('data-tab="wgunlock-settings"');
    expect(html).not.toContain('id="settings-section-tab-tools"');
    expect(html).not.toContain('id="wgunlock-settings"');
    expect(html).not.toContain('data-tab="backup-settings"');
    expect(html).not.toContain('id="wg-disable-toggle"');
    expect(html).not.toContain('id="wg-autosend"');
    expect(html).not.toContain('id="wg-remember-last-tool"');
    expect(html).not.toContain('id="backup-compact-toggle"');
    expect(html).not.toContain('id="backup-log-toggle"');
  });

  test("includes the emerald theme in settings and first-run templates", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('data-value="emerald"');
    expect(html).toContain('name="first-run-theme" value="emerald"');
    expect(html).not.toContain('data-value="light"');
    expect(html).not.toContain('name="first-run-theme" value="light"');
  });

  test("uses standard appearance cards and preserves control ids", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const appearancePaneStart = html.indexOf('id="appearance-settings"');
    const otherPaneStart = html.indexOf('id="other-settings"');
    const appearancePaneHtml = html.slice(appearancePaneStart, otherPaneStart);

    expect(appearancePaneHtml).toContain(
      'data-settings-search-id="appearance-interface"',
    );
    expect(appearancePaneHtml).toContain(
      'data-settings-search-id="appearance-theme"',
    );
    expect(appearancePaneHtml).not.toContain("settings-appearance-section");
    expect(appearancePaneHtml).not.toContain(
      "settings-card--appearance-panel",
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
    expect(appearancePaneHtml).toMatch(
      /id="settings-low-effects-toggle"[^>]*\/>\s*<label/,
    );
  });

  test("renders a visible state indicator for global shortcuts", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('id="settings-disable-global-shortcuts-toggle"');
    expect(html).toContain('class="settings-shortcuts__global-switch"');
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

    const settingsTabsStart = html.indexOf('class="settings-tabs"');
    const settingsTabsEnd = html.indexOf("</div>", settingsTabsStart);
    const settingsTabsHtml = html.slice(settingsTabsStart, settingsTabsEnd);

    expect(settingsTabsHtml).not.toContain('data-bs-toggle="tooltip"');
    expect(settingsTabsHtml).not.toContain("data-i18n-title=");
  });

  test("includes the accessible Player preferences section after Downloader", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const downloaderTab = html.indexOf('id="settings-section-tab-downloader"');
    const playerTab = html.indexOf('id="settings-section-tab-player"');
    const appearanceTab = html.indexOf(
      'id="settings-section-tab-appearance"',
    );

    expect(downloaderTab).toBeLessThan(playerTab);
    expect(playerTab).toBeLessThan(appearanceTab);
    expect(html).toContain('data-tab="player-settings"');
    expect(html).toContain('id="player-settings"');
    expect(html).toContain('aria-labelledby="settings-section-tab-player"');
    [
      "settings-player-sidebar-pinned",
      "settings-player-background-playback",
      "settings-player-shuffle",
      "settings-player-volume",
      "settings-player-volume-value",
    ].forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('data-player-repeat="off"');
    expect(html).toContain('data-player-repeat="one"');
    expect(html).toContain('data-player-repeat="all"');
  });

  test("localizes Player preferences in Russian and English", () => {
    const keys = [
      "settings.tabs.player",
      "settings.player.title",
      "settings.player.behavior",
      "settings.player.sidebarPinned",
      "settings.player.backgroundPlayback",
      "settings.player.playback",
      "settings.player.shuffle",
      "settings.player.repeat",
      "settings.player.repeat.off",
      "settings.player.repeat.one",
      "settings.player.repeat.all",
      "settings.player.volume",
      "settings.player.loadError",
      "settings.player.saveError",
    ];

    ["ru", "en"].forEach((locale) => {
      keys.forEach((key) => {
        expect(settingsTranslations[locale][key]).toBeTruthy();
      });
    });
  });

  test("embeds the shortcut editor in Settings and removes its legacy modal", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    expect(html).toContain('id="settings-section-tab-shortcuts"');
    expect(html).toContain('data-tab="shortcuts-settings"');
    expect(html).toContain('id="shortcuts-settings"');
    expect(html).toContain(
      'aria-labelledby="settings-section-tab-shortcuts"',
    );
    [
      "shortcuts-search",
      "shortcuts-list",
      "shortcuts-empty",
      "shortcuts-reset",
      "shortcuts-reset-confirm",
      "shortcuts-live",
      "settings-disable-global-shortcuts-toggle",
    ].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    expect(html).toContain('data-action="confirm"');
    expect(html).toContain('data-action="cancel"');
    expect(html).not.toContain('id="shortcuts-modal"');
    expect(html).not.toContain("partials/modals/shortcuts.njk");
  });

  test("localizes every shortcut catalog action in Russian and English", () => {
    const actionKeys = [
      "openShortcutSettings",
      "openSettings",
      "toggleTheme",
      "openDownloader",
      "openTools",
      "openBackup",
      "startDownload",
      "openDownloadsFolder",
      "openHistory",
      "openLastVideo",
      "clearHistory",
      "openYoutube",
      "openTwitch",
      "openVkVideo",
      "openCoub",
    ];

    ["ru", "en"].forEach((locale) => {
      actionKeys.forEach((actionKey) => {
        expect(
          settingsTranslations[locale][
            `shortcuts.actions.${actionKey}.title`
          ],
        ).toBeTruthy();
        expect(
          settingsTranslations[locale][
            `shortcuts.actions.${actionKey}.description`
          ],
        ).toBeTruthy();
      });
    });
  });

  test("moves downloader tools block out of downloader settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const downloaderPaneStart = html.indexOf('id="window-settings"');
    const playerPaneStart = html.indexOf('id="player-settings"');
    const downloaderPaneHtml = html.slice(downloaderPaneStart, playerPaneStart);

    expect(downloaderPaneHtml).not.toContain('id="tools-info"');
    expect(downloaderPaneHtml).not.toContain("settings-card--tools-compact");
    expect(downloaderPaneHtml).toContain('id="settings-show-tools-status"');
    expect(downloaderPaneHtml).toContain('id="settings-ytdlp-cookies-mode"');
    expect(downloaderPaneHtml).toContain('id="quality-profile-segment"');
  });

  test("uses compact icon tabs with tooltip titles in the download quality modal", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    [
      "download-quality-tab-video",
      "download-quality-tab-video-only",
      "download-quality-tab-audio",
      "download-quality-tab-subtitles",
    ].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    expect(html).toContain('class="quality-tab-label"');
    expect(html).toContain('class="quality-tab-count"');
    expect(html).toContain('data-bs-toggle="tooltip"');
    expect(html).toContain('data-bs-placement="top"');
    expect(html).toContain('data-i18n-title="quality.tab.audio"');
    expect(html).toContain('data-i18n-aria="quality.aria.tab.audio"');
  });

  test("uses the redesigned settings shell and compact runtime card", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const generalPaneStart = html.indexOf('id="general-settings"');
    const downloaderPaneStart = html.indexOf('id="window-settings"');
    const generalPaneHtml = html.slice(generalPaneStart, downloaderPaneStart);

    expect(html).not.toContain('data-tab="about-settings"');
    expect(html).not.toContain('id="about-settings"');
    expect(html).not.toContain('id="settings-section-tab-about"');
    expect(html).toContain('id="settings-search-input"');
    expect(html).toContain('id="settings-search-results"');
    expect(html).toContain('class="settings-search__label"');
    expect(html).toContain('class="settings-search__field"');
    expect(html).not.toContain("settings-app-card");
    expect(html).not.toContain('id="settings-link-github"');
    expect(html).not.toContain('id="settings-link-documentation"');
    expect(generalPaneHtml).toContain("settings-runtime-card");
    expect(generalPaneHtml).toContain('class="settings-card__subsection"');
    expect(generalPaneHtml).toContain('data-settings-search-id="default-tab"');
    expect(generalPaneHtml).not.toMatch(
      /<section[^>]*data-settings-search-id="default-tab"/s,
    );
    expect(generalPaneHtml).toContain('id="settings-app-version"');
    expect(generalPaneHtml).toContain('id="settings-about-electron-version"');
    expect(generalPaneHtml).toContain('id="settings-about-node-version"');
    expect(generalPaneHtml).not.toContain('id="settings-about-chrome-version"');
    expect(generalPaneHtml).toContain('id="settings-about-whats-new-button"');
    expect(generalPaneHtml).toContain('id="settings-about-copy-info-button"');
    expect(generalPaneHtml).toContain(
      'id="settings-about-check-updates-button"',
    );
    expect(
      generalPaneHtml.match(/class="settings-icon-action"/g),
    ).toHaveLength(3);
    expect(
      generalPaneHtml.match(/data-bs-delay='{"show":300,"hide":100}'/g),
    ).toHaveLength(3);
    expect(generalPaneHtml).toContain(
      'data-i18n-title="settings.about.whatsNew"',
    );
    expect(generalPaneHtml).toContain(
      'data-i18n-aria="settings.about.copyInfo"',
    );
    expect(generalPaneHtml).toContain(
      '<i data-lucide="sparkles" aria-hidden="true"></i>',
    );
    expect(generalPaneHtml).toContain(
      '<i data-lucide="copy" aria-hidden="true"></i>',
    );
    expect(generalPaneHtml).toContain(
      '<i data-lucide="refresh-cw" aria-hidden="true"></i>',
    );
    expect(generalPaneHtml).not.toContain(
      '<span data-i18n="settings.about.whatsNew">',
    );
    expect(generalPaneHtml).not.toContain(
      '<span data-i18n="settings.about.copyInfo">',
    );
    expect(generalPaneHtml).not.toContain(
      '<span data-i18n="settings.about.checkUpdates">',
    );
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
    expect(html).toContain('id="settings-downloader-advanced"');
    expect(html).toContain('class="settings-advanced__summary"');
    expect(html).toContain('id="settings-ytdlp-cookies-summary-state"');
    expect(html).toContain('class="settings-cookies-note"');
    expect(html).toContain(
      'data-i18n="settings.downloader.cookies.modeHint"',
    );
    expect(html).not.toContain(
      'data-i18n="settings.downloader.cookies.title"',
    );
  });

  test("includes localized web control settings", () => {
    const indexPath = path.resolve(process.cwd(), "src/index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const keys = [
      "settings.web.title",
      "settings.web.hint",
      "settings.web.enable",
      "settings.web.enableHint",
      "settings.web.url",
      "settings.web.lanUrl",
      "settings.web.open",
      "settings.web.restart",
      "settings.web.copyLan",
      "settings.web.lanWarning",
      "settings.web.status.off",
      "settings.web.status.starting",
      "settings.web.status.on",
    ];

    expect(html).toContain('class="settings-card settings-card--web-control"');
    expect(html).toContain('id="settings-web-control-advanced"');
    expect(html).toContain('class="settings-advanced__summary"');
    expect(html).toContain('id="settings-web-control-summary-state"');
    expect(html).toContain('id="settings-web-control-toggle"');
    expect(html).toContain('id="settings-web-control-url"');
    expect(html).toContain('id="settings-web-control-lan-url"');
    expect(html).toContain('id="settings-web-control-status"');
    expect(html).toContain('class="settings-web-control-panel__endpoint"');
    expect(html).toContain('class="settings-web-control-panel__footer"');
    keys.forEach((key) => {
      expect(settingsTranslations.ru[key]).toBeTruthy();
      expect(settingsTranslations.en[key]).toBeTruthy();
    });
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
