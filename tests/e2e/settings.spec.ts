import { test, expect } from "@playwright/test";
import { loginAsTestUser, skipWithoutCredentials } from "./helpers";

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsTestUser(page);
  });

  test("loads for a super-admin", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("save round-trip on session timeout does not error", async ({ page }) => {
    await page.goto("/settings");

    const timeoutInput = page.locator("#session-timeout");
    await expect(timeoutInput).toBeVisible();
    const currentValue = await timeoutInput.inputValue();

    // Re-save the same value — a no-op change that still exercises the PATCH
    // round-trip without altering real config.
    await timeoutInput.fill(currentValue);
    await page.getByRole("button", { name: "Save" }).first().click();

    await expect(page.getByText("Saved.")).toBeVisible();
  });
});
