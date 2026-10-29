import { DaySchedule, type ScheduleOperation, type ScheduleService } from "@/entities/day-schedule";
import { isFutureMeeting, type Meeting } from "@/entities/meeting";
import {
  blankDraft,
  errorMessage,
  validateDraft,
  validateOperation,
  type MeetingDraft,
} from "@/features/meeting-editor";
import type { ClockTime } from "@/shared/lib/date-time";
import { ApiError } from "@/shared/api";

export interface ScheduleInput {
  service: ScheduleService;
  now: ClockTime;
}
export interface ScheduleContext extends ScheduleInput {
  date: string;
  confirmed: DaySchedule | null;
  optimistic: DaySchedule | null;
  creationDraft: MeetingDraft;
  pending: ScheduleOperation | null;
  sequence: number;
  editorId: string | null;
  deleteId: string | null;
  error: string | null;
  loadError: string | null;
  notice: string | null;
}

export function initialSchedule(input: ScheduleInput): ScheduleContext {
  return {
    ...input,
    date: input.now.date,
    confirmed: null,
    optimistic: null,
    creationDraft: blankDraft(input.now.date, input.now),
    pending: null,
    sequence: 0,
    editorId: null,
    deleteId: null,
    error: null,
    loadError: null,
    notice: null,
  };
}

export function creationCandidate(context: ScheduleContext) {
  return validateDraft(
    context.optimistic,
    context.creationDraft,
    `temporary-${context.sequence + 1}`,
    "create",
    context.now,
  );
}

export function canEditMeeting(context: ScheduleContext, id: string): boolean {
  const meeting = context.confirmed?.data.meetingsById.get(id);
  return Boolean(meeting && isFutureMeeting(meeting, context.now));
}

export function canAcceptEditor(context: ScheduleContext, meeting: Meeting): boolean {
  return (
    context.editorId === meeting.id &&
    validateOperation(context.optimistic, { type: "update", meeting }, context.now) === null
  );
}

export function selectDate(context: ScheduleContext, date: string): Partial<ScheduleContext> {
  return {
    date,
    confirmed: null,
    optimistic: null,
    creationDraft: blankDraft(date, context.now),
    pending: null,
    editorId: null,
    deleteId: null,
    error: null,
    loadError: null,
    notice: null,
  };
}

export function changeCreationDraft(
  context: ScheduleContext,
  patch: Partial<MeetingDraft>,
): Partial<ScheduleContext> {
  return { creationDraft: { ...context.creationDraft, ...patch }, error: null, notice: null };
}

export function acceptSchedule(schedule: DaySchedule): Partial<ScheduleContext> {
  return { confirmed: schedule, optimistic: schedule, error: null, loadError: null };
}

export function acceptRefresh(
  context: ScheduleContext,
  schedule: DaySchedule,
): Partial<ScheduleContext> {
  return { ...acceptSchedule(schedule), error: context.error };
}

export function loadFailure(error: unknown): Partial<ScheduleContext> {
  return { loadError: errorMessage(error) };
}

export function refreshFailure(context: ScheduleContext, error: unknown): Partial<ScheduleContext> {
  return {
    loadError: `${context.notice ? `${context.notice}. ` : ""}${errorMessage(error)}. Повторите загрузку`,
  };
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function startOperation(
  context: ScheduleContext,
  pending: ScheduleOperation,
): Partial<ScheduleContext> {
  if (!context.confirmed) throw new Error("Schedule is not loaded");
  return {
    pending,
    sequence: context.sequence + 1,
    optimistic: context.confirmed.apply(pending),
    deleteId: null,
    error: null,
    notice: null,
  };
}

export function commitOperation(
  context: ScheduleContext,
  result: Meeting | null,
): Partial<ScheduleContext> {
  if (!context.confirmed || !context.pending) throw new Error("No pending operation");
  const operation = context.pending;
  const confirmed = context.confirmed.apply(
    operation.type === "delete"
      ? operation
      : { type: operation.type, meeting: result ?? operation.meeting },
  );
  return {
    confirmed,
    optimistic: confirmed,
    pending: null,
    editorId: null,
    creationDraft: blankDraft(context.date, context.now),
    notice: operation.type === "delete" ? "Встреча удалена" : "Встреча сохранена",
    error: null,
  };
}

export function rollbackOperation(
  context: ScheduleContext,
  error: unknown,
): Partial<ScheduleContext> {
  return { optimistic: context.confirmed, pending: null, error: errorMessage(error) };
}
