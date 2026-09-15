import { expect, test, type Page } from "@playwright/test";

/** On narrow screens the theme switch lives in the menu. */
async function openMenuIfCollapsed(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
}

test("theme switch applies dark mode, persists across reloads, and switches back", async ({ page }) => {
  await page.goto("/methodology");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await openMenuIfCollapsed(page);
  await page.getByRole("radio", { name: "Dark theme" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(darkBackground).toBe("rgb(17, 26, 22)");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await openMenuIfCollapsed(page);
  await page.getByRole("radio", { name: "Light theme" }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

/** WCAG relative-luminance contrast ratio between two computed "rgb(r, g, b)" colours. */
function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, bl] = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

test("map popups stay readable in dark mode", async ({ page }) => {
  await page.goto("/map");
  await page.evaluate(() => localStorage.setItem("wattmap-theme", "dark"));
  await page.reload();
  await expect(page.locator('[data-map-state="ready"]')).toBeVisible({ timeout: 30_000 });
  // Build a popup with MapLibre's own class names inside the map, so both stylesheets apply.
  const popup = await page.evaluate(() => {
    const map = document.querySelector(".maplibregl-map")!;
    const root = document.createElement("div");
    root.className = "maplibregl-popup maplibregl-popup-anchor-top";
    root.innerHTML =
      '<div class="maplibregl-popup-tip"></div><div class="maplibregl-popup-content"><p class="font-semibold text-ink">School</p><p class="text-ink-muted">Board</p></div>';
    map.appendChild(root);
    const content = root.querySelector(".maplibregl-popup-content")!;
    const styles = {
      background: getComputedStyle(content).backgroundColor,
      title: getComputedStyle(content.querySelector(".text-ink")!).color,
      muted: getComputedStyle(content.querySelector(".text-ink-muted")!).color,
      tip: getComputedStyle(root.querySelector(".maplibregl-popup-tip")!).borderBottomColor,
    };
    root.remove();
    return styles;
  });
  expect(popup.background).toBe("rgb(23, 34, 29)");
  expect(popup.tip).toBe(popup.background);
  expect(contrast(popup.title, popup.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(popup.muted, popup.background)).toBeGreaterThanOrEqual(4.5);
});

test("Eco Club toolkit explains the profile and puts safety first", async ({ page }) => {
  await page.goto("/toolkit");
  await expect(page.getByRole("heading", { level: 1, name: "Eco Club toolkit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Read your school's profile in five steps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay safe" })).toBeVisible();
  await expect(page.getByText("Never open electrical panels, outlet covers, or equipment casings.")).toBeVisible();
});

test("board school table filters by name and level", async ({ page }) => {
  await page.goto("/boards");
  await page.locator("main ul a").first().click();
  const rows = page.locator("#schools tbody tr");
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(1);

  await page.getByLabel("School level").selectOption("secondary");
  const secondary = await rows.count();
  expect(secondary).toBeLessThan(total);
  expect((await page.locator("#schools tbody th span").allTextContents()).every((t) => t.includes("Secondary school"))).toBe(true);

  await page.getByLabel("Filter by school name").fill("no school has this name");
  await expect(page.getByText("No schools match these filters.")).toBeVisible();
});
