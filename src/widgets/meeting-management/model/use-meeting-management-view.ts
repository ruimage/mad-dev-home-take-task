import { useScheduleData } from "@/widgets/day-schedule";
import { getMeetingManagementView } from "./meeting-management-view";

export function useMeetingManagementView() {
  const scheduleData = useScheduleData();
  const view = getMeetingManagementView({
    date: scheduleData.date,
    now: scheduleData.now,
    hasSchedule: scheduleData.schedule !== null,
    editing: scheduleData.editorId !== null,
    hasEditor: scheduleData.editor !== undefined,
    creating: scheduleData.creating,
  });

  return {
    scheduleData,
    ...view,
    editorActor: view.showEditor ? scheduleData.editor : undefined,
  };
}
