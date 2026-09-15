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
