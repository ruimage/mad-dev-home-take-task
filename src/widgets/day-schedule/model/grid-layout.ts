import type { DayScheduleData } from "@/entities/day-schedule";
import type { Meeting } from "@/entities/meeting";
import type { ClockTime } from "@/shared/lib/date-time";

/** A minimum-duration row has enough room for the meeting's title and controls. */
export const SLOT_HEIGHT = 96;
type GridSettings = Pick<DayScheduleData, "workingTime" | "minSlotMinutes">;

export function currentTimeOffset(
  date: string,
  now: ClockTime,
  settings: GridSettings,
): number | null {
  if (
    date !== now.date ||
    now.minute < settings.workingTime.start ||
    now.minute > settings.workingTime.end
  )
    return null;
  return ((now.minute - settings.workingTime.start) * SLOT_HEIGHT) / settings.minSlotMinutes;
}

export function meetingGridLayout(meeting: Meeting, settings: GridSettings) {
  const pixelsPerMinute = SLOT_HEIGHT / settings.minSlotMinutes;
  const anchorIndex = Math.floor(
    (meeting.start - settings.workingTime.start) / settings.minSlotMinutes,
  );
  const anchorMinute = settings.workingTime.start + anchorIndex * settings.minSlotMinutes;
  return {
    anchorIndex,
    anchorMinute,
    translateY: (meeting.start - anchorMinute) * pixelsPerMinute,
    height: (meeting.end - meeting.start) * pixelsPerMinute,
  };
}

export function gridRows(settings: GridSettings) {
  const { start, end } = settings.workingTime;
  return Array.from({ length: Math.ceil((end - start) / settings.minSlotMinutes) }, (_, index) => {
    const minute = start + index * settings.minSlotMinutes;
    return {
      minute,
      height:
        (Math.min(settings.minSlotMinutes, end - minute) * SLOT_HEIGHT) / settings.minSlotMinutes,
    };
  });
}

export function timeTicks(settings: GridSettings) {
  const { start, end } = settings.workingTime;
  const firstTick = Math.ceil(start / 15) * 15;
  return Array.from({ length: Math.floor((end - firstTick) / 15) + 1 }, (_, index) => {
    const minute = firstTick + index * 15;
    return {
      minute,
      top: ((minute - start) * SLOT_HEIGHT) / settings.minSlotMinutes,
      kind: minute % 60 === 0 ? "hour" : minute % 30 === 0 ? "half" : "quarter",
    };
  });
}
