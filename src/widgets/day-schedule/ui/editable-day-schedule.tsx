import { readClock } from "@/shared/lib/date-time";
import { ScheduleContext } from "../model/schedule-context";
import { useScheduleData } from "../model/use-schedule-data";
import { DayScheduleGrid } from "./day-schedule-grid";
import { ScheduleMeeting } from "./schedule-meeting";

export function EditableDaySchedule() {
  const scheduleData = useScheduleData();
  const { send } = ScheduleContext.useActorRef();

  function onEdit(meetingId: string) {
    if (!scheduleData.creating) return;
    send({ type: "clock.changed", now: readClock() });
    send({ type: "meeting.edit.requested", meetingId });
  }
  function onDelete(meetingId: string) {
    if (!scheduleData.creating) return;
    send({ type: "clock.changed", now: readClock() });
    send({ type: "meeting.delete.requested", meetingId });
  }

  if (!scheduleData.schedule) return null;

  return (
    <DayScheduleGrid
      schedule={scheduleData.schedule}
      now={scheduleData.now}
      renderMeeting={(meeting, layout) => (
        <ScheduleMeeting
          meeting={meeting}
          layout={layout}
          now={scheduleData.now}
          selected={scheduleData.editorId === meeting.id}
          pending={scheduleData.pendingId === meeting.id}
          canManage={scheduleData.creating}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    />
  );
}
