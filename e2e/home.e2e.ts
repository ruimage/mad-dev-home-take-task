import { expect, test } from "@playwright/test";

test("home page shows the stack overview and the shadcn example card", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Bun + FSD Template" })).toBeVisible();

  await expect(page.getByPlaceholder("Name of your project")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deploy" })).toBeVisible();
});
