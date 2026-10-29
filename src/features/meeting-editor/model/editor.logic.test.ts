import { expect, test } from "bun:test";
import { DaySchedule } from "@/entities/day-schedule";
import { ApiError } from "@/shared/api";
import {
  blankDraft,
  draftFromMeeting,
  validateDraft,
  validateOperation,
  errorMessage,
  createEditorContext,
  changeEditorDraft,
  editorSaveMessage,
  openEditor,
} from "./editor.logic";

const date = "2030-01-15";
const now = { date, minute: 480 };
const meeting = { id: "A", date, start: 600, end: 660, title: "Original" };
const schedule = new DaySchedule(date, [meeting, { ...meeting, id: "B", start: 660, end: 720 }]);

test.each([
  [480, "09:00", "09:30"],
  [539, "09:00", "09:30"],
  [540, "09:30", "10:00"],
  [600, "10:30", "11:00"],
  [1049, "17:30", "18:00"],
  [1080, "17:30", "18:00"],
])("blank draft at minute %i stays in working hours", (minute, start, end) => {
  expect(blankDraft(date, { date, minute })).toEqual({ start, end, title: "" });
});

test("another date starts at opening time regardless of today's clock", () => {
  expect(blankDraft("2030-01-16", { date, minute: 1200 }).start).toBe("09:00");
});

test("meeting drafts preserve titles and support absent titles", () => {
  expect(draftFromMeeting(meeting)).toEqual({ start: "10:00", end: "11:00", title: "Original" });
  expect(draftFromMeeting({ id: "X", date, start: 607, end: 637 }).title).toBe("");
});

test.each(["", "25:00", "10:60", "9:00"])("invalid draft time %s is rejected", (start) => {
  expect(validateDraft(schedule, { start, end: "11:00", title: "" }, "X", "create", now)).toEqual({
    meeting: null,
    error: "Укажите время начала и окончания",
  });
});

test("validation requires a loaded schedule", () => {
  expect(validateDraft(null, blankDraft(date, now), "X", "create", now).error).toBe(
    "Сначала загрузите расписание",
  );
  expect(validateOperation(null, { type: "delete", meetingId: "A" }, now)).toBe(
    "Сначала загрузите расписание",
  );
});

test("creation permits touching boundaries and trims the title without mutating its input", () => {
  const draft = Object.freeze({ start: "12:00", end: "12:30", title: "  Planning  " });
  expect(validateDraft(schedule, draft, "X", "create", now)).toEqual({
    error: null,
    meeting: { id: "X", date, start: 720, end: 750, title: "Planning" },
  });
  expect(draft.title).toBe("  Planning  ");
  expect(schedule.toMeetings()).toHaveLength(2);
});

test("updates accept their own interval but reject another meeting's interval", () => {
  expect(validateDraft(schedule, draftFromMeeting(meeting), "A", "update", now).error).toBeNull();
  expect(
    validateDraft(schedule, { start: "10:10", end: "11:10", title: "" }, "A", "update", now)
      .meeting,
  ).toBeNull();
  expect(validateDraft(schedule, draftFromMeeting(meeting), "X", "create", now).meeting).toBeNull();
});

test("started meetings cannot be saved from a stale editor", () => {
  expect(
    validateDraft(schedule, draftFromMeeting(meeting), "A", "update", { date, minute: 600 })
      .meeting,
  ).toBeNull();
});

test("changing the editor draft clears errors without mutating the previous draft", () => {
  const context = {
    ...createEditorContext(now),
    ...openEditor(meeting, schedule, now),
    error: "Conflict",
  };
  const patch = changeEditorDraft(context, { title: "Changed" });
  expect(patch.error).toBeNull();
  expect(patch.draft).toEqual({ start: "10:00", end: "11:00", title: "Changed" });
  expect(context.draft.title).toBe("Original");
});

test("save messages contain the validated meeting and reject a closed editor", () => {
  const context = { ...createEditorContext(now), ...openEditor(meeting, schedule, now) };
  expect(editorSaveMessage(context)).toEqual({ type: "editor.save.requested", meeting });
  expect(() => editorSaveMessage(createEditorContext(now))).toThrow("Сначала загрузите расписание");
});

test.each([
  [new ApiError("Technical"), "Не удалось связаться с сервером. Повторите попытку"],
  [new ApiError("Technical", { status: 500 }), "Сервер вернул ошибку. Повторите попытку"],
  [new ApiError("Interval taken", { status: 409, code: "CONFLICT" }), "Interval taken"],
  [new Error("Validation"), "Validation"],
  [null, "Не удалось выполнить запрос. Повторите попытку"],
])("error messages hide technical details only for unclassified API errors", (error, message) => {
  expect(errorMessage(error)).toBe(message);
});
