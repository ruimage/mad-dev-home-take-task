import { expect, test } from "@playwright/test";

test("dark mode toggle applies and persists", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
