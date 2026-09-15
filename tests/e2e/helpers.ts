import { Page, test } from "@playwright/test";

/**
 * Credentials for a real, provisioned test account (create one in the DB — never use
 * production credentials here). Role must be "super-admin" to exercise Settings/Users.
 */
export const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
export const hasTestCredentials = !!E2E_EMAIL && !!E2E_PASSWORD;

export function skipWithoutCredentials() {
  test.skip(
    !hasTestCredentials,
    "Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD (a real super-admin test account) to run authenticated smoke tests."
  );
}

export async function loginAsTestUser(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL!);
  await page.getByLabel("Password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
