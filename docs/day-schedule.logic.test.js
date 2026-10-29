import { describe, expect, test } from "bun:test";
import {
  applyOperation,
  buildSchedule,
  createEditorContext,
  createScheduleContext,
  editorGuards,
  editorMessages,
  editorUpdates,
  scheduleGuards,
  scheduleMessages,
  scheduleUpdates,
  seed,
} from "./day-schedule.logic.js";

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function fixture() {
  const schedule = seed("2030-01-15");
  const meeting = schedule.meetingsById["meeting-A"];
  const now = { date: schedule.date, minute: 540 };
  const event = {
    type: "meeting.draft.changed",
    meetingId: meeting.id,
    meeting,
    schedule,
    now,
    date: "2030-01-16",
    patch: { start: 780, end: 840, title: "Changed" },
    meetings: [meeting],
  };
  const editor = {
    ...createEditorContext(),
    ...editorUpdates.openMeeting(null, event),
  };
  const context = {
    ...createScheduleContext(),
    confirmedSchedule: schedule,
    optimisticSchedule: schedule,
    editorMeetingId: meeting.id,
    deleteId: meeting.id,
    pendingOperation: { type: "update", meeting, sequence: 1 },
  };
  return { schedule, meeting, event, editor, context };
}

describe("pure methods without XState or an actor", () => {
  const groups = {
    editorGuards,
    editorUpdates,
    editorMessages,
    scheduleGuards,
    scheduleUpdates,
    scheduleMessages,
  };
  for (const [groupName, methods] of Object.entries(groups)) {
    for (const [name, method] of Object.entries(methods)) {
      test(`${groupName}.${name} is deterministic and leaves inputs unchanged`, () => {
        const data = fixture();
        const context = freeze(groupName.startsWith("editor") ? data.editor : data.context);
        const event = freeze(data.event);
        const before = structuredClone({ context, event });
        expect(method(context, event)).toEqual(method(context, event));
        expect({ context, event }).toEqual(before);
      });
    }
  }
});

describe("placement rules", () => {
  test.each([
    [530, 590, true],
    [540, 570, false],
    [1050, 1080, false],
    [1050, 1081, true],
  ])("working time %i-%i: rejected=%s", (start, end, rejected) => {
    const { context } = fixture();
    expect(scheduleGuards.outsideWorkingTime({ ...context, creationDraft: { start, end } })).toBe(
      rejected,
    );
  });

  test.each([
    [600, 629, true],
    [600, 630, false],
    [600, 720, false],
    [600, 721, true],
  ])("duration %i-%i: rejected=%s", (start, end, rejected) => {
    const { context } = fixture();
    expect(scheduleGuards.invalidDuration({ ...context, creationDraft: { start, end } })).toBe(
      rejected,
    );
  });

  test("touching intervals use exclusive end boundaries", () => {
    const { context } = fixture();
    expect(
      scheduleGuards.intersectsMeeting({ ...context, creationDraft: { start: 660, end: 720 } }),
    ).toBe(false);
    expect(
      scheduleGuards.intersectsMeeting({ ...context, creationDraft: { start: 690, end: 750 } }),
    ).toBe(true);
  });

  test("update ignores its own slots, but not another meeting", () => {
    const { editor, meeting } = fixture();
    expect(editorGuards.intersectsMeeting(editor)).toBe(false);
    const schedule = buildSchedule(meeting.date, [
      meeting,
      { ...meeting, id: "meeting-B", start: 780, end: 840 },
    ]);
    expect(
      editorGuards.intersectsMeeting({ ...editor, schedule, draft: { start: 780, end: 840 } }),
    ).toBe(true);
  });

  test("an originally started meeting cannot move into the future", () => {
    const { editor } = fixture();
    expect(
      editorGuards.notFuture({
        ...editor,
        now: { date: "2030-01-15", minute: 720 },
        draft: { start: 840, end: 900 },
      }),
    ).toBe(true);
  });

  test("parent rechecks an editor request against its current slots", () => {
    const { context, meeting } = fixture();
    const candidate = { ...meeting, start: 780, end: 840 };
    expect(scheduleGuards.canAcceptEditorSave(context, { meeting: candidate })).toBe(true);
    const occupied = buildSchedule(meeting.date, [meeting, { ...candidate, id: "meeting-B" }]);
    expect(
      scheduleGuards.canAcceptEditorSave(
        { ...context, optimisticSchedule: occupied },
        { meeting: candidate },
      ),
    ).toBe(false);
  });
});

describe("immutable updates and message construction", () => {
  test("editor changes leave original and creation draft untouched", () => {
    const { editor, context } = fixture();
    const updated = editorUpdates.changeDraft(freeze(editor), { patch: { title: "New title" } });
    expect(updated.draft.title).toBe("New title");
    expect(editor.original.title).toBe("Existing meeting");
    expect(context.creationDraft.title).toBe("Planning");
  });

  test("optimistic update moves slots without mutating confirmed data", () => {
    const { context, meeting } = fixture();
    const patch = scheduleUpdates.applyOptimisticUpdate(freeze(context), {
      meeting: { ...meeting, start: 780, end: 840 },
    });
    expect(patch.optimisticSchedule.slots[720]).toBeNull();
    expect(patch.optimisticSchedule.slots[780]).toBe(meeting.id);
    expect(context.confirmedSchedule.slots[720]).toBe(meeting.id);
    expect(context.confirmedSchedule.slots[780]).toBeNull();
  });

  test("rollback restores confirmed schedule without overwriting form data", () => {
    const { context } = fixture();
    const optimistic = scheduleUpdates.applyOptimisticSave(context);
    const changed = { ...context, ...optimistic };
    const rollback = scheduleUpdates.rollbackConflict(freeze(changed));
    expect(rollback.optimisticSchedule).toBe(context.confirmedSchedule);
    expect(rollback.operationError.code).toBe(409);
    expect(rollback).not.toHaveProperty("creationDraft");
    expect(rollback).not.toHaveProperty("draft");
  });

  test("commit uses the server id and removes the temporary version", () => {
    const { context } = fixture();
    const pending = { ...context, ...scheduleUpdates.applyOptimisticSave(context) };
    const patch = scheduleUpdates.commit(freeze(pending), { meeting: { id: "server-id" } });
    expect(patch.confirmedSchedule.slots[600]).toBe("server-id");
    expect(patch.confirmedSchedule.meetingsById["temporary-1"]).toBeUndefined();
    expect(patch.pendingOperation).toBeNull();
  });

  test("deletion frees exactly its occupied minutes", () => {
    const { schedule } = fixture();
    const next = applyOperation(freeze(schedule), { type: "delete", meetingId: "meeting-A" });
    expect(next.slots.every((id) => id === null)).toBe(true);
    expect(schedule.slots[720]).toBe("meeting-A");
  });

  test("editor constructs a save event without sending it", () => {
    const { editor } = fixture();
    const message = editorMessages.requestSave(
      freeze({ ...editor, draft: { start: 780, end: 840, title: "Moved" } }),
    );
    expect(message).toEqual({
      type: "editor.save.requested",
      meeting: { id: "meeting-A", date: "2030-01-15", start: 780, end: 840, title: "Moved" },
    });
  });

  test("schedule refresh updates validation input, not the editor draft", () => {
    const { editor, schedule } = fixture();
    const patch = editorUpdates.setSchedule(freeze(editor), { schedule });
    expect(patch).toEqual({ schedule });
    expect(patch).not.toHaveProperty("draft");
    expect(patch).not.toHaveProperty("original");
  });
});
