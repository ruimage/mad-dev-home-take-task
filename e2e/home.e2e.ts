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

test("opening today's grid centers current time exactly, including day boundaries", async ({
  page,
}) => {
  const grid = page.getByRole("region", { name: "Временная сетка расписания" });
  const line = page.getByTestId("current-time-indicator");
  async function expectCentered() {
    await expect(line).toBeVisible();
    const difference = await line.evaluate((element) => {
      const viewport = element.closest('[role="region"]')!;
      const bounds = element.getBoundingClientRect();
      return (
        bounds.top +
        bounds.height / 2 -
        (viewport.getBoundingClientRect().top + viewport.clientTop + viewport.clientHeight / 2)
      );
    });
    expect(Math.abs(difference)).toBeLessThan(1);
  }
  for (const time of ["09:00:00", "13:37:30", "18:00:00"]) {
    await page.clock.setFixedTime(new Date(`2030-01-15T${time}+03:00`));
    await page.reload();
    await expectCentered();
    if (time === "13:37:30") {
      await grid.evaluate((element) => {
        element.scrollTop -= 100;
      });
      const manuallySelected = await grid.evaluate((element) => element.scrollTop);
      await page.clock.setFixedTime(new Date("2030-01-15T13:38:30+03:00"));
      await expect(line).toHaveAttribute("aria-label", "Текущее время 13:38");
      expect(await grid.evaluate((element) => element.scrollTop)).toBeCloseTo(manuallySelected, 1);
      await page.getByLabel("Дата", { exact: true }).fill("2030-01-16");
      await expect(line).toHaveCount(0);
      await page.getByLabel("Дата", { exact: true }).fill("2030-01-15");
      await expectCentered();
    }
  }
});

test("current-time line crosses meetings at the exact time and updates automatically", async ({
  page,
}, testInfo) => {
  await expect(page.getByTestId("current-time-indicator")).toHaveCount(0);
  await fillMeeting(page, "Текущая встреча", "10:00", "11:00");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByText("Встреча сохранена", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2030-01-15T10:07:30+03:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const line = page.getByTestId("current-time-indicator");
  await expect(line).toHaveAttribute("aria-label", "Текущее время 10:07");
  const geometry = await line.evaluate((element) => {
    const canvas = element.parentElement!;
    const card = canvas.querySelector('article[aria-label="Текущая встреча"]')!;
    const lineRect = element.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      center: lineRect.top + lineRect.height / 2 - canvas.getBoundingClientRect().top,
      crossesCard:
        lineRect.top > cardRect.top &&
        lineRect.bottom < cardRect.bottom &&
        lineRect.left < cardRect.left &&
        lineRect.right > cardRect.right,
      aboveCard:
        Number(getComputedStyle(element).zIndex) >
        Number(getComputedStyle(card.parentElement!).zIndex),
      pointerEvents: getComputedStyle(element).pointerEvents,
    };
  });
  expect(geometry.center).toBeCloseTo(216, 1);
  expect(geometry.crossesCard).toBe(true);
  expect(geometry.aboveCard).toBe(true);
  expect(geometry.pointerEvents).toBe("none");
  await page.clock.setFixedTime(new Date("2030-01-15T10:08:00+03:00"));
  await expect(line).toHaveAttribute("aria-label", "Текущее время 10:08");
  const updated = await line.evaluate(
    (element) =>
      element.getBoundingClientRect().top +
      element.getBoundingClientRect().height / 2 -
      element.parentElement!.getBoundingClientRect().top,
  );
  expect(updated).toBeCloseTo(217.6, 1);
  await page
    .getByRole("region", { name: "Временная сетка расписания" })
    .screenshot({ path: testInfo.outputPath("current-time-line.png") });
  await page.getByLabel("Дата", { exact: true }).fill("2030-01-16");
  await expect(line).toHaveCount(0);
});

test("vertical grid anchors an unaligned meeting and preserves minute precision", async ({
  page,
}, testInfo) => {
  const grid = page.getByRole("region", { name: "Временная сетка расписания" });
  await expect(grid.locator("[data-slot-start]")).toHaveCount(18);
  await expect(grid.locator('[data-tick-kind="hour"]')).toHaveCount(10);
  await expect(grid.locator('time[datetime="18:00"]')).toHaveText("18:00");
  const weights = await grid.evaluate((element) => {
    const quarter = element.querySelector('[data-tick-kind="quarter"] [data-tick-line]');
    const half = element.querySelector('[data-tick-kind="half"] [data-tick-line]');
    if (!quarter || !half) throw new Error("Missing tick marks");
    return {
      quarter: parseFloat(getComputedStyle(quarter).borderTopWidth),
      half: parseFloat(getComputedStyle(half).borderTopWidth),
    };
  });
  expect(weights.half).toBeGreaterThan(weights.quarter);
  await fillMeeting(page, "Неровный интервал", "10:07", "10:54");
  await page.getByRole("button", { name: "Забронировать", exact: true }).click();
  await expect(page.getByText("Встреча сохранена", { exact: true })).toBeVisible();
  const card = page.getByRole("article", { name: "Неровный интервал" });
  const positioned = card.locator("..");
  await expect(positioned).toHaveAttribute("data-anchor-minute", "600");
  await expect(positioned.locator("..")).toHaveAttribute("data-slot-start", "600");
  const geometry = await positioned.evaluate((element) => ({
    offset:
      element.getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top,
    height: element.getBoundingClientRect().height,
  }));
  expect(geometry.offset).toBeCloseTo(22.4, 1);
  expect(geometry.height).toBeCloseTo(150.4, 1);
  await card.getByRole("button", { name: "Изменить" }).click();
  await page.getByLabel("Начало", { exact: true }).fill("10:22");
  await page.getByLabel("Окончание", { exact: true }).fill("10:52");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("heading", { name: "Новая встреча" })).toBeVisible();
  const updatedGeometry = await positioned.evaluate((element) => ({
    offset:
      element.getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top,
    height: element.getBoundingClientRect().height,
  }));
  expect(updatedGeometry.offset).toBeCloseTo(70.4, 1);
  expect(updatedGeometry.height).toBeCloseTo(96, 1);
  await grid.screenshot({ path: testInfo.outputPath("day-grid.png") });
});
