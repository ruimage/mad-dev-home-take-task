// Pure simulation logic: no XState, React, network, timers or mutations of inputs.

// Methods accept (context, event) and return booleans, context patches or event objects.

const initialDate = "2030-01-15";

export function future(meeting, now) {
  return meeting.date > now.date || (meeting.date === now.date && meeting.start > now.minute);
}

export function buildSchedule(date, meetings) {
  const slots = Array(1440).fill(null);
  const meetingsById = {};
  for (const meeting of meetings) {
    meetingsById[meeting.id] = { ...meeting, date };
    for (let index = meeting.start; index < meeting.end; index++) {
      slots[index] = meeting.id;
    }
  }
  return {
    date,
    workingTime: { start: 540, end: 1080 },
    minSlotMinutes: 30,
    maxSlotMinutes: 120,
    meetingsById,
    slots,
  };
}

export function seed(date) {
  return buildSchedule(date, [
    { id: "meeting-A", date, start: 720, end: 780, title: "Existing meeting" },
  ]);
}

export function blankDraft() {
  return { start: 600, end: 660, title: "Planning" };
}

export function applyOperation(schedule, operation, savedMeeting) {
  const meetings = { ...schedule.meetingsById };
  if (operation.type === "delete") {
    delete meetings[operation.meetingId];
  } else {
    const meeting = savedMeeting ?? operation.meeting;
    if (operation.type === "update") delete meetings[operation.meeting.id];
    meetings[meeting.id] = meeting;
  }
  return buildSchedule(schedule.date, Object.values(meetings));
}

export function isAvailableTime(context) {
  const { start, end } = context.creationDraft;
  return context.optimisticSchedule.slots.slice(start, end).every((id) => id === null);
}

export function isFuture(date, start, now) {
  return date > now.date || (date === now.date && start > now.minute);
}

export function createEditorContext() {
  return {
    original: null,
    draft: null,
    schedule: null,
    now: null,
    validationError: null,
    operationError: null,
  };
}

export const editorGuards = {
  invalidInterval(context, _event) {
    const { start, end } = context.draft;
    return (
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end
    );
  },
  outsideWorkingTime(context, _event) {
    const { start, end } = context.schedule.workingTime;
    return context.draft.start < start || context.draft.end > end;
  },
  intersectsMeeting(context, _event) {
    return context.schedule.slots
      .slice(context.draft.start, context.draft.end)
      .some((id) => id !== null && id !== context.original.id);
  },
  invalidDuration(context, _event) {
    const duration = context.draft.end - context.draft.start;
    return duration < context.schedule.minSlotMinutes || duration > context.schedule.maxSlotMinutes;
  },
  notFuture(context, _event) {
    return (
      !future(context.original, context.now) ||
      !future({ ...context.original, ...context.draft }, context.now)
    );
  },
};

export const editorUpdates = {
  openMeeting(_context, event) {
    return {
      original: { ...event.meeting },
      draft: {
        start: event.meeting.start,
        end: event.meeting.end,
        title: event.meeting.title ?? "",
      },
      schedule: event.schedule,
      now: event.now,
      validationError: null,
      operationError: null,
    };
  },
  changeDraft(context, event) {
    return {
      draft: { ...context.draft, ...event.patch },
      validationError: null,
      operationError: null,
    };
  },
  clearEditor(_context, _event) {
    return {
      original: null,
      draft: null,
      schedule: null,
      validationError: null,
      operationError: null,
    };
  },
  setIntervalError(_context, _event) {
    return { validationError: "INVALID_INTERVAL" };
  },
  setWorkingTimeError(_context, _event) {
    return { validationError: "OUTSIDE_WORKING_TIME" };
  },
  setIntersectionError(_context, _event) {
    return { validationError: "TIME_OCCUPIED" };
  },
  setDurationError(_context, _event) {
    return { validationError: "INVALID_DURATION" };
  },
  setPastError(_context, _event) {
    return { validationError: "PAST_TIME" };
  },
  setConflict(_context, _event) {
    return { operationError: { code: 409, message: "Time was booked by another user" } };
  },
  setSaveError(_context, event) {
    return {
      operationError: {
        code: event.code ?? 500,
        message: event.message ?? "Save failed",
      },
    };
  },
  setClock(_context, event) {
    return { now: event.now };
  },
  setSchedule(_context, event) {
    return { schedule: event.schedule };
  },
};

export const editorMessages = {
  requestSave(context, _event) {
    return {
      type: "editor.save.requested",
      meeting: {
        ...context.original,
        start: context.draft.start,
        end: context.draft.end,
        title: context.draft.title,
      },
    };
  },
  notifyCancelled(_context, _event) {
    return { type: "editor.closed" };
  },
};

export function createScheduleContext() {
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
    refreshReason: null,
  };
}

export const scheduleGuards = {
  hasEditor(context, _event) {
    return context.editorMeetingId !== null;
  },
  canAcceptEditorSave(context, event) {
    const meeting = event.meeting;
    const schedule = context.optimisticSchedule;
    const original = schedule.meetingsById[context.editorMeetingId];
    if (!original || meeting.id !== original.id || meeting.date !== schedule.date) return false;
    const { start, end } = meeting;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) return false;
    if (start < schedule.workingTime.start || end > schedule.workingTime.end) return false;
    if (schedule.slots.slice(start, end).some((id) => id !== null && id !== original.id))
      return false;
    const duration = end - start;
    return (
      duration >= schedule.minSlotMinutes &&
      duration <= schedule.maxSlotMinutes &&
      isFuture(original.date, original.start, context.now) &&
      isFuture(meeting.date, meeting.start, context.now)
    );
  },
  invalidInterval(context, _event) {
    const { start, end } = context.creationDraft;
    return (
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end
    );
  },
  outsideWorkingTime(context, _event) {
    const { start, end } = context.optimisticSchedule.workingTime;
    return context.creationDraft.start < start || context.creationDraft.end > end;
  },
  intersectsMeeting(context, _event) {
    return !isAvailableTime(context);
  },
  invalidDuration(context, _event) {
    const duration = context.creationDraft.end - context.creationDraft.start;
    const schedule = context.optimisticSchedule;
    return duration < schedule.minSlotMinutes || duration > schedule.maxSlotMinutes;
  },
  notFuture(context, _event) {
    return !isFuture(context.selectedDate, context.creationDraft.start, context.now);
  },
  canEdit(context, event) {
    const meeting = context.confirmedSchedule.meetingsById[event.meetingId];
    return Boolean(meeting && isFuture(meeting.date, meeting.start, context.now));
  },
  canDeleteSelected(context, _event) {
    const meeting = context.confirmedSchedule.meetingsById[context.deleteId];
    return Boolean(meeting && isFuture(meeting.date, meeting.start, context.now));
  },
};

export const scheduleUpdates = {
  clearEditorMeeting(_context, _event) {
    return { editorMeetingId: null };
  },
  selectEditorMeeting(_context, event) {
    return { editorMeetingId: event.meetingId };
  },
  setClock(_context, event) {
    return { now: event.now };
  },
  clearLoadError(_context, _event) {
    return { loadError: null };
  },
  setLoadError(_context, event) {
    return { loadError: event.message ?? "Could not load day" };
  },
  setIntervalError(_context, _event) {
    return { validationError: "INVALID_INTERVAL" };
  },
  setWorkingTimeError(_context, _event) {
    return { validationError: "OUTSIDE_WORKING_TIME" };
  },
  setIntersectionError(_context, _event) {
    return { validationError: "TIME_OCCUPIED" };
  },
  setDurationError(_context, _event) {
    return { validationError: "INVALID_DURATION" };
  },
  setPastError(_context, _event) {
    return { validationError: "PAST_TIME" };
  },
  setReadonlyError(_context, _event) {
    return { validationError: "MEETING_READONLY_OR_MISSING" };
  },
  changeDraft(context, event) {
    return {
      creationDraft: { ...context.creationDraft, ...event.patch },
      validationError: null,
      operationError: null,
    };
  },
  resetDraft(_context, _event) {
    return {
      creationDraft: blankDraft(),
      editorMeetingId: null,
      validationError: null,
      operationError: null,
    };
  },
  selectForDeletion(_context, event) {
    return { deleteId: event.meetingId };
  },
  cancelDeletion(_context, _event) {
    return { deleteId: null };
  },
  selectDate(_context, event) {
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
      refreshReason: null,
    };
  },
  acceptLoadedDay(context, event) {
    const schedule = event.meetings
      ? buildSchedule(context.selectedDate, event.meetings)
      : seed(context.selectedDate);
    return { confirmedSchedule: schedule, optimisticSchedule: schedule, loadError: null };
  },
  applyOptimisticSave(context, _event) {
    const sequence = context.sequence + 1;
    const meeting = {
      ...context.creationDraft,
      id: `temporary-${sequence}`,
      date: context.selectedDate,
    };
    const operation = { type: "create", meeting, sequence };
    return {
      sequence,
      pendingOperation: operation,
      optimisticSchedule: applyOperation(context.confirmedSchedule, operation),
      validationError: null,
      operationError: null,
      refreshReason: null,
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
      refreshReason: null,
    };
  },
  applyOptimisticDelete(context, _event) {
    const sequence = context.sequence + 1;
    const operation = { type: "delete", meetingId: context.deleteId, sequence };
    return {
      sequence,
      pendingOperation: operation,
      deleteId: null,
      optimisticSchedule: applyOperation(context.confirmedSchedule, operation),
      validationError: null,
      operationError: null,
      refreshReason: null,
    };
  },
  commit(context, event) {
    const operation = context.pendingOperation;
    const savedMeeting =
      operation.type === "delete"
        ? undefined
        : {
            ...operation.meeting,
            ...event.meeting,
            id:
              event.meeting?.id ??
              (operation.type === "create" ? `server-${operation.sequence}` : operation.meeting.id),
          };
    const schedule = applyOperation(context.confirmedSchedule, operation, savedMeeting);
    return {
      confirmedSchedule: schedule,
      optimisticSchedule: schedule,
      pendingOperation: null,
      creationDraft: blankDraft(),
      editorMeetingId: null,
      refreshReason: "saved",
      operationError: null,
    };
  },
  rollbackConflict(context, _event) {
    return {
      optimisticSchedule: context.confirmedSchedule,
      pendingOperation: null,
      refreshReason: "conflict",
      operationError: { code: 409, message: "Time was booked by another user" },
    };
  },
  rollbackError(context, event) {
    return {
      optimisticSchedule: context.confirmedSchedule,
      pendingOperation: null,
      operationError: { code: event.code ?? 500, message: event.message ?? "Save failed" },
    };
  },
  acceptRefreshedDay(context, event) {
    const schedule = event.meetings
      ? buildSchedule(context.selectedDate, event.meetings)
      : context.confirmedSchedule;
    return { confirmedSchedule: schedule, optimisticSchedule: schedule, loadError: null };
  },
};

export const scheduleMessages = {
  forwardClock(_context, event) {
    return event;
  },
  forwardDraft(_context, event) {
    return event;
  },
  forwardSave(_context, _event) {
    return { type: "meeting.save.requested" };
  },
  cancelEditor(_context, _event) {
    return { type: "meeting.edit.cancelled" };
  },
  resetEditor(_context, _event) {
    return { type: "editor.reset.requested" };
  },
  notifyEditorSuccess(_context, _event) {
    return { type: "editor.save.succeeded" };
  },
  notifyEditorConflict(_context, _event) {
    return { type: "editor.save.conflicted" };
  },
  notifyEditorFailure(_context, event) {
    return {
      type: "editor.save.failed",
      code: event.code,
      message: event.message,
    };
  },
  rejectEditorSave(_context, _event) {
    return {
      type: "editor.save.rejected",
      code: 400,
      message: "Schedule changed or operation is not allowed",
    };
  },
  syncEditorSchedule(context, _event) {
    return {
      type: "schedule.changed",
      schedule: context.confirmedSchedule,
    };
  },
  openEditor(context, _event) {
    return {
      type: "editor.open.requested",
      meeting: context.confirmedSchedule.meetingsById[context.editorMeetingId],
      schedule: context.confirmedSchedule,
      now: context.now,
    };
  },
};
