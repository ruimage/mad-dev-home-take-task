import { assign, sendParent, setup, type ActorRefFrom } from "xstate";
import { DaySchedule } from "@/entities/day-schedule";
import type { Meeting } from "@/entities/meeting";
import type { ClockTime } from "@/shared/lib/date-time";
import {
  changeEditorDraft,
  createEditorContext,
  editorCanSave,
  editorCandidate,
  editorSaveMessage,
  openEditor,
  type EditorContext,
  type MeetingDraft,
} from "./editor.logic";

export type EditorEvent =
  | { type: "editor.open.requested"; meeting: Meeting; schedule: DaySchedule; now: ClockTime }
  | { type: "editor.reset.requested" }
  | { type: "clock.changed"; now: ClockTime }
  | { type: "schedule.changed"; schedule: DaySchedule }
  | { type: "meeting.draft.changed"; patch: Partial<MeetingDraft> }
  | { type: "meeting.save.requested" }
  | { type: "meeting.edit.cancelled" }
  | { type: "editor.save.succeeded" }
  | { type: "editor.save.conflicted" }
  | { type: "editor.save.failed"; message: string }
  | { type: "editor.save.rejected"; message: string };

const editableEvents = {
  "meeting.draft.changed": { target: "editing", actions: "changeDraft" },
  "meeting.edit.cancelled": { target: "closed", actions: ["clearEditor", "notifyCancelled"] },
  "meeting.save.requested": [
    { guard: "canSave", target: "submitting", actions: "requestSave" },
    { actions: "setValidationError" },
  ],
} as const;

export const meetingEditorMachine = setup({
  types: {
    context: {} as EditorContext,
    events: {} as EditorEvent,
    input: {} as { now: ClockTime },
  },
  guards: { canSave: ({ context }) => editorCanSave(context) },
  actions: {
    openEditor: assign(({ event }) =>
      event.type === "editor.open.requested"
        ? openEditor(event.meeting, event.schedule, event.now)
        : {},
    ),
    changeDraft: assign(({ context, event }) =>
      event.type === "meeting.draft.changed" ? changeEditorDraft(context, event.patch) : {},
    ),
    clearEditor: assign({ original: null, schedule: null, error: null }),
    setClock: assign(({ event }) => (event.type === "clock.changed" ? { now: event.now } : {})),
    setSchedule: assign(({ event }) =>
      event.type === "schedule.changed" ? { schedule: event.schedule } : {},
    ),
    setValidationError: assign(({ context }) => ({ error: editorCandidate(context).error })),
    setConflict: assign({ error: "Это время уже занято. Выберите другой интервал" }),
    setFailure: assign(({ event }) => ("message" in event ? { error: event.message } : {})),
    requestSave: sendParent(({ context }) => editorSaveMessage(context)),
    notifyCancelled: sendParent({ type: "editor.closed" }),
  },
}).createMachine({
  id: "meetingEditor",
  initial: "closed",
  context: ({ input }) => createEditorContext(input.now),
  on: {
    "editor.open.requested": { target: ".editing", actions: "openEditor" },
    "editor.reset.requested": { target: ".closed", actions: "clearEditor" },
    "clock.changed": { actions: "setClock" },
    "schedule.changed": { actions: "setSchedule" },
  },
  states: {
    closed: {},
    editing: { on: editableEvents },
    conflict: { on: editableEvents },
    failed: { on: editableEvents },
    submitting: {
      on: {
        "editor.open.requested": {},
        "editor.save.succeeded": { target: "closed", actions: "clearEditor" },
        "editor.save.conflicted": { target: "conflict", actions: "setConflict" },
        "editor.save.failed": { target: "failed", actions: "setFailure" },
        "editor.save.rejected": { target: "failed", actions: "setFailure" },
      },
    },
  },
});

export type MeetingEditorActor = ActorRefFrom<typeof meetingEditorMachine>;
