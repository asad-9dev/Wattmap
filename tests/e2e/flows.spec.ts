import { expect, test, type Page } from "@playwright/test";

/** A real school with a score, found through the app itself rather than hardcoded. */
async function firstScoredSchool(page: Page): Promise<{ name: string; href: string }> {
  await page.goto("/schools?reported=1&sort=score&dir=desc");
  const link = page.locator("tbody th a").first();
  await expect(link).toBeVisible();
  return { name: (await link.textContent())!.trim(), href: (await link.getAttribute("href"))! };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("homepage → search a school → school profile", async ({ page }) => {
  const school = await firstScoredSchool(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "See how Ontario schools use energy." })).toBeVisible();
  await expect(page.getByText("Facilities reporting")).toBeVisible();
  const search = page.getByRole("combobox", { name: /search a school/i });
  await search.fill(school.name);
  const option = page.getByRole("option", { name: new RegExp(school.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(new RegExp(`${school.href}$`));
  await expect(page.getByRole("heading", { level: 1, name: school.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Energy over time" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Peer comparison" })).toBeVisible();
  await expect(page.getByText("Energy Opportunity Score")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("filter schools by level", async ({ page }) => {
  await page.goto("/schools");
  await page.getByLabel("School level").selectOption("secondary");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/level=secondary/);
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const levels = await page.locator("tbody th span").allTextContents();
  expect(levels.length).toBeGreaterThan(0);
  expect(levels.every((text) => text.includes("Secondary school"))).toBe(true);
  await expectNoHorizontalOverflow(page);
});

test("map loads schools and offers a text alternative", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByText(/[\d,]+ schools shown/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect(page.getByText("Cluster (select to zoom)")).toBeVisible();
  await page.getByLabel("School level").selectOption("secondary");
  await expect(page.getByText(/[\d,]+ schools shown/)).toBeVisible();
  await expect(page.getByRole("link", { name: /browse schools as a table/i })).toBeVisible();
});

test("compare two schools", async ({ page }) => {
  await page.goto("/schools?reported=1&sort=eui&dir=desc");
  const hrefs = await page.locator("tbody th a").evaluateAll((links) => links.slice(0, 2).map((a) => a.getAttribute("href")!));
  const slugs = hrefs.map((h) => h.replace("/schools/", ""));
  await page.goto(`/compare?schools=${slugs.join(",")}`);
  await expect(page.locator("thead th")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Energy intensity over time" })).toBeVisible();
  await page.getByRole("link", { name: /^Remove / }).first().click();
  await expect(page.locator("thead th")).toHaveCount(2);
});

test("download / print the school report", async ({ page }) => {
  const school = await firstScoredSchool(page);
  await page.goto(school.href);
  await page.getByRole("link", { name: "Download WattMap Report" }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText("WattMap school energy report")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Energy Opportunity Score" })).toBeVisible();
  await expect(page.getByRole("button", { name: /print or save as pdf/i })).toBeVisible();
  await expect(page.getByText(/not affiliated with or endorsed by the Government of Ontario/).first()).toBeVisible();
});

test("methodology explains formulas", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { level: 1, name: "How WattMap works" })).toBeVisible();
  for (const heading of ["Energy Use Intensity", "Peer selection", "Energy Opportunity Score", "Why WattMap is not an energy audit"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText("EUI (GJ/m²) = total site energy (GJ) ÷ floor area (m²)")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("unknown school shows a 404 page", async ({ page }) => {
  const response = await page.goto("/schools/this-school-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /couldn.t find that page/ })).toBeVisible();
});
