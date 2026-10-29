import { expect, test } from "@playwright/test";

test("dev inspector shows both actors, Map contents and live editor events", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2030-01-15T08:00:00+03:00"));
  await page.goto("/");
  const inspector = page.getByRole("complementary", { name: "Инспектор XState" });
  await expect(inspector).toBeVisible();
  const selector = inspector.getByLabel("Машина", { exact: true });
  await expect(selector.locator("option")).toHaveCount(2);
  await expect(inspector.getByLabel("Context машины")).toContainText('"meetingsById"');
  const context = JSON.parse(await inspector.getByLabel("Context машины").innerText()) as {
    optimistic: { data: { slots: unknown[]; meetingsById: Record<string, unknown> } };
  };
  expect(context.optimistic.data.slots).toHaveLength(1440);
  expect(context.optimistic.data.meetingsById.welcome).toBeDefined();

  await page
    .getByRole("article", { name: "Командная встреча" })
    .getByRole("button", { name: "Изменить" })
    .click();
  await selector.selectOption("meetingEditor");
  await expect(inspector.getByLabel("Текущее состояние машины")).toHaveText('"editing"');
  await page.getByLabel("Название", { exact: true }).fill("Живой черновик");
  await expect(inspector.getByLabel("Context машины")).toContainText("Живой черновик");
  await inspector.getByText(/Последние события/).click();
  await expect(inspector.getByLabel("События машины")).toContainText("meeting.draft.changed");
  await inspector.getByRole("button", { name: "Свернуть инспектор" }).click();
  await expect(inspector.getByLabel("Context машины")).toHaveCount(0);
  await inspector.getByRole("button", { name: "Развернуть инспектор" }).click();
  await expect(inspector.getByLabel("Context машины")).toContainText("Живой черновик");
});

test("Stately SDK opens a window and sends both machines and readable snapshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Emulate the receiver handshake, keeping this test independent of Stately uptime.
  await page.context().route("https://stately.ai/inspect**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Inspector receiver</title><script>
      window.inspections = [];
      window.addEventListener('message', event => {
        if (event.data && event.data._version) window.inspections.push(event.data);
      });
      window.opener.postMessage({ type: '@statelyai.connected' }, '*');
    </script>`,
    }),
  );
  await page.clock.setFixedTime(new Date("2030-01-15T08:00:00+03:00"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Расписание дня" })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Открыть Stately Inspector" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(() => {
    const events = (window as unknown as { inspections: { type: string; name?: string }[] })
      .inspections;
    return (
      events.some((event) => event.type === "@xstate.actor" && event.name === "meetingEditor") &&
      events.some((event) => event.type === "@xstate.actor" && event.name === "daySchedule")
    );
  });
  await page
    .getByRole("article", { name: "Командная встреча" })
    .getByRole("button", { name: "Изменить" })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("SDK draft");
  await popup.waitForFunction(() =>
    (window as unknown as { inspections: unknown[] }).inspections.some((event) =>
      JSON.stringify(event).includes("SDK draft"),
    ),
  );
  expect(
    await popup.evaluate(() => {
      const events = (
        window as unknown as {
          inspections: {
            snapshot?: {
              context?: {
                optimistic?: { data: { slots: unknown[]; meetingsById: Record<string, unknown> } };
              };
            };
          }[];
        }
      ).inspections;
      return events.some(
        (event) =>
          event.snapshot?.context?.optimistic?.data.slots.length === 1440 &&
          event.snapshot.context.optimistic.data.meetingsById.welcome !== undefined,
      );
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
