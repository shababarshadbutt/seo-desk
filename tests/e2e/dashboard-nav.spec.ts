import { test, expect } from "@playwright/test";
import { loginAsTestUser, skipWithoutCredentials } from "./helpers";

// Requires a super-admin test account so every route (including /settings, /users) is reachable.
const ROUTES = ["/", "/scripts", "/websites", "/logs", "/weekly-reports", "/users", "/settings"];

test.describe("dashboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsTestUser(page);
  });

  for (const route of ROUTES) {
    test(`sidebar reaches ${route} without error`, async ({ page }) => {
      await page.goto(route);
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("aside")).toBeVisible();
      await expect(page.getByText(/application error/i)).toHaveCount(0);
    });
  }
});
