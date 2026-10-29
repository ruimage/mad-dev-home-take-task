import { formatCalendarDate, type ClockTime } from "@/shared/lib/date-time";

interface MeetingManagementInput {
  date: string;
  now: ClockTime;
  hasSchedule: boolean;
  editing: boolean;
  hasEditor: boolean;
  creating: boolean;
}

export function getMeetingManagementView(input: MeetingManagementInput) {
  const pastDate = input.date < input.now.date;
  const dayFinished = input.date === input.now.date && input.now.minute >= 1050;
  const showEditor = input.hasSchedule && input.editing && input.hasEditor;
  let creationNotice: string | null = null;
  if (pastDate) creationNotice = "Прошедшая дата — доступен только просмотр.";
  else if (dayFinished) creationNotice = "На сегодня больше нет времени для новой встречи.";

  return {
    dateLabel: formatCalendarDate(input.date) ?? "Выберите дату",
    showEditor,
    showCreationForm: input.hasSchedule && !showEditor,
    creationDisabled: !input.creating || pastDate || dayFinished,
    creationNotice,
  };
}
