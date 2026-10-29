import { assign, fromPromise, sendTo, setup } from "xstate";
import { DaySchedule, ScheduleService, type ScheduleOperation } from "@/entities/day-schedule";
import { dateSchema, type Meeting } from "@/entities/meeting";
import {
  errorMessage,
  meetingEditorMachine,
  validateOperation,
  type MeetingDraft,
} from "@/features/meeting-editor";
import type { ClockTime } from "@/shared/lib/date-time";
import {
  acceptSchedule,
  acceptRefresh,
  canAcceptEditor,
  canEditMeeting,
  changeCreationDraft,
  commitOperation,
  creationCandidate,
  initialSchedule,
  isConflictError,
  loadFailure,
  refreshFailure,
  rollbackOperation,
  selectDate,
  startOperation,
  type ScheduleContext,
  type ScheduleInput,
} from "./schedule.logic";

export type ScheduleEvent =
  | { type: "clock.changed"; now: ClockTime }
  | { type: "schedule.date.selected"; date: string }
  | { type: "schedule.load.retry" }
  | { type: "meeting.draft.changed"; patch: Partial<MeetingDraft> }
  | { type: "meeting.save.requested" }
  | { type: "meeting.edit.requested"; meetingId: string }
  | { type: "meeting.edit.cancelled" }
  | { type: "editor.closed" }
  | { type: "editor.save.requested"; meeting: Meeting }
  | { type: "meeting.delete.requested"; meetingId: string }
  | { type: "meeting.delete.confirmed" }
  | { type: "meeting.delete.cancelled" };

const dateTransitions = [
  {
    guard: "validDate",
    target: "#daySchedule.loading",
    reenter: true,
    actions: ["selectDate", "resetEditor"],
  },
  { target: "#daySchedule.selectingDate", actions: ["selectDate", "resetEditor"] },
] as const;

export const dayScheduleMachine = setup({
  types: {
    context: {} as ScheduleContext,
    events: {} as ScheduleEvent,
    input: {} as ScheduleInput,
  },
  actors: {
    meetingEditor: meetingEditorMachine,
    loadDay: fromPromise<DaySchedule, { service: ScheduleService; date: string }>(
      // XState discards obsolete results. Keep GET transport alive across React's
      // StrictMode actor rehydration, which can otherwise reuse an aborted promise.
      async ({ input }) => input.service.load(input.date),
    ),
    saveMeeting: fromPromise<
      Meeting | null,
      { service: ScheduleService; operation: ScheduleOperation }
    >(async ({ input, signal }) => input.service.save(input.operation, signal)),
  },
  guards: {
    validDate: ({ event }) =>
      event.type === "schedule.date.selected" && dateSchema.safeParse(event.date).success,
    hasEditor: ({ context }) => context.editorId !== null,
    canCreate: ({ context }) => creationCandidate(context).error === null,
    canEdit: ({ context, event }) =>
      "meetingId" in event && canEditMeeting(context, event.meetingId),
    canDelete: ({ context }) =>
      context.deleteId !== null &&
      validateOperation(
        context.optimistic,
        { type: "delete", meetingId: context.deleteId },
        context.now,
      ) === null,
    canAcceptEditor: ({ context, event }) =>
      event.type === "editor.save.requested" && canAcceptEditor(context, event.meeting),
  },
  actions: {
    setClock: assign(({ event }) => (event.type === "clock.changed" ? { now: event.now } : {})),
    forwardClock: sendTo("meetingEditor", ({ context }) => ({
      type: "clock.changed",
      now: context.now,
    })),
    selectDate: assign(({ context, event }) =>
      event.type === "schedule.date.selected" ? selectDate(context, event.date) : {},
    ),
    resetEditor: sendTo("meetingEditor", { type: "editor.reset.requested" }),
    changeDraft: assign(({ context, event }) =>
      event.type === "meeting.draft.changed" ? changeCreationDraft(context, event.patch) : {},
    ),
    setCreationError: assign(({ context }) => ({ error: creationCandidate(context).error })),
    selectEditor: assign(({ event }) =>
      event.type === "meeting.edit.requested"
        ? { editorId: event.meetingId, error: null, notice: null }
        : {},
    ),
    openEditor: sendTo("meetingEditor", ({ context }) => {
      const meeting = context.confirmed?.data.meetingsById.get(context.editorId ?? "");
      if (!meeting || !context.confirmed) throw new Error("Meeting not found");
      return {
        type: "editor.open.requested",
        meeting,
        schedule: context.confirmed,
        now: context.now,
      };
    }),
    forwardDraft: sendTo("meetingEditor", ({ event }) => {
      if (event.type !== "meeting.draft.changed") throw new Error("Expected draft event");
      return event;
    }),
    forwardSave: sendTo("meetingEditor", { type: "meeting.save.requested" }),
    cancelEditor: sendTo("meetingEditor", { type: "meeting.edit.cancelled" }),
    clearEditor: assign({ editorId: null, error: null }),
    rejectEditor: sendTo("meetingEditor", {
      type: "editor.save.rejected",
      message: "Расписание изменилось. Проверьте доступность встречи",
    }),
    notifySuccess: sendTo("meetingEditor", { type: "editor.save.succeeded" }),
    notifyConflict: sendTo("meetingEditor", { type: "editor.save.conflicted" }),
    setReadonlyError: assign({
      error: "Начавшиеся и прошедшие встречи доступны только для просмотра",
    }),
    selectDeletion: assign(({ event }) =>
      event.type === "meeting.delete.requested"
        ? { deleteId: event.meetingId, error: null, notice: null }
        : {},
    ),
    cancelDeletion: assign({ deleteId: null }),
    startCreate: assign(({ context }) => {
      const candidate = creationCandidate(context);
      if (!candidate.meeting) throw new Error(candidate.error);
      return startOperation(context, { type: "create", meeting: candidate.meeting });
    }),
    startUpdate: assign(({ context, event }) =>
      event.type === "editor.save.requested"
        ? startOperation(context, { type: "update", meeting: event.meeting })
        : {},
    ),
    startDelete: assign(({ context }) =>
      startOperation(context, { type: "delete", meetingId: context.deleteId ?? "" }),
    ),
    syncEditor: sendTo("meetingEditor", ({ context }) => {
      if (!context.confirmed) throw new Error("Schedule not loaded");
      return { type: "schedule.changed", schedule: context.confirmed };
    }),
  },
}).createMachine({
  id: "daySchedule",
  initial: "loading",
  context: ({ input }) => initialSchedule(input),
  invoke: {
    id: "meetingEditor",
    src: "meetingEditor",
    input: ({ context }) => ({ now: context.now }),
  },
  on: {
    "clock.changed": { actions: ["setClock", "forwardClock"] },
    "editor.save.requested": { actions: "rejectEditor" },
  },
  states: {
    selectingDate: { on: { "schedule.date.selected": dateTransitions } },
    loading: {
      entry: assign({ loadError: null }),
      invoke: {
        src: "loadDay",
        input: ({ context }) => ({ service: context.service, date: context.date }),
        onDone: { target: "ready", actions: assign(({ event }) => acceptSchedule(event.output)) },
        onError: {
          target: "loadFailed",
          actions: assign(({ event }) => loadFailure(event.error)),
        },
      },
      on: { "schedule.date.selected": dateTransitions },
    },
    loadFailed: {
      on: {
        "schedule.load.retry": { target: "loading", actions: assign({ error: null }) },
        "schedule.date.selected": dateTransitions,
      },
    },
    ready: {
      initial: "route",
      on: { "schedule.date.selected": dateTransitions },
      states: {
        route: { always: [{ guard: "hasEditor", target: "editing" }, { target: "creating" }] },
        creating: {
          on: {
            "meeting.draft.changed": { actions: "changeDraft" },
            "meeting.save.requested": [
              { guard: "canCreate", target: "#daySchedule.saving", actions: "startCreate" },
              { actions: "setCreationError" },
            ],
            "meeting.edit.requested": [
              { guard: "canEdit", target: "editing", actions: ["selectEditor", "openEditor"] },
              { actions: "setReadonlyError" },
            ],
            "meeting.delete.requested": [
              { guard: "canEdit", target: "confirmingDelete", actions: "selectDeletion" },
              { actions: "setReadonlyError" },
            ],
          },
        },
        editing: {
          on: {
            "meeting.draft.changed": { actions: "forwardDraft" },
            "meeting.save.requested": { actions: "forwardSave" },
            "meeting.edit.cancelled": { actions: "cancelEditor" },
            "editor.closed": { target: "creating", actions: "clearEditor" },
            "editor.save.requested": [
              { guard: "canAcceptEditor", target: "#daySchedule.saving", actions: "startUpdate" },
              { actions: "rejectEditor" },
            ],
          },
        },
        confirmingDelete: {
          on: {
            "meeting.delete.cancelled": { target: "creating", actions: "cancelDeletion" },
            "meeting.delete.confirmed": [
              { guard: "canDelete", target: "#daySchedule.saving", actions: "startDelete" },
              { target: "creating", actions: ["setReadonlyError", "cancelDeletion"] },
            ],
          },
        },
      },
    },
    saving: {
      invoke: {
        src: "saveMeeting",
        input: ({ context }) => {
          if (!context.pending) throw new Error("No pending operation");
          return { service: context.service, operation: context.pending };
        },
        onDone: {
          target: "refreshing",
          actions: [
            assign(({ context, event }) => commitOperation(context, event.output)),
            "notifySuccess",
          ],
        },
        onError: [
          {
            guard: ({ event }) => isConflictError(event.error),
            target: "refreshing",
            actions: [
              assign(({ context, event }) => rollbackOperation(context, event.error)),
              "notifyConflict",
            ],
          },
          {
            target: "ready",
            actions: [
              assign(({ context, event }) => rollbackOperation(context, event.error)),
              sendTo("meetingEditor", ({ event }) => ({
                type: "editor.save.failed",
                message: errorMessage(event.error),
              })),
            ],
          },
        ],
      },
    },
    refreshing: {
      entry: assign({ loadError: null }),
      invoke: {
        src: "loadDay",
        input: ({ context }) => ({ service: context.service, date: context.date }),
        onDone: {
          target: "ready",
          actions: [
            assign(({ context, event }) => acceptRefresh(context, event.output)),
            "syncEditor",
          ],
        },
        onError: {
          target: "refreshFailed",
          actions: assign(({ context, event }) => refreshFailure(context, event.error)),
        },
      },
    },
    refreshFailed: {
      on: {
        "schedule.load.retry": { target: "refreshing" },
        "schedule.date.selected": dateTransitions,
      },
    },
  },
});
