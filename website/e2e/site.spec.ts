import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home navigation and screenshot tabs work", async ({ page }) => {
  await page.goto("ru/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ваши медиа");
  const toolsTab = page.getByRole("tab", { name: "Инструменты" });
  await toolsTab.click();
  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Инструменты" })).toBeVisible();
});

test("language switch preserves the section", async ({ page }) => {
  await page.goto("ru/docs/");
  await page.getByRole("link", { name: "English version" }).click();
  await expect(page).toHaveURL(/\/en\/docs\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Thunder documentation");
});

test("download page exposes official assets", async ({ page }) => {
  await page.goto("en/download/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Download Thunder");
  await expect(page.locator('a[href*="github.com/Nagrands/thunder-load-app/releases/download"]').first()).toBeVisible();
});

test("home has no serious accessibility violations", async ({ page }) => {
  await page.goto("en/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});
