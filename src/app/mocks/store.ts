import { DaySchedule, type ScheduleOperation } from "@/entities/day-schedule";
import { BookingError, type Meeting } from "@/entities/meeting";
import { readClock, type ClockTime } from "@/shared/lib/date-time";

export class BookingStore {
  private meetings = new Map<string, Meeting>();
  conflictNextCreate = false;
  failNextLoad = false;
  failNextMutation = false;

  constructor(private readonly now: () => ClockTime = readClock) {
    const date = now().date;
    this.meetings.set("welcome", {
      id: "welcome",
      date,
      start: 720,
      end: 780,
      title: "Командная встреча",
    });
  }

  list(date: string): DaySchedule {
    return new DaySchedule(
      date,
      [...this.meetings.values()].filter((meeting) => meeting.date === date),
    );
  }

  find(id: string): Meeting {
    const meeting = this.meetings.get(id);
    if (!meeting)
      throw new BookingError(
        "Встреча больше не существует. Обновите расписание",
        404,
        "BOOKING_NOT_FOUND",
      );
    return meeting;
  }

  save(operation: ScheduleOperation): Meeting | null {
    if (this.failNextMutation) {
      this.failNextMutation = false;
      throw new BookingError(
        "Не удалось сохранить встречу. Повторите попытку",
        503,
        "SERVER_ERROR",
      );
    }
    const date =
      operation.type === "delete" ? this.find(operation.meetingId).date : operation.meeting.date;
    if (operation.type === "update" && this.find(operation.meeting.id).date !== date)
      throw new BookingError("Нельзя менять дату существующей встречи");
    this.list(date).validateOperation(operation, this.now());
    if (this.conflictNextCreate && operation.type === "create") {
      this.conflictNextCreate = false;
      const concurrent = {
        ...operation.meeting,
        id: crypto.randomUUID(),
        title: "Параллельная встреча",
      };
      this.meetings.set(concurrent.id, concurrent);
      this.list(date).validateOperation(operation, this.now());
    }
    // No await between validation and write: competing requests cannot both win.
    if (operation.type === "delete") {
      this.meetings.delete(operation.meetingId);
      return null;
    }
    this.meetings.set(operation.meeting.id, Object.freeze({ ...operation.meeting }));
    return operation.meeting;
  }
}
