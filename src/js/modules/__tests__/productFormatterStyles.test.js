import fs from "node:fs";
import path from "node:path";

describe("product formatter responsive styles", () => {
  const stylesDir = path.join(process.cwd(), "src/scss/tab/products");
  const shell = fs.readFileSync(path.join(stylesDir, "_shell.scss"), "utf8");
  const responsive = fs.readFileSync(
    path.join(stylesDir, "_responsive.scss"),
    "utf8",
  );

  test("defines the two-column workbench and prevents narrow grid overflow", () => {
    expect(shell).toContain(
      "grid-template-columns: minmax(0, 46fr) minmax(0, 54fr)",
    );
    expect(shell).toContain("min-width: 0");
    expect(shell).toContain("overflow: hidden");
  });

  test("stacks panes, wraps filters and honors reduced motion", () => {
    expect(responsive).toContain("@media (max-width: 980px)");
    expect(responsive).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(responsive).toContain("flex-wrap: wrap");
    expect(responsive).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
