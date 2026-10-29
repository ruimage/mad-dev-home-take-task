import { expect, test } from "@playwright/test";

test("unknown routes render the 404 page", async ({ page }) => {
  await page.goto("/does-not-exist");

  await expect(page.getByRole("heading", { name: /404/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
});
