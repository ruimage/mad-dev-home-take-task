import { describe, expect, test } from "bun:test";
import type { Meeting } from "@/entities/meeting";
import { DaySchedule } from "./day-schedule";

const date = "2030-01-15";
const now = { date, minute: 480 };
const meeting = (start: number, end: number, id = "A"): Meeting => ({ id, date, start, end });

describe("DaySchedule", () => {
  test.each([
    [539, 570],
    [1050, 1081],
    [600, 600],
    [660, 600],
    [600, 629],
    [600, 721],
  ])("rejects invalid interval %i-%i", (start, end) => {
    expect(() =>
      new DaySchedule(date).validateOperation(
        { type: "create", meeting: meeting(start, end) },
        now,
      ),
    ).toThrow();
  });
  test.each([
    [540, 570],
    [1050, 1080],
    [600, 720],
    [601, 631],
  ])("accepts interval %i-%i", (start, end) => {
    expect(() =>
      new DaySchedule(date).validateOperation(
        { type: "create", meeting: meeting(start, end) },
        now,
      ),
    ).not.toThrow();
  });
  test("projection uses actual minute index and an exclusive end", () => {
    const schedule = new DaySchedule(date, [meeting(600, 660)]);
    expect(schedule.data.slots).toHaveLength(1440);
    expect(schedule.data.slots[599]).toBeNull();
    expect(schedule.data.slots[600]).toBe("A");
    expect(schedule.data.slots[659]).toBe("A");
    expect(schedule.data.slots[660]).toBeNull();
    expect(schedule.toMeetings()).toEqual([meeting(600, 660)]);
  });
  test("own slots are accepted on update and other meetings are not", () => {
    const schedule = new DaySchedule(date, [meeting(600, 660), meeting(660, 720, "B")]);
    expect(() =>
      schedule.validateOperation({ type: "update", meeting: meeting(600, 660) }, now),
    ).not.toThrow();
    expect(() =>
      schedule.validateOperation({ type: "update", meeting: meeting(630, 690) }, now),
    ).toThrow("занято");
  });
  test("rejects malformed initial schedules rather than overwriting slots", () => {
    expect(() => new DaySchedule(date, [meeting(600, 660), meeting(630, 690, "B")])).toThrow();
    expect(() => new DaySchedule(date, [meeting(600, 660), meeting(660, 720)])).toThrow(
      "идентификатор",
    );
    expect(() => new DaySchedule("2030-02-30")).toThrow();
  });
  test("updates and deletion leave the original snapshot intact", () => {
    const original = new DaySchedule(date, [meeting(600, 660)]);
    const changed = original.apply({ type: "update", meeting: meeting(660, 720) });
    expect(original.data.slots[600]).toBe("A");
    expect(changed.data.slots[600]).toBeNull();
    expect(changed.data.slots[660]).toBe("A");
    expect(changed.apply({ type: "delete", meetingId: "A" }).toMeetings()).toEqual([]);
  });
  test("past and started meetings cannot be moved or deleted", () => {
    const schedule = new DaySchedule(date, [meeting(600, 660)]);
    const later = { date, minute: 600 };
    expect(() => schedule.validateOperation({ type: "delete", meetingId: "A" }, later)).toThrow(
      "просмотра",
    );
    expect(() =>
      schedule.validateOperation({ type: "update", meeting: meeting(840, 900) }, later),
    ).toThrow("просмотра");
    expect(() =>
      new DaySchedule("2030-01-14").validateOperation(
        { type: "create", meeting: { ...meeting(600, 660), date: "2030-01-14" } },
        now,
      ),
    ).toThrow("прошедшее");
  });
});
