// docs/day-schedule.machine.js
import { assign, createMachine, sendParent, sendTo } from "xstate";

// docs/day-schedule.logic.js
var initialDate = "2030-01-15";
function future(meeting, now) {
  return meeting.date > now.date || meeting.date === now.date && meeting.start > now.minute;
}
function buildSchedule(date, meetings) {
  const slots = Array(1440).fill(null);
  const meetingsById = {};
  for (const meeting of meetings) {
    meetingsById[meeting.id] = { ...meeting, date };
    for (let index = meeting.start;index < meeting.end; index++) {
      slots[index] = meeting.id;
    }
  }
  return {
    date,
    workingTime: { start: 540, end: 1080 },
    minSlotMinutes: 30,
    maxSlotMinutes: 120,
    meetingsById,
    slots
  };
}
function seed(date) {
  return buildSchedule(date, [
    { id: "meeting-A", date, start: 720, end: 780, title: "Existing meeting" }
  ]);
}
function blankDraft() {
  return { start: 600, end: 660, title: "Planning" };
}
function applyOperation(schedule, operation, savedMeeting) {
  const meetings = { ...schedule.meetingsById };
  if (operation.type === "delete") {
    delete meetings[operation.meetingId];
  } else {
    const meeting = savedMeeting ?? operation.meeting;
    if (operation.type === "update")
      delete meetings[operation.meeting.id];
    meetings[meeting.id] = meeting;
  }
  return buildSchedule(schedule.date, Object.values(meetings));
}
function isAvailableTime(context) {
  const { start, end } = context.creationDraft;
  return context.optimisticSchedule.slots.slice(start, end).every((id) => id === null);
}
function isFuture(date, start, now) {
  return date > now.date || date === now.date && start > now.minute;
}
function createEditorContext() {
  return {
    original: null,
    draft: null,
    schedule: null,
    now: null,
    validationError: null,
    operationError: null
  };
}
var editorGuards = {
  invalidInterval(context, event) {
    const { start, end } = context.draft;
    return !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end;
  },
  outsideWorkingTime(context, event) {
    const { start, end } = context.schedule.workingTime;
    return context.draft.start < start || context.draft.end > end;
  },
  intersectsMeeting(context, event) {
    return context.schedule.slots.slice(context.draft.start, context.draft.end).some((id) => id !== null && id !== context.original.id);
  },
  invalidDuration(context, event) {
    const duration = context.draft.end - context.draft.start;
    return duration < context.schedule.minSlotMinutes || duration > context.schedule.maxSlotMinutes;
  },
  notFuture(context, event) {
    return !future(context.original, context.now) || !future({ ...context.original, ...context.draft }, context.now);
  }
};
var editorUpdates = {
  openMeeting(context, event) {
    return {
      original: { ...event.meeting },
      draft: {
        start: event.meeting.start,
        end: event.meeting.end,
        title: event.meeting.title ?? ""
      },
      schedule: event.schedule,
      now: event.now,
      validationError: null,
      operationError: null
    };
  },
  changeDraft(context, event) {
    return {
      draft: { ...context.draft, ...event.patch },
      validationError: null,
      operationError: null
    };
  },
  clearEditor(context, event) {
    return {
      original: null,
      draft: null,
      schedule: null,
      validationError: null,
      operationError: null
    };
  },
  setIntervalError(context, event) {
    return { validationError: "INVALID_INTERVAL" };
  },
  setWorkingTimeError(context, event) {
    return { validationError: "OUTSIDE_WORKING_TIME" };
  },
  setIntersectionError(context, event) {
    return { validationError: "TIME_OCCUPIED" };
  },
  setDurationError(context, event) {
    return { validationError: "INVALID_DURATION" };
  },
  setPastError(context, event) {
    return { validationError: "PAST_TIME" };
  },
  setConflict(context, event) {
    return { operationError: { code: 409, message: "Time was booked by another user" } };
  },
  setSaveError(context, event) {
    return {
      operationError: {
        code: event.code ?? 500,
        message: event.message ?? "Save failed"
      }
    };
  },
  setClock(context, event) {
    return { now: event.now };
  },
  setSchedule(context, event) {
    return { schedule: event.schedule };
  }
};
var editorMessages = {
  requestSave(context, event) {
    return {
      type: "editor.save.requested",
      meeting: {
        ...context.original,
        start: context.draft.start,
        end: context.draft.end,
        title: context.draft.title
      }
    };
  },
  notifyCancelled(context, event) {
    return { type: "editor.closed" };
  }
};
function createScheduleContext() {
  return {
    selectedDate: initialDate,
    now: { date: initialDate, minute: 540 },
    confirmedSchedule: null,
    optimisticSchedule: null,
    creationDraft: blankDraft(),
    editorMeetingId: null,
    deleteId: null,
    pendingOperation: null,
    sequence: 0,
    validationError: null,
    operationError: null,
    loadError: null,
    refreshReason: null
  };
}
var scheduleGuards = {
  hasEditor(context, event) {
    return context.editorMeetingId !== null;
  },
  canAcceptEditorSave(context, event) {
    const meeting = event.meeting;
    const schedule = context.optimisticSchedule;
    const original = schedule.meetingsById[context.editorMeetingId];
    if (!original || meeting.id !== original.id || meeting.date !== schedule.date)
      return false;
    const { start, end } = meeting;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end)
      return false;
    if (start < schedule.workingTime.start || end > schedule.workingTime.end)
      return false;
    if (schedule.slots.slice(start, end).some((id) => id !== null && id !== original.id))
      return false;
    const duration = end - start;
    return duration >= schedule.minSlotMinutes && duration <= schedule.maxSlotMinutes && isFuture(original.date, original.start, context.now) && isFuture(meeting.date, meeting.start, context.now);
  },
  invalidInterval(context, event) {
    const { start, end } = context.creationDraft;
    return !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end;
  },
  outsideWorkingTime(context, event) {
    const { start, end } = context.optimisticSchedule.workingTime;
    return context.creationDraft.start < start || context.creationDraft.end > end;
  },
  intersectsMeeting(context, event) {
    return !isAvailableTime(context);
  },
  invalidDuration(context, event) {
    const duration = context.creationDraft.end - context.creationDraft.start;
    const schedule = context.optimisticSchedule;
    return duration < schedule.minSlotMinutes || duration > schedule.maxSlotMinutes;
  },
  notFuture(context, event) {
    return !isFuture(context.selectedDate, context.creationDraft.start, context.now);
  },
  canEdit(context, event) {
    const meeting = context.confirmedSchedule.meetingsById[event.meetingId];
    return Boolean(meeting && isFuture(meeting.date, meeting.start, context.now));
  },
  canDeleteSelected(context, event) {
    const meeting = context.confirmedSchedule.meetingsById[context.deleteId];
    return Boolean(meeting && isFuture(meeting.date, meeting.start, context.now));
  }
};
var scheduleUpdates = {
  clearEditorMeeting(context, event) {
    return { editorMeetingId: null };
  },
  selectEditorMeeting(context, event) {
    return { editorMeetingId: event.meetingId };
  },
  setClock(context, event) {
    return { now: event.now };
  },
  clearLoadError(context, event) {
    return { loadError: null };
  },
  setLoadError(context, event) {
    return { loadError: event.message ?? "Could not load day" };
  },
  setIntervalError(context, event) {
    return { validationError: "INVALID_INTERVAL" };
  },
  setWorkingTimeError(context, event) {
    return { validationError: "OUTSIDE_WORKING_TIME" };
  },
  setIntersectionError(context, event) {
    return { validationError: "TIME_OCCUPIED" };
  },
  setDurationError(context, event) {
    return { validationError: "INVALID_DURATION" };
  },
  setPastError(context, event) {
    return { validationError: "PAST_TIME" };
  },
  setReadonlyError(context, event) {
    return { validationError: "MEETING_READONLY_OR_MISSING" };
  },
  changeDraft(context, event) {
    return {
      creationDraft: { ...context.creationDraft, ...event.patch },
      validationError: null,
      operationError: null
    };
  },
  resetDraft(context, event) {
    return {
      creationDraft: blankDraft(),
      editorMeetingId: null,
      validationError: null,
      operationError: null
    };
  },
  selectForDeletion(context, event) {
    return { deleteId: event.meetingId };
  },
  cancelDeletion(context, event) {
    return { deleteId: null };
  },
  selectDate(context, event) {
    return {
      selectedDate: event.date,
      confirmedSchedule: null,
      optimisticSchedule: null,
      creationDraft: blankDraft(),
      editorMeetingId: null,
      deleteId: null,
      pendingOperation: null,
      validationError: null,
      operationError: null,
      loadError: null,
      refreshReason: null
    };
  },
  acceptLoadedDay(context, event) {
    const schedule = event.meetings ? buildSchedule(context.selectedDate, event.meetings) : seed(context.selectedDate);
    return { confirmedSchedule: schedule, optimisticSchedule: schedule, loadError: null };
  },
  applyOptimisticSave(context, event) {
    const sequence = context.sequence + 1;
    const meeting = {
      ...context.creationDraft,
      id: `temporary-${sequence}`,
      date: context.selectedDate
    };
    const operation = { type: "create", meeting, sequence };
    return {
      sequence,
      pendingOperation: operation,
      optimisticSchedule: applyOperation(context.confirmedSchedule, operation),
      validationError: null,
      operationError: null,
      refreshReason: null
    };
  },
  applyOptimisticUpdate(context, event) {
    const sequence = context.sequence + 1;
    const operation = { type: "update", meeting: { ...event.meeting }, sequence };
    return {
      sequence,
      pendingOperation: operation,
      optimisticSchedule: applyOperation(context.confirmedSchedule, operation),
      validationError: null,
      operationError: null,
      refreshReason: null
    };
  },
  applyOptimisticDelete(context, event) {
    const sequence = context.sequence + 1;
    const operation = { type: "delete", meetingId: context.deleteId, sequence };
    return {
      sequence,
      pendingOperation: operation,
      deleteId: null,
      optimisticSchedule: applyOperation(context.confirmedSchedule, operation),
      validationError: null,
      operationError: null,
      refreshReason: null
    };
  },
  commit(context, event) {
    const operation = context.pendingOperation;
    const savedMeeting = operation.type === "delete" ? undefined : {
      ...operation.meeting,
      ...event.meeting ?? {},
      id: event.meeting?.id ?? (operation.type === "create" ? `server-${operation.sequence}` : operation.meeting.id)
    };
    const schedule = applyOperation(context.confirmedSchedule, operation, savedMeeting);
    return {
      confirmedSchedule: schedule,
      optimisticSchedule: schedule,
      pendingOperation: null,
      creationDraft: blankDraft(),
      editorMeetingId: null,
      refreshReason: "saved",
      operationError: null
    };
  },
  rollbackConflict(context, event) {
    return {
      optimisticSchedule: context.confirmedSchedule,
      pendingOperation: null,
      refreshReason: "conflict",
      operationError: { code: 409, message: "Time was booked by another user" }
    };
  },
  rollbackError(context, event) {
    return {
      optimisticSchedule: context.confirmedSchedule,
      pendingOperation: null,
      operationError: { code: event.code ?? 500, message: event.message ?? "Save failed" }
    };
  },
  acceptRefreshedDay(context, event) {
    const schedule = event.meetings ? buildSchedule(context.selectedDate, event.meetings) : context.confirmedSchedule;
    return { confirmedSchedule: schedule, optimisticSchedule: schedule, loadError: null };
  }
};
var scheduleMessages = {
  forwardClock(context, event) {
    return event;
  },
  forwardDraft(context, event) {
    return event;
  },
  forwardSave(context, event) {
    return { type: "meeting.save.requested" };
  },
  cancelEditor(context, event) {
    return { type: "meeting.edit.cancelled" };
  },
  resetEditor(context, event) {
    return { type: "editor.reset.requested" };
  },
  notifyEditorSuccess(context, event) {
    return { type: "editor.save.succeeded" };
  },
  notifyEditorConflict(context, event) {
    return { type: "editor.save.conflicted" };
  },
  notifyEditorFailure(context, event) {
    return {
      type: "editor.save.failed",
      code: event.code,
      message: event.message
    };
  },
  rejectEditorSave(context, event) {
    return {
      type: "editor.save.rejected",
      code: 400,
      message: "Schedule changed or operation is not allowed"
    };
  },
  syncEditorSchedule(context, event) {
    return {
      type: "schedule.changed",
      schedule: context.confirmedSchedule
    };
  },
  openEditor(context, event) {
    return {
      type: "editor.open.requested",
      meeting: context.confirmedSchedule.meetingsById[context.editorMeetingId],
      schedule: context.confirmedSchedule,
      now: context.now
    };
  }
};

// docs/day-schedule.machine.js
function withContext(method) {
  return ({ context, event }) => method(context, event);
}
function bindGuards(methods) {
  return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, withContext(method)]));
}
function bindUpdates(methods) {
  return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, assign(withContext(method))]));
}
var editableEvents = {
  "meeting.draft.changed": { target: "editing", actions: "changeDraft" },
  "meeting.edit.cancelled": { target: "closed", actions: ["clearEditor", "notifyCancelled"] },
  "meeting.save.requested": [
    { guard: "invalidInterval", actions: "setIntervalError" },
    { guard: "outsideWorkingTime", actions: "setWorkingTimeError" },
    { guard: "intersectsMeeting", actions: "setIntersectionError" },
    { guard: "invalidDuration", actions: "setDurationError" },
    { guard: "notFuture", actions: "setPastError" },
    { target: "submitting", actions: "requestSave" }
  ]
};
var meetingEditorMachine = createMachine({
  id: "meetingEditor",
  initial: "closed",
  context: createEditorContext,
  on: {
    "editor.open.requested": { target: ".editing", actions: "openMeeting" },
    "editor.reset.requested": { target: ".closed", actions: "clearEditor" },
    "clock.changed": { actions: "setClock" },
    "schedule.changed": { actions: "setSchedule" }
  },
  states: {
    closed: {},
    editing: { on: editableEvents },
    conflict: {
      description: "409: keep the original meeting and the user's draft.",
      on: editableEvents
    },
    failed: {
      description: "Save failed or was rejected; keep the draft for retry.",
      on: editableEvents
    },
    submitting: {
      description: "Wait for the parent; no direct HTTP or optimistic schedule here.",
      on: {
        "editor.open.requested": {},
        "editor.save.succeeded": { target: "closed", actions: "clearEditor" },
        "editor.save.conflicted": { target: "conflict", actions: "setConflict" },
        "editor.save.failed": { target: "failed", actions: "setSaveError" },
        "editor.save.rejected": { target: "failed", actions: "setSaveError" }
      }
    }
  }
}, {
  guards: bindGuards(editorGuards),
  actions: {
    ...bindUpdates(editorUpdates),
    requestSave: sendParent(withContext(editorMessages.requestSave)),
    notifyCancelled: sendParent(withContext(editorMessages.notifyCancelled))
  }
});
var dayScheduleMachine = createMachine({
  id: "daySchedule",
  initial: "loading",
  context: createScheduleContext,
  invoke: { id: "meetingEditor", src: "meetingEditor" },
  on: {
    "clock.changed": { actions: ["setClock", "forwardClock"] },
    "editor.save.requested": { actions: "rejectEditorSave" }
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
          actions: ["selectDate", "resetEditor"]
        }
      }
    },
    loadFailed: {
      on: {
        "schedule.load.retry": { target: "loading", actions: "clearLoadError" },
        "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] }
      }
    },
    ready: {
      initial: "route",
      on: {
        "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] }
      },
      states: {
        route: {
          always: [{ guard: "hasEditor", target: "editingMeeting" }, { target: "creating" }]
        },
        creating: {
          on: {
            "meeting.draft.changed": { actions: "changeDraft" },
            "meeting.creation.requested": { actions: "resetDraft" },
            "meeting.edit.requested": [
              {
                guard: "canEdit",
                target: "editingMeeting",
                actions: ["selectEditorMeeting", "openEditor"]
              },
              { actions: "setReadonlyError" }
            ],
            "meeting.save.requested": [
              { guard: "invalidInterval", actions: "setIntervalError" },
              { guard: "outsideWorkingTime", actions: "setWorkingTimeError" },
              { guard: "intersectsMeeting", actions: "setIntersectionError" },
              { guard: "invalidDuration", actions: "setDurationError" },
              { guard: "notFuture", actions: "setPastError" },
              {
                target: "#daySchedule.saving",
                actions: "applyOptimisticSave"
              }
            ],
            "meeting.delete.requested": [
              {
                guard: "canEdit",
                target: "confirmingDelete",
                actions: "selectForDeletion"
              },
              { actions: "setReadonlyError" }
            ]
          }
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
                actions: "applyOptimisticUpdate"
              },
              { actions: "rejectEditorSave" }
            ]
          }
        },
        confirmingDelete: {
          on: {
            "meeting.delete.cancelled": { target: "creating", actions: "cancelDeletion" },
            "meeting.delete.confirmed": [
              {
                guard: "canDeleteSelected",
                target: "#daySchedule.saving",
                actions: "applyOptimisticDelete"
              },
              {
                target: "creating",
                actions: ["setReadonlyError", "cancelDeletion"]
              }
            ]
          }
        }
      }
    },
    saving: {
      description: "Optimistic result is visible. schedule.mutation.succeeded / schedule.mutation.conflicted / schedule.mutation.failed.",
      on: {
        "schedule.mutation.succeeded": {
          target: "refreshing",
          actions: ["commit", "notifyEditorSuccess"]
        },
        "schedule.mutation.conflicted": {
          target: "refreshing",
          actions: ["rollbackConflict", "notifyEditorConflict"]
        },
        "schedule.mutation.failed": {
          target: "ready",
          actions: ["rollbackError", "notifyEditorFailure"]
        }
      }
    },
    refreshing: {
      description: "Reload after success or 409. Draft is preserved after 409.",
      on: {
        "schedule.load.succeeded": {
          target: "ready",
          actions: ["acceptRefreshedDay", "syncEditorSchedule"]
        },
        "schedule.load.failed": { target: "refreshFailed", actions: "setLoadError" }
      }
    },
    refreshFailed: {
      description: "Keep local data; schedule.load.retry reloads only, never repeats a mutation.",
      on: {
        "schedule.load.retry": { target: "refreshing", actions: "clearLoadError" },
        "schedule.date.selected": { target: "loading", actions: ["selectDate", "resetEditor"] }
      }
    }
  }
}, {
  actors: { meetingEditor: meetingEditorMachine },
  guards: bindGuards(scheduleGuards),
  actions: {
    ...bindUpdates(scheduleUpdates),
    forwardClock: sendTo("meetingEditor", withContext(scheduleMessages.forwardClock)),
    forwardDraft: sendTo("meetingEditor", withContext(scheduleMessages.forwardDraft)),
    forwardSave: sendTo("meetingEditor", withContext(scheduleMessages.forwardSave)),
    cancelEditor: sendTo("meetingEditor", withContext(scheduleMessages.cancelEditor)),
    resetEditor: sendTo("meetingEditor", withContext(scheduleMessages.resetEditor)),
    notifyEditorSuccess: sendTo("meetingEditor", withContext(scheduleMessages.notifyEditorSuccess)),
    notifyEditorConflict: sendTo("meetingEditor", withContext(scheduleMessages.notifyEditorConflict)),
    notifyEditorFailure: sendTo("meetingEditor", withContext(scheduleMessages.notifyEditorFailure)),
    rejectEditorSave: sendTo("meetingEditor", withContext(scheduleMessages.rejectEditorSave)),
    syncEditorSchedule: sendTo("meetingEditor", withContext(scheduleMessages.syncEditorSchedule)),
    openEditor: sendTo("meetingEditor", withContext(scheduleMessages.openEditor))
  }
});
export {
  dayScheduleMachine,
  meetingEditorMachine
};
