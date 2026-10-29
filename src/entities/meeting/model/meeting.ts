import { z } from "zod";
import type { ClockTime } from "@/shared/lib/date-time";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }, "Некорректная дата");

export const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Укажите время в формате ЧЧ:ММ");

export interface Meeting {
  readonly id: string;
  readonly date: string;
  readonly start: number;
  readonly end: number;
  readonly title?: string;
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "VALIDATION_ERROR",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export function isFutureMeeting(meeting: Meeting, now: ClockTime): boolean {
  return meeting.date > now.date || (meeting.date === now.date && meeting.start > now.minute);
}

export function meetingStatus(meeting: Meeting, now: ClockTime): string {
  if (isFutureMeeting(meeting, now)) return "Предстоит";
  if (meeting.date < now.date || meeting.end <= now.minute) return "Завершена";
  return "Идёт сейчас";
}
