import { ScheduleContext } from "./schedule-context";
import * as scheduleSelectors from "./schedule.selectors";

export function useScheduleData() {
  const date = ScheduleContext.useSelector(scheduleSelectors.selectDate);
  const now = ScheduleContext.useSelector(scheduleSelectors.selectNow);
  const schedule = ScheduleContext.useSelector(scheduleSelectors.selectSchedule);
  const editorId = ScheduleContext.useSelector(scheduleSelectors.selectEditorId);
  const draft = ScheduleContext.useSelector(scheduleSelectors.selectCreationDraft);
  const error = ScheduleContext.useSelector(scheduleSelectors.selectError);
  const loadError = ScheduleContext.useSelector(scheduleSelectors.selectLoadError);
  const notice = ScheduleContext.useSelector(scheduleSelectors.selectNotice);
  const editor = ScheduleContext.useSelector(scheduleSelectors.selectEditorActor);
  const busy = ScheduleContext.useSelector(scheduleSelectors.selectIsBusy);
  const ready = ScheduleContext.useSelector(scheduleSelectors.selectIsReady);
  const creating = ScheduleContext.useSelector(scheduleSelectors.selectIsCreating);
  const loading = ScheduleContext.useSelector(scheduleSelectors.selectIsLoading);
  const saving = ScheduleContext.useSelector(scheduleSelectors.selectIsSaving);
  const refreshing = ScheduleContext.useSelector(scheduleSelectors.selectIsRefreshing);
  const canRetry = ScheduleContext.useSelector(scheduleSelectors.selectCanRetry);
  const pendingId = ScheduleContext.useSelector(scheduleSelectors.selectPendingMeetingId);

  return {
    date,
    now,
    schedule,
    editorId,
    draft,
    error,
    loadError,
    notice,
    editor,
    busy,
    ready,
    creating,
    loading,
    saving,
    refreshing,
    canRetry,
    pendingId,
  };
}
