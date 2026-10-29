import { expect, test } from "bun:test";
import { formatCalendarDate, formatMinute, parseMinute, readClock } from "./date-time";

test.each(["", "2030-1-15", "2030-02-29", "2030-04-31", "2030-13-01"])(
  "calendar formatting rejects invalid date %s",
  (date) => expect(formatCalendarDate(date)).toBeNull(),
);

test("calendar formatting uses the given day and locale with an explicit time zone", () => {
  expect(formatCalendarDate("2030-01-15")).toBe("вторник, 15 января");
  expect(formatCalendarDate("2028-02-29", "en-US")).toBe("Tuesday, February 29");
});

test.each([0, 540, 607, 1080, 1439])("minute formatting round-trips %i", (minute) => {
  expect(parseMinute(formatMinute(minute))).toBe(minute);
});

test("readClock preserves seconds and milliseconds from an explicitly supplied date", () => {
  expect(readClock(new Date(2030, 0, 15, 10, 7, 30, 500))).toEqual({
    date: "2030-01-15",
    minute: 607 + 30.5 / 60,
  });
});
