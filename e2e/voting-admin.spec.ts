import { expect, test } from "@playwright/test";

test("People's Choice shows an announcement state and never a live payment button without configuration", async ({ page }) => {
  await page.goto("/peoples-choice");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("People's Choice");
  await expect(page.getByRole("button", { name: /^Pay /i })).toHaveCount(0);
});

test("voting rules state the award is separate from the main title", async ({ page }) => {
  await page.goto("/voting-rules");
  await expect(page.getByText(/separate from the main Mr\. IndiaNZ title/).first()).toBeVisible();
  await expect(page.getByText(/pending organiser and legal approval/i).first()).toBeVisible();
});

test("admin requires authentication", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/applications");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin APIs and exports refuse anonymous access", async ({ request }) => {
  expect((await request.get("/admin/applications/export")).status()).toBeGreaterThanOrEqual(300);
  expect((await request.post("/api/admin/upload-url", { data: { folder: "site", contentType: "image/png", size: 10 } })).status()).toBe(403);
  expect((await request.post("/api/stripe/webhook", { data: "{}" })).status()).toBe(503); // not configured: refuses rather than accepting unsigned events
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
});

test("upload URL endpoint rejects cross-origin requests and bad files", async ({ request, baseURL }) => {
  expect((await request.post("/api/apply/upload-url", { headers: { origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  const r = await request.post("/api/apply/upload-url", { headers: { origin: baseURL! }, data: { kind: "headshot", contentType: "image/gif", size: 10, uploadSessionId: crypto.randomUUID() } });
  expect(r.status()).toBe(400);
});
