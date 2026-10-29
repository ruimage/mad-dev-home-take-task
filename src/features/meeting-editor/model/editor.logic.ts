import { DaySchedule, type ScheduleOperation } from "@/entities/day-schedule";
import { timeSchema, type Meeting } from "@/entities/meeting";
import { formatMinute, parseMinute, type ClockTime } from "@/shared/lib/date-time";
import { ApiError } from "@/shared/api";

export interface MeetingDraft {
  start: string;
  end: string;
  title: string;
}
export interface EditorContext {
  original: Meeting | null;
  draft: MeetingDraft;
  schedule: DaySchedule | null;
  now: ClockTime;
  error: string | null;
}
export type CandidateResult = { meeting: Meeting; error: null } | { meeting: null; error: string };

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && !error.code) {
    return error.status === undefined
      ? "Не удалось связаться с сервером. Повторите попытку"
      : "Сервер вернул ошибку. Повторите попытку";
  }
  return error instanceof Error ? error.message : "Не удалось выполнить запрос. Повторите попытку";
}

export function blankDraft(date: string, now: ClockTime): MeetingDraft {
  const start =
    date === now.date ? Math.min(1050, Math.max(540, Math.ceil((now.minute + 1) / 30) * 30)) : 540;
  return { start: formatMinute(start), end: formatMinute(start + 30), title: "" };
}

export function draftFromMeeting(meeting: Meeting): MeetingDraft {
  return {
    start: formatMinute(meeting.start),
    end: formatMinute(meeting.end),
    title: meeting.title ?? "",
  };
}

export function validateDraft(
  schedule: DaySchedule | null,
  draft: MeetingDraft,
  id: string,
  type: "create" | "update",
  now: ClockTime,
): CandidateResult {
  if (!schedule) return { meeting: null, error: "Сначала загрузите расписание" };
  if (!timeSchema.safeParse(draft.start).success || !timeSchema.safeParse(draft.end).success)
    return { meeting: null, error: "Укажите время начала и окончания" };
  const meeting: Meeting = {
    id,
    date: schedule.data.date,
    start: parseMinute(draft.start),
    end: parseMinute(draft.end),
    title: draft.title.trim(),
  };
  try {
    schedule.validateOperation({ type, meeting }, now);
    return { meeting, error: null };
  } catch (error) {
    return { meeting: null, error: errorMessage(error) };
  }
}

export function validateOperation(
  schedule: DaySchedule | null,
  operation: ScheduleOperation,
  now: ClockTime,
): string | null {
  if (!schedule) return "Сначала загрузите расписание";
  try {
    schedule.validateOperation(operation, now);
    return null;
  } catch (error) {
    return errorMessage(error);
  }
}

export function createEditorContext(now: ClockTime): EditorContext {
  return { original: null, draft: blankDraft(now.date, now), schedule: null, now, error: null };
}

export function openEditor(
  meeting: Meeting,
  schedule: DaySchedule,
  now: ClockTime,
): Partial<EditorContext> {
  return { original: meeting, draft: draftFromMeeting(meeting), schedule, now, error: null };
}

export function changeEditorDraft(
  context: EditorContext,
  patch: Partial<MeetingDraft>,
): Partial<EditorContext> {
  return { draft: { ...context.draft, ...patch }, error: null };
}

export function editorCandidate(context: EditorContext): CandidateResult {
  return validateDraft(
    context.schedule,
    context.draft,
    context.original?.id ?? "",
    "update",
    context.now,
  );
}

export function editorCanSave(context: EditorContext): boolean {
  return editorCandidate(context).error === null;
}

export function editorSaveMessage(context: EditorContext): {
  type: "editor.save.requested";
  meeting: Meeting;
} {
  const candidate = editorCandidate(context);
  if (!candidate.meeting) throw new Error(candidate.error);
  return { type: "editor.save.requested", meeting: candidate.meeting };
}
