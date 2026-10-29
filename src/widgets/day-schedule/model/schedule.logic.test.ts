import { expect, test } from "bun:test";
import { DaySchedule, ScheduleService } from "@/entities/day-schedule";
import { MeetingService } from "@/entities/meeting";
import { ApiError, FetchHttpClient } from "@/shared/api";
import {
  initialSchedule,
  startOperation,
  commitOperation,
  rollbackOperation,
} from "./schedule.logic";

const date = "2030-01-15";
const original = { id: "A", date, start: 600, end: 660, title: "Original" };
const service = new ScheduleService(new MeetingService(new FetchHttpClient()));

function loadedContext() {
  const confirmed = new DaySchedule(date, [original]);
  return {
    ...initialSchedule({ service, now: { date, minute: 480 } }),
    confirmed,
    optimistic: confirmed,
  };
}

test("create commit replaces the temporary ID with the server result", () => {
  const context = loadedContext();
  const draft = { ...original, id: "temporary-1", start: 720, end: 750 };
  const saving = { ...context, ...startOperation(context, { type: "create", meeting: draft }) };
  expect(saving.optimistic?.data.meetingsById.has(draft.id)).toBe(true);
  const committed = commitOperation(saving, { ...draft, id: "server-id" });
  expect(committed.confirmed?.data.meetingsById.has("server-id")).toBe(true);
  expect(committed.confirmed?.data.meetingsById.has(draft.id)).toBe(false);
  expect(committed.optimistic).toBe(committed.confirmed);
  expect(committed.pending).toBeNull();
  expect(context.confirmed.toMeetings()).toEqual([original]);
});

test("update commit accepts server fields and closes the editor", () => {
  const context = { ...loadedContext(), editorId: "A" };
  const saving = {
    ...context,
    ...startOperation(context, { type: "update", meeting: { ...original, title: "Draft" } }),
  };
  const result = { ...original, title: "Server title" };
  const committed = commitOperation(saving, result);
  expect(committed.confirmed?.data.meetingsById.get("A")).toEqual(result);
  expect(committed.editorId).toBeNull();
  expect(committed.notice).toBe("Встреча сохранена");
  expect(context.confirmed.toMeetings()).toEqual([original]);
});

test("delete commit removes the meeting and clears the pending operation", () => {
  const context = loadedContext();
  const saving = { ...context, ...startOperation(context, { type: "delete", meetingId: "A" }) };
  const committed = commitOperation(saving, null);
  expect(committed.confirmed?.toMeetings()).toEqual([]);
  expect(committed.pending).toBeNull();
  expect(committed.notice).toBe("Встреча удалена");
});

test("rollback restores the confirmed snapshot and preserves editor selection and draft", () => {
  const context = {
    ...loadedContext(),
    editorId: "A",
    creationDraft: { start: "12:00", end: "13:00", title: "Keep" },
  };
  const saving = {
    ...context,
    ...startOperation(context, { type: "update", meeting: { ...original, title: "Draft" } }),
  };
  const rolledBack = {
    ...saving,
    ...rollbackOperation(saving, new ApiError("Conflict", { status: 409, code: "CONFLICT" })),
  };
  expect(rolledBack.optimistic).toBe(context.confirmed);
  expect(rolledBack.pending).toBeNull();
  expect(rolledBack.editorId).toBe("A");
  expect(rolledBack.creationDraft).toBe(context.creationDraft);
  expect(rolledBack.error).toBe("Conflict");
  expect(saving.optimistic?.data.meetingsById.get("A")?.title).toBe("Draft");
});

test("committing without a pending operation fails explicitly", () => {
  expect(() => commitOperation(loadedContext(), null)).toThrow("No pending operation");
});
