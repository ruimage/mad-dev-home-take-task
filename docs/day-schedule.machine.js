import { assign, createMachine, sendParent, sendTo } from "xstate";
import {
  createEditorContext,
  createScheduleContext,
  editorGuards,
  editorUpdates,
  editorMessages,
  scheduleGuards,
  scheduleUpdates,
  scheduleMessages,
} from "./day-schedule.logic.js";

// Event types use lowercase dot-separated domain/action/outcome names.
// These adapters are the only bridge between pure functions and XState arguments.
function withContext(method) {
  return ({ context, event }) => method(context, event);
}

function bindGuards(methods) {
  return Object.fromEntries(
    Object.entries(methods).map(([name, method]) => [name, withContext(method)]),
  );
}

function bindUpdates(methods) {
  return Object.fromEntries(
    Object.entries(methods).map(([name, method]) => [name, assign(withContext(method))]),
  );
}

const editableEvents = {
  "meeting.draft.changed": { target: "editing", actions: "changeDraft" },
  "meeting.edit.cancelled": { target: "closed", actions: ["clearEditor", "notifyCancelled"] },
  "meeting.save.requested": [
    { guard: "invalidInterval", actions: "setIntervalError" },
    { guard: "outsideWorkingTime", actions: "setWorkingTimeError" },
    { guard: "intersectsMeeting", actions: "setIntersectionError" },
    { guard: "invalidDuration", actions: "setDurationError" },
    { guard: "notFuture", actions: "setPastError" },
    { target: "submitting", actions: "requestSave" },
  ],
};

export const meetingEditorMachine = createMachine(
  {
    id: "meetingEditor",
    initial: "closed",
    context: createEditorContext,
    on: {
      "editor.open.requested": { target: ".editing", actions: "openMeeting" },
      "editor.reset.requested": { target: ".closed", actions: "clearEditor" },
      "clock.changed": { actions: "setClock" },
      "schedule.changed": { actions: "setSchedule" },
    },
    states: {
      closed: {},
      editing: { on: editableEvents },
      conflict: {
        description: "409: keep the original meeting and the user's draft.",
        on: editableEvents,
      },
      failed: {
        description: "Save failed or was rejected; keep the draft for retry.",
        on: editableEvents,
      },
      submitting: {
        description: "Wait for the parent; no direct HTTP or optimistic schedule here.",
        on: {
          "editor.open.requested": {},
          "editor.save.succeeded": { target: "closed", actions: "clearEditor" },
          "editor.save.conflicted": { target: "conflict", actions: "setConflict" },
          "editor.save.failed": { target: "failed", actions: "setSaveError" },
          "editor.save.rejected": { target: "failed", actions: "setSaveError" },
        },
      },
    },
  },
  {
    guards: bindGuards(editorGuards),
    actions: {
      ...bindUpdates(editorUpdates),
      requestSave: sendParent(withContext(editorMessages.requestSave)),
      notifyCancelled: sendParent(withContext(editorMessages.notifyCancelled)),
    },
  },
);

export const dayScheduleMachine = createMachine(
  {
    id: "daySchedule",
    initial: "loading",
    context: createScheduleContext,
    invoke: { id: "meetingEditor", src: "meetingEditor" },
    on: {
      "clock.changed": { actions: ["setClock", "forwardClock"] },
      "editor.save.requested": { actions: "rejectEditorSave" },
    },
    states: {
      loading: {
        description: "Initial day load. Send schedule.load.succeeded or schedule.load.failed.",
        on: {
          "schedule.load.succeeded": { target: "ready", actions: "acceptLoadedDay" },
          "schedule.load.failed": { target: "loadFailed", actions: "setLoadError" },
          "schedule.date.selected": {
            target: "loading",
            reenter: true,
            actions: ["selectDate", "resetEditor"],
          },
        },
      },
      loadFailed: {
        on: {
          "schedule.load.retry": { target: "loading", actions: "clearLoadError" },
          "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] },
        },
      },
      ready: {
        initial: "route",
        on: {
          "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] },
        },
        states: {
          route: {
            always: [{ guard: "hasEditor", target: "editingMeeting" }, { target: "creating" }],
          },
          creating: {
            on: {
              "meeting.draft.changed": { actions: "changeDraft" },
              "meeting.creation.requested": { actions: "resetDraft" },
              "meeting.edit.requested": [
                {
                  guard: "canEdit",
                  target: "editingMeeting",
                  actions: ["selectEditorMeeting", "openEditor"],
                },
                { actions: "setReadonlyError" },
              ],
              "meeting.save.requested": [
                { guard: "invalidInterval", actions: "setIntervalError" },
                { guard: "outsideWorkingTime", actions: "setWorkingTimeError" },
                { guard: "intersectsMeeting", actions: "setIntersectionError" },
                { guard: "invalidDuration", actions: "setDurationError" },
                { guard: "notFuture", actions: "setPastError" },
                {
                  target: "#daySchedule.saving",
                  actions: "applyOptimisticSave",
                },
              ],
              "meeting.delete.requested": [
                {
                  guard: "canEdit",
                  target: "confirmingDelete",
                  actions: "selectForDeletion",
                },
                { actions: "setReadonlyError" },
              ],
            },
          },
          editingMeeting: {
            on: {
              "meeting.draft.changed": { actions: "forwardDraft" },
              "meeting.save.requested": { actions: "forwardSave" },
              "meeting.edit.cancelled": { actions: "cancelEditor" },
              "editor.closed": { target: "creating", actions: "clearEditorMeeting" },
              "editor.save.requested": [
                {
                  guard: "canAcceptEditorSave",
                  target: "#daySchedule.saving",
                  actions: "applyOptimisticUpdate",
                },
                { actions: "rejectEditorSave" },
              ],
            },
          },
          confirmingDelete: {
            on: {
              "meeting.delete.cancelled": { target: "creating", actions: "cancelDeletion" },
              "meeting.delete.confirmed": [
                {
                  guard: "canDeleteSelected",
                  target: "#daySchedule.saving",
                  actions: "applyOptimisticDelete",
                },
                {
                  target: "creating",
                  actions: ["setReadonlyError", "cancelDeletion"],
                },
              ],
            },
          },
        },
      },
      saving: {
        description:
          "Optimistic result is visible. schedule.mutation.succeeded / schedule.mutation.conflicted / schedule.mutation.failed.",
        on: {
          "schedule.mutation.succeeded": {
            target: "refreshing",
            actions: ["commit", "notifyEditorSuccess"],
          },
          "schedule.mutation.conflicted": {
            target: "refreshing",
            actions: ["rollbackConflict", "notifyEditorConflict"],
          },
          "schedule.mutation.failed": {
            target: "ready",
            actions: ["rollbackError", "notifyEditorFailure"],
          },
        },
      },
      refreshing: {
        description: "Reload after success or 409. Draft is preserved after 409.",
        on: {
          "schedule.load.succeeded": {
            target: "ready",
            actions: ["acceptRefreshedDay", "syncEditorSchedule"],
          },
          "schedule.load.failed": { target: "refreshFailed", actions: "setLoadError" },
        },
      },
      refreshFailed: {
        description: "Keep local data; schedule.load.retry reloads only, never repeats a mutation.",
        on: {
          "schedule.load.retry": { target: "refreshing", actions: "clearLoadError" },
          "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] },
        },
      },
    },
  },
  {
    actors: { meetingEditor: meetingEditorMachine },
    guards: bindGuards(scheduleGuards),
    actions: {
      ...bindUpdates(scheduleUpdates),
      forwardClock: sendTo("meetingEditor", withContext(scheduleMessages.forwardClock)),
      forwardDraft: sendTo("meetingEditor", withContext(scheduleMessages.forwardDraft)),
      forwardSave: sendTo("meetingEditor", withContext(scheduleMessages.forwardSave)),
      cancelEditor: sendTo("meetingEditor", withContext(scheduleMessages.cancelEditor)),
      resetEditor: sendTo("meetingEditor", withContext(scheduleMessages.resetEditor)),
      notifyEditorSuccess: sendTo(
        "meetingEditor",
        withContext(scheduleMessages.notifyEditorSuccess),
      ),
      notifyEditorConflict: sendTo(
        "meetingEditor",
        withContext(scheduleMessages.notifyEditorConflict),
      ),
      notifyEditorFailure: sendTo(
        "meetingEditor",
        withContext(scheduleMessages.notifyEditorFailure),
      ),
      rejectEditorSave: sendTo("meetingEditor", withContext(scheduleMessages.rejectEditorSave)),
      syncEditorSchedule: sendTo("meetingEditor", withContext(scheduleMessages.syncEditorSchedule)),
      openEditor: sendTo("meetingEditor", withContext(scheduleMessages.openEditor)),
    },
  },
);
