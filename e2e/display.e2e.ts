import { expect, test } from "@playwright/test";

test("management places date and form together to the right of the calendar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const grid = page.getByRole("region", { name: "Временная сетка расписания" });
  await expect(grid).toBeVisible();
  const date = await page.getByLabel("Дата", { exact: true }).boundingBox();
  const title = await page.getByLabel("Название", { exact: true }).boundingBox();
  const calendar = await grid.boundingBox();
  expect(date!.x).toBeGreaterThan(calendar!.x + calendar!.width);
  expect(title!.x).toBeCloseTo(date!.x, 0);
  expect(title!.y).toBeGreaterThan(date!.y);
});

test("door display fills the tablet viewport and offers no editing controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.clock.setFixedTime(new Date("2030-01-15T10:30:00+03:00"));
  await page.goto("/");
  await expect(page.getByLabel("Дата", { exact: true })).toHaveValue("2030-01-15");
  await page.evaluate(async () => {
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: "2030-01-15",
        start: "11:00",
        end: "12:00",
        title: "Обсуждение",
      }),
    });
  });
  await page.getByRole("link", { name: "Экран у двери" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByRole("article", { name: "Обсуждение" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Изменить", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Удалить", exact: true })).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Инспектор XState" })).toBeHidden();
  const grid = page.getByRole("region", { name: "Временная сетка расписания" });
  expect((await grid.boundingBox())!.height).toBeGreaterThan(650);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(768);
  await page.screenshot({ path: testInfo.outputPath("door-tablet.png") });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect((await grid.boundingBox())!.height).toBeGreaterThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
});

test("door display opens directly and can retry a failed refresh", async ({ page }) => {
  await page.goto("/display");
  await expect(page.getByRole("region", { name: "Временная сетка расписания" })).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/demo/failure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "load" }),
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("Не удалось обновить расписание");
  await expect(page.getByRole("region", { name: "Временная сетка расписания" })).toBeVisible();
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.getByRole("region", { name: "Временная сетка расписания" })).toBeVisible();
  await page.goto("/display");
  await expect(page.getByRole("heading", { name: "Переговорная", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Временная сетка расписания" })).toBeVisible();
});
