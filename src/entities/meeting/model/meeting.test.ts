import { expect, test } from "bun:test";
import { isFutureMeeting, meetingStatus } from "./meeting";

const meeting = { id: "A", date: "2030-01-15", start: 600, end: 660 };

test.each([
  ["2030-01-14", 1200, true, "Предстоит"],
  ["2030-01-15", 599.99, true, "Предстоит"],
  ["2030-01-15", 600, false, "Идёт сейчас"],
  ["2030-01-15", 659.99, false, "Идёт сейчас"],
  ["2030-01-15", 660, false, "Завершена"],
  ["2030-01-16", 0, false, "Завершена"],
])("meeting at %s minute %f", (date, minute, future, status) => {
  expect(isFutureMeeting(meeting, { date, minute })).toBe(future);
  expect(meetingStatus(meeting, { date, minute })).toBe(status);
});
