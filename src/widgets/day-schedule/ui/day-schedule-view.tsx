import { useScheduleData } from "../model/use-schedule-data";
import { EditableDaySchedule } from "./editable-day-schedule";

export function DayScheduleView() {
  const scheduleData = useScheduleData();
  return (
    <div className="space-y-4">
      {scheduleData.schedule && (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Расписание дня</h2>
            <span className="text-sm text-muted-foreground">
              Встреч: {scheduleData.schedule.toMeetings().length}
            </span>
          </div>
          <EditableDaySchedule />
        </>
      )}
    </div>
  );
}
