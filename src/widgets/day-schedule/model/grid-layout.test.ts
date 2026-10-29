import { expect, test } from "bun:test";
import {
  currentTimeOffset,
  gridRows,
  meetingGridLayout,
  SLOT_HEIGHT,
  timeTicks,
} from "./grid-layout";

const settings = { workingTime: { start: 540, end: 1080 }, minSlotMinutes: 30 };
const meeting = (start: number, end: number) => ({ id: "A", date: "2030-01-15", start, end });

test("current time position includes seconds without rounding to slots", () => {
  expect(
    currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 607.5 }, settings),
  ).toBeCloseTo(216);
  expect(
    currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 608 }, settings),
  ).toBeCloseTo(217.6);
});

test("current time is hidden on other dates and outside the working day", () => {
  expect(currentTimeOffset("2030-01-16", { date: "2030-01-15", minute: 600 }, settings)).toBeNull();
  expect(
    currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 539.99 }, settings),
  ).toBeNull();
  expect(
    currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 1080.01 }, settings),
  ).toBeNull();
  expect(currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 540 }, settings)).toBe(0);
  expect(currentTimeOffset("2030-01-15", { date: "2030-01-15", minute: 1080 }, settings)).toBe(
    1728,
  );
});

test("visual rows use the minimum duration and cover the whole working day", () => {
  const rows = gridRows(settings);
  expect(rows).toHaveLength(18);
  expect(rows[0]).toEqual({ minute: 540, height: SLOT_HEIGHT });
  expect(rows.at(-1)).toEqual({ minute: 1050, height: SLOT_HEIGHT });
  expect(rows.reduce((sum, row) => sum + row.height, 0)).toBe(1728);
});

test("unaligned meetings use a slot anchor plus a precise translation", () => {
  const layout = meetingGridLayout(meeting(607, 654), settings);
  expect(layout.anchorMinute).toBe(600);
  expect(layout.anchorIndex).toBe(2);
  expect(layout.translateY).toBeCloseTo(22.4);
  expect(layout.height).toBeCloseTo(150.4);
});

test("touching meetings remain touching across different anchors and at day end", () => {
  const first = meetingGridLayout(meeting(607, 637), settings);
  const second = meetingGridLayout(meeting(637, 667), settings);
  expect(first.anchorIndex * SLOT_HEIGHT + first.translateY + first.height).toBeCloseTo(
    second.anchorIndex * SLOT_HEIGHT + second.translateY,
  );
  const last = meetingGridLayout(meeting(1050, 1080), settings);
  expect(last.anchorIndex * SLOT_HEIGHT + last.translateY + last.height).toBe(1728);
});

test("quarter-hour ticks distinguish hours, half-hours and short ticks", () => {
  const ticks = timeTicks(settings);
  expect(ticks).toHaveLength(37);
  expect(ticks.filter((tick) => tick.kind === "hour")).toHaveLength(10);
  expect(ticks.find((tick) => tick.minute === 555)?.kind).toBe("quarter");
  expect(ticks.find((tick) => tick.minute === 570)?.kind).toBe("half");
  expect(ticks.at(-1)).toEqual({ minute: 1080, top: 1728, kind: "hour" });
});

test("tick times and weights are independent of the minimum meeting duration", () => {
  const expected = timeTicks(settings).map(({ minute, kind }) => ({ minute, kind }));
  for (const minSlotMinutes of [15, 20, 45, 60]) {
    const ticks = timeTicks({ ...settings, minSlotMinutes });
    expect(ticks.map(({ minute, kind }) => ({ minute, kind }))).toEqual(expected);
    expect(ticks.find((tick) => tick.minute === 570)?.top).toBe(
      (30 * SLOT_HEIGHT) / minSlotMinutes,
    );
  }
});

test("ticks follow clock quarters even when the working day starts between them", () => {
  const ticks = timeTicks({ workingTime: { start: 547, end: 610 }, minSlotMinutes: 20 });
  expect(ticks.map(({ minute, kind }) => ({ minute, kind }))).toEqual([
    { minute: 555, kind: "quarter" },
    { minute: 570, kind: "half" },
    { minute: 585, kind: "quarter" },
    { minute: 600, kind: "hour" },
  ]);
  expect(ticks[0]?.top).toBe((8 * SLOT_HEIGHT) / 20);
});
