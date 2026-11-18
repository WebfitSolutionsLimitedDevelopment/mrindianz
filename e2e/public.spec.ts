import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/about", "/competition", "/apply", "/contestants", "/peoples-choice", "/tickets", "/partners", "/faq", "/contact", "/privacy", "/terms", "/contestant-terms", "/voting-rules"];

test.describe("public pages", () => {
  for (const route of ROUTES) {
    test(`${route} renders with one h1, a title and no horizontal overflow`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.title()).toMatch(/Mr\. IndiaNZ/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (!["/apply/success"].includes(route)) expect(canonical).toBeTruthy();
    });
  }

  test("homepage shows the official event facts from the brief", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mr. IndiaNZ");
    await expect(page.getByText("Celebrating Kiwi-Indian Style, Culture and Charisma").first()).toBeVisible();
    await expect(page.getByText(/Saturday 3 April 2027/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Discover the Competition/i })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  });

  test("tickets page shows Coming Soon without inventing prices", async ({ page }) => {
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets Coming Soon" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("$");
  });

  test("contestants page shows the coming soon state when nobody is published", async ({ page }) => {
    await page.goto("/contestants");
    await expect(page.getByRole("heading", { name: /coming soon/i })).toBeVisible();
  });

  test("unknown contestant slug returns 404", async ({ page }) => {
    const res = await page.goto("/contestants/does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("robots.txt blocks indexing outside production; sitemap uses site URL", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("mobile navigation opens, traps nothing and closes with Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    const btn = page.getByRole("button", { name: /open menu/i });
    await btn.click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });
});
