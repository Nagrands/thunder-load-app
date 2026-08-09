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
    expect(adaptive).toContain("--footer-safe-space");
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

  test("uses icon-first navigation and overlay media-library sidebar", () => {
    expect(adaptive).toContain(
      ".center-menu .menu-item:not(.active) .menu-text",
    );
    expect(adaptive).toContain(".player-library.is-sidebar-open");
    expect(adaptive).toContain("translateX(-105%)");
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
