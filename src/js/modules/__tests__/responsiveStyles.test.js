import fs from "node:fs";
import path from "node:path";

describe("application responsive contract", () => {
  const root = process.cwd();
  const variables = fs.readFileSync(
    path.join(root, "src/scss/abstracts/_variables.scss"),
    "utf8",
  );
  const adaptive = fs.readFileSync(
    path.join(root, "src/scss/responsive/_adaptive.scss"),
    "utf8",
  );
  const sidebar = fs.readFileSync(
    path.join(root, "src/scss/layout/_sidebar.scss"),
    "utf8",
  );
  const toolsStyles = fs.readFileSync(
    path.join(root, "src/scss/tab/_tools.scss"),
    "utf8",
  );
  const topBarTemplate = fs.readFileSync(
    path.join(root, "templates/partials/top-bar.njk"),
    "utf8",
  );
  const sidebarTemplate = fs.readFileSync(
    path.join(root, "templates/partials/sidebar.njk"),
    "utf8",
  );
  const layout = fs.readFileSync(
    path.join(root, "src/scss/components/_layout-ui.scss"),
    "utf8",
  );
  const history = fs.readFileSync(
    path.join(root, "src/scss/components/_history.scss"),
    "utf8",
  );
  const historyTemplate = fs.readFileSync(
    path.join(root, "templates/partials/main-view/history.njk"),
    "utf8",
  );
  const webControl = fs.readFileSync(
    path.join(root, "src/web-control/web-control.css"),
    "utf8",
  );

  test("defines the supported desktop viewport tiers", () => {
    expect(variables).toContain("$breakpoint-app-wide: 1180px");
    expect(variables).toContain("$breakpoint-app-compact: 1179px");
    expect(variables).toContain("$breakpoint-app-narrow: 960px");
    expect(variables).toContain("$breakpoint-app-dense: 840px");
    expect(variables).toContain("$breakpoint-app-zoom: 720px");
    expect(variables).toContain("$breakpoint-app-short: 620px");
    expect(variables).toContain("$breakpoint-app-low-height: 540px");
  });

  test("keeps one scroll owner and protects fixed shell space", () => {
    expect(adaptive).toContain("height: 100dvh");
    expect(adaptive).toContain("overflow-y: auto");
    expect(adaptive).toContain("overflow-x: hidden");
    expect(adaptive).toContain("--sidebar-safe-space");
  });

  test("preserves the original desktop content density", () => {
    const baseContract = adaptive.slice(
      0,
      adaptive.indexOf("@media (max-width: variables.$breakpoint-app-compact)"),
    );
    const compactContract = adaptive.slice(
      adaptive.indexOf("@media (max-width: variables.$breakpoint-app-compact)"),
      adaptive.indexOf("@media (max-width: variables.$breakpoint-app-narrow)"),
    );

    expect(baseContract).not.toContain("padding-inline");
    expect(baseContract).not.toContain("width: min(100%, 940px)");
    expect(compactContract).not.toContain(".tab-hero__content");
    expect(compactContract).not.toContain("width: min(100%, 960px)");
    expect(adaptive).toContain(
      "@media (max-width: variables.$breakpoint-app-dense)",
    );
    expect(adaptive).toContain("body:not(.is-mac) .window-controls button");
  });

  test("uses icon-first navigation", () => {
    expect(adaptive).toContain(
      ".center-menu .menu-item:not(.active) .menu-text",
    );
  });

  test("uses a fixed desktop sidebar and compact top navigation on narrow windows", () => {
    expect(sidebar).toContain("inset: 0 auto 0 0;");
    expect(sidebar).toContain("width: var(--app-sidebar-width);");
    expect(sidebar).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(sidebar).toContain("@media (max-width: $breakpoint-tablet)");
    expect(sidebar).toContain(
      "grid-template-columns: auto minmax(0, 1fr) auto;",
    );
    expect(sidebar).toContain("inset: var(--topbar-height, 54px) 0 auto;");
    expect(sidebar).toContain("display: none !important;");
    expect(sidebar).toContain(".app-sidebar__format-action {");
    expect(sidebar).toContain(".app-sidebar__statusbar");
    expect(sidebarTemplate).toContain('class="app-sidebar__brand"');
    expect(sidebarTemplate).toContain('id="sidebar-tab-nav"');
    expect(sidebarTemplate).toContain('id="sidebar-open-settings"');
    expect(sidebarTemplate).toContain('class="app-sidebar__statusbar"');
    expect(sidebar).toContain("body.is-mac .app-sidebar__panel");
    expect(sidebar).toContain("padding-top: 52px;");
    expect(sidebar).toContain("flex-direction: row;");
    expect(layout).toContain("margin-left: var(--app-sidebar-width, 232px);");
    expect(adaptive).not.toContain(".app-sidebar--nav-mode");
    expect(sidebar).toContain("body.app-sidebar-collapsed");
    expect(sidebar).toContain("--app-sidebar-width: 84px;");
    expect(sidebar).toContain(".app-sidebar__brand-version {\n      display: none;");
    expect(sidebar).toContain("font-size: 22px;");
    expect(topBarTemplate).not.toContain("top-bar__divider");
  });

  test("nests tool navigation in the desktop sidebar and retains the narrow menu", () => {
    expect(sidebar).toContain(".app-sidebar__tools-nav");
    expect(sidebar).toContain(".app-sidebar__tool-item");
    expect(sidebar).toContain("span { display: none; }");
    expect(sidebar).toContain(".app-sidebar__tools-nav { display: none !important; }");
    expect(toolsStyles).toContain("@media (min-width: 901px)");
    expect(toolsStyles).toContain(".tools-sidebar {\n    display: none;");
    expect(toolsStyles).toContain("@media (max-width: 900px)");
  });

  test("stacks downloader tool badges within the sidebar width", () => {
    expect(sidebar).toContain(".app-sidebar__statusbar > .app-sidebar__tools-status");
    expect(sidebar).toContain(".downloader-tools-status__badges {");
    expect(sidebar).toContain("flex-direction: column;");
    expect(sidebar).toContain(".tool-badge {");
    expect(sidebar).toContain("max-width: 100%;");
    expect(sidebar).toContain("text-overflow: ellipsis;");
  });

  test("uses compact downloader spacing while keeping quick actions available", () => {
    expect(adaptive).toContain("@media (max-width: 900px)");
    expect(adaptive).toContain("--topbar-safe-space: 76px;");
    expect(adaptive).toContain(
      ".downloader-view .downloader-shell-header__hero",
    );
    expect(adaptive).toContain(".downloader-view .url-input-main");
    expect(adaptive).toContain(".downloader-view #open-last-video");
    expect(adaptive).toContain(".downloader-view #open-history");
    expect(adaptive).toContain("@media (max-width: 560px)");
  });

  test("keeps the History bulk toolbar compact and icon-only", () => {
    expect(history).toContain(".history-bulk-bar {");
    // expect(history).toContain("padding: 5px 6px");
    expect(history).toContain("width: 30px");
    expect(history).toContain("height: 30px");
    expect(history).toContain("flex-wrap: nowrap");
    expect(history).toContain(".history-bulk-icon-button {");
    expect(history).toContain(".history-bulk-action__label {");
    expect(history).toContain("white-space: nowrap");

    [
      "history-clear-selection",
      "history-export-selected-json",
      "history-export-selected-csv",
      "delete-selected",
    ].forEach((id) => {
      const buttonStart = historyTemplate.indexOf(`id="${id}"`);
      const buttonEnd = historyTemplate.indexOf("</button>", buttonStart);
      const buttonMarkup = historyTemplate.slice(buttonStart, buttonEnd);

      expect(buttonStart).toBeGreaterThan(-1);
      expect(buttonEnd).toBeGreaterThan(buttonStart);
      expect(buttonMarkup).toMatch(/data-bs-toggle="tooltip"|data-hint=/);
      expect(buttonMarkup).toMatch(/data-i18n-title=|data-i18n-hint=/);
      expect(buttonMarkup).toContain("data-i18n-aria=");
      expect(buttonMarkup).toContain("history-bulk-action__label");
    });
  });

  test("preserves two-column Web Control fields until phone width", () => {
    expect(webControl).toContain("@media (max-width: 720px)");
    expect(webControl).toContain(
      ".compact-quality-panel {\n    grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    expect(webControl).toContain("@media (max-width: 420px)");
    expect(webControl).toContain("padding-bottom: env(safe-area-inset-bottom");
    expect(webControl).toContain("width: max(100%, 44px)");
    expect(webControl).toContain("height: max(100%, 44px)");
  });
});
