import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2030-01-15T08:00:00+03:00"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Расписание дня" })).toBeVisible();
});

async function fillMeeting(page: Page, title = "Планирование", start = "10:00", end = "11:00") {
  await page.getByLabel("Начало", { exact: true }).fill(start);
  await page.getByLabel("Окончание", { exact: true }).fill(end);
  await page.getByLabel("Название", { exact: true }).fill(title);
}

async function failNext(page: Page, kind: "load" | "mutation") {
  await page.evaluate(async (failureKind) => {
    await fetch("/api/demo/failure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: failureKind }),
    });
  }, kind);
}

test("CRUD uses the real browser mock and preserves the editor until success", async ({ page }) => {
  await fillMeeting(page);
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByRole("article", { name: "Планирование", exact: true })).toBeVisible();
  await expect(page.getByText("Встреча сохранена", { exact: true })).toBeVisible();
  const card = page.getByRole("article", { name: "Планирование", exact: true });
  await card.getByRole("button", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { name: "Редактирование встречи" })).toBeVisible();
  await expect(page.getByLabel("Начало", { exact: true })).toBeFocused();
  await page.getByLabel("Название", { exact: true }).fill("Обновлённая встреча");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("heading", { name: "Новая встреча" })).toBeVisible();
  const updated = page.getByRole("article", { name: "Обновлённая встреча" });
  await updated.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Отмена", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(updated).toBeVisible();
  await updated.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByRole("button", { name: "Удалить встречу", exact: true }).click();
  await expect(updated).toHaveCount(0);
  await expect(page.getByText("Встреча удалена", { exact: true })).toBeVisible();
});

test("local rules block invalid requests and permit touching boundaries", async ({ page }) => {
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/bookings")) posts++;
  });
  await fillMeeting(page, "Слишком короткая", "10:00", "10:29");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(
    page.getByText("Длительность встречи — от 30 минут до 2 часов", { exact: true }).first(),
  ).toBeVisible();
  expect(posts).toBe(0);
  await fillMeeting(page, "На границе", "11:00", "12:00");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByText("Встреча сохранена", { exact: true })).toBeVisible();
  await page
    .getByRole("article", { name: "На границе" })
    .getByRole("button", { name: "Изменить" })
    .click();
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("heading", { name: "Новая встреча" })).toBeVisible();
});

test("409 loads the competing meeting and keeps all fields", async ({ page }) => {
  await page.getByText("Проверить серверный конфликт", { exact: true }).click();
  await page.getByRole("button", { name: "Смоделировать конфликт" }).click();
  await expect(page.getByText(/Конфликт подготовлен/)).toBeVisible();
  await fillMeeting(page, "Сохранить черновик");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByRole("article", { name: "Параллельная встреча" })).toBeVisible();
  await expect(
    page.getByText("Это время уже занято. Выберите другой интервал", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Начало", { exact: true })).toHaveValue("10:00");
  await expect(page.getByLabel("Окончание", { exact: true })).toHaveValue("11:00");
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Сохранить черновик");
  await expect(page.getByRole("article", { name: "Сохранить черновик" })).toHaveCount(0);
});

test("successful save survives failed refresh and retry does not write twice", async ({ page }) => {
  await failNext(page, "load");
  await fillMeeting(page, "Сохранена один раз");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByRole("button", { name: "Повторить загрузку" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Сохранена один раз" })).toBeVisible();
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.getByRole("button", { name: "Забронировать", exact: true })).toBeEnabled();
  await expect(page.getByRole("article", { name: "Сохранена один раз" })).toHaveCount(1);
  await expect(page.getByRole("main").getByText(/не удалось загрузить расписание/i)).toHaveCount(0);
});

test("failed update rolls back its card but retains the editor draft", async ({ page }) => {
  await page
    .getByRole("article", { name: "Командная встреча" })
    .getByRole("button", { name: "Изменить" })
    .click();
  await fillMeeting(page, "Не потерять", "13:00", "14:00");
  await failNext(page, "mutation");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText(/Не удалось сохранить встречу/).first()).toBeVisible();
  await expect(page.getByRole("article", { name: "Командная встреча" })).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Не потерять");
  await expect(page.getByLabel("Начало", { exact: true })).toHaveValue("13:00");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("article", { name: "Не потерять" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Новая встреча" })).toBeVisible();
});

test("past dates are read-only and the server also rejects past writes", async ({ page }) => {
  await page.getByLabel("Дата", { exact: true }).fill("2030-01-14");
  await expect(page.getByText("Прошедшая дата — доступен только просмотр.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Забронировать", exact: true })).toBeDisabled();
  const status = await page.evaluate(
    async () =>
      (
        await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: "2030-01-14", start: "10:00", end: "11:00" }),
        })
      ).status,
  );
  expect(status).toBe(400);
  await page.getByLabel("Дата", { exact: true }).fill("");
  await expect(page.getByRole("heading", { name: "Расписание дня" })).toHaveCount(0);
});

test("mobile layout fits the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("button", { name: "Забронировать", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});
