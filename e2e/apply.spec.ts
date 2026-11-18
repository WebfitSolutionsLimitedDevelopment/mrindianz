import { expect, test } from "@playwright/test";

test.describe("four-step application (client-side journey)", () => {
  test("validates each step, keeps progress and enforces the talent rule", async ({ page }) => {
    await page.goto("/apply");
    await expect(page.getByRole("heading", { name: /Step 1: Your details/ })).toBeVisible();

    // Empty submit shows an error summary
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("alert").first()).toContainText(/required/i);

    await page.getByLabel("Full legal name").fill("Arjun Sharma");
    await page.getByLabel("Date of birth").fill("2000-05-10");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Mobile number").fill("12");
    await page.getByLabel(/City or town/).fill("Auckland");
    await page.getByLabel("Region").selectOption("Auckland");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Enter a valid email address").first()).toBeVisible();
    await expect(page.getByText(/valid NZ mobile number/).first()).toBeVisible();

    await page.getByLabel("Email address").fill("arjun@example.com");
    await page.getByLabel("Mobile number").fill("021 123 4567");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /Step 2: Your story/ })).toBeVisible();
    await expect(page.getByText("We want to hear from you in your own words.")).toBeVisible();

    await page.getByLabel(/Why do you want to enter/).fill("To celebrate my heritage.");
    await page.getByLabel(/What does being Kiwi-Indian mean/).fill("Belonging to two cultures.");
    await page.getByRole("radio", { name: "Yes" }).last().check();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Describe your talent/).first()).toBeVisible();
    await page.getByLabel(/Describe your talent/).fill("Tabla — needs a chair and a microphone.");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /Step 3: Photos/ })).toBeVisible();

    // Progress survives a reload (sessionStorage)
    await page.reload();
    await expect(page.getByRole("heading", { name: /Step 3: Photos/ })).toBeVisible();

    // Photos are required
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/headshot and a full-length photograph are required/).first()).toBeVisible();

    // Client rejects invalid files before upload
    await page.locator("#photo-headshot").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
    await expect(page.getByText("Please choose a JPG, PNG or WEBP image.")).toBeVisible();
    await page.locator("#photo-headshot").setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 0xff) });
    await expect(page.getByText(/maximum is 5 MB/)).toBeVisible();

    // Back keeps answers
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByLabel(/Why do you want to enter/)).toHaveValue("To celebrate my heritage.");
  });

  test("fee disclosure and consent wording match the brief", async ({ page }) => {
    await page.goto("/competition");
    await expect(page.getByText(/Applying for Mr\. IndiaNZ 2027 is free\. If you are selected/).first()).toBeVisible();
  });
});
