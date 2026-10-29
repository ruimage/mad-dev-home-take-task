import { BookingError, dateSchema, isFutureMeeting, type Meeting } from "@/entities/meeting";
import type { ClockTime } from "@/shared/lib/date-time";

export type ScheduleSlot = Meeting["id"] | null;
export type ScheduleOperation =
  | { type: "create" | "update"; meeting: Meeting }
  | { type: "delete"; meetingId: string };

export interface DayScheduleData {
  readonly date: string;
  readonly workingTime: Readonly<{ start: number; end: number }>;
  readonly minSlotMinutes: number;
  readonly maxSlotMinutes: number;
  readonly meetingsById: ReadonlyMap<string, Meeting>;
  readonly slots: readonly ScheduleSlot[];
}

export class DaySchedule {
  readonly data: DayScheduleData;

  constructor(date: string, meetings: readonly Meeting[] = []) {
    if (!dateSchema.safeParse(date).success) throw new BookingError("Выберите корректную дату");
    const slots: ScheduleSlot[] = Array<ScheduleSlot>(1440).fill(null);
    const byId = new Map<string, Meeting>();
    this.data = {
      date,
      workingTime: { start: 540, end: 1080 },
      minSlotMinutes: 30,
      maxSlotMinutes: 120,
      meetingsById: byId,
      slots,
    };
    for (const meeting of meetings) {
      if (byId.has(meeting.id)) throw new BookingError("Повторяющийся идентификатор встречи");
      this.validateInterval(meeting);
      if (!this.isAvailableForCreation(meeting))
        throw new BookingError("Встречи в расписании пересекаются", 409, "BOOKING_CONFLICT");
      byId.set(meeting.id, Object.freeze({ ...meeting }));
      for (let minute = meeting.start; minute < meeting.end; minute++) slots[minute] = meeting.id;
    }
    Object.freeze(slots);
    Object.freeze(this.data.workingTime);
    Object.freeze(this.data);
  }

  toMeetings(): Meeting[] {
    return [...this.data.meetingsById.values()].toSorted((a, b) => a.start - b.start);
  }

  isWithinWorkingTime(meeting: Meeting): boolean {
    return meeting.start >= this.data.workingTime.start && meeting.end <= this.data.workingTime.end;
  }

  isAvailableForCreation(meeting: Meeting): boolean {
    return this.data.slots.slice(meeting.start, meeting.end).every((id) => id === null);
  }

  isAvailableForUpdate(meeting: Meeting): boolean {
    return this.data.slots
      .slice(meeting.start, meeting.end)
      .every((id) => id === null || id === meeting.id);
  }

  validateInterval(meeting: Meeting): void {
    if (
      meeting.date !== this.data.date ||
      !meeting.id ||
      !Number.isInteger(meeting.start) ||
      !Number.isInteger(meeting.end) ||
      meeting.start >= meeting.end
    ) {
      throw new BookingError("Время начала должно быть раньше окончания");
    }
    if (!this.isWithinWorkingTime(meeting))
      throw new BookingError("Выберите время в пределах 09:00–18:00");
    const duration = meeting.end - meeting.start;
    if (duration < this.data.minSlotMinutes || duration > this.data.maxSlotMinutes)
      throw new BookingError("Длительность встречи — от 30 минут до 2 часов");
  }

  validateOperation(operation: ScheduleOperation, now: ClockTime): void {
    const existing =
      operation.type === "create"
        ? undefined
        : this.data.meetingsById.get(
            operation.type === "delete" ? operation.meetingId : operation.meeting.id,
          );
    if (operation.type !== "create") {
      if (!existing)
        throw new BookingError(
          "Встреча больше не существует. Обновите расписание",
          404,
          "BOOKING_NOT_FOUND",
        );
      if (!isFutureMeeting(existing, now))
        throw new BookingError("Начавшиеся и прошедшие встречи доступны только для просмотра");
    }
    if (operation.type === "delete") return;
    const meeting = operation.meeting;
    // Check format, then working time, then occupied slots, before other constraints.
    if (
      meeting.date !== this.data.date ||
      !Number.isInteger(meeting.start) ||
      !Number.isInteger(meeting.end) ||
      meeting.start >= meeting.end
    )
      throw new BookingError("Проверьте дату и порядок времени");
    if (!this.isWithinWorkingTime(meeting))
      throw new BookingError("Выберите время в пределах 09:00–18:00");
    const available =
      operation.type === "update"
        ? this.isAvailableForUpdate(meeting)
        : this.isAvailableForCreation(meeting);
    if (!available)
      throw new BookingError(
        "Это время уже занято. Выберите другой интервал",
        409,
        "BOOKING_CONFLICT",
      );
    this.validateInterval(meeting);
    if (!isFutureMeeting(meeting, now))
      throw new BookingError("Нельзя бронировать прошедшее время");
    if (operation.type === "create" && this.data.meetingsById.has(meeting.id))
      throw new BookingError("Встреча с таким id уже существует");
  }

  apply(operation: ScheduleOperation): DaySchedule {
    const meetings = new Map(this.data.meetingsById);
    if (operation.type === "delete") meetings.delete(operation.meetingId);
    else meetings.set(operation.meeting.id, operation.meeting);
    return new DaySchedule(this.data.date, [...meetings.values()]);
  }
}
