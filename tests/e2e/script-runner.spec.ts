import { test, expect } from "@playwright/test";
import { loginAsTestUser, skipWithoutCredentials } from "./helpers";

test.describe("script runner", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsTestUser(page);
  });

  test("scripts list renders available scripts", async ({ page }) => {
    await page.goto("/scripts");
    await expect(page.getByRole("heading", { name: "Scripts" })).toBeVisible();
    await expect(page.getByText(/scripts available/i)).toBeVisible();
  });

  test("opening a script shows its run form", async ({ page }) => {
    await page.goto("/scripts");
    const firstRunButton = page.getByRole("link", { name: /run script/i }).first();
    await firstRunButton.click();
    await expect(page).toHaveURL(/\/scripts\/.+/);
  });
});
