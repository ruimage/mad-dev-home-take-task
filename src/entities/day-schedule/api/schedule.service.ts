import { MeetingService, type Meeting } from "@/entities/meeting";
import { createToken } from "@/shared/lib/di";
import { DaySchedule, type ScheduleOperation } from "../model/day-schedule";

export class ScheduleService {
  constructor(private readonly meetings: MeetingService) {}

  async load(date: string, signal?: AbortSignal): Promise<DaySchedule> {
    return new DaySchedule(date, await this.meetings.list(date, signal));
  }

  async save(operation: ScheduleOperation, signal?: AbortSignal): Promise<Meeting | null> {
    if (operation.type === "delete") {
      await this.meetings.delete(operation.meetingId, signal);
      return null;
    }
    return operation.type === "create"
      ? this.meetings.create(operation.meeting, signal)
      : this.meetings.update(operation.meeting, signal);
  }
}

export const SCHEDULE_SERVICE = createToken<ScheduleService>("entities.day-schedule.service");
