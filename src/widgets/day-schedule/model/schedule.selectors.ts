import type { SnapshotFrom } from "xstate";
import type { dayScheduleMachine } from "./schedule.machine";

export type ScheduleSnapshot = SnapshotFrom<typeof dayScheduleMachine>;

export const selectDate = (snapshot: ScheduleSnapshot) => snapshot.context.date;
export const selectNow = (snapshot: ScheduleSnapshot) => snapshot.context.now;
export const selectSchedule = (snapshot: ScheduleSnapshot) => snapshot.context.optimistic;
export const selectConfirmedSchedule = (snapshot: ScheduleSnapshot) => snapshot.context.confirmed;
export const selectCreationDraft = (snapshot: ScheduleSnapshot) => snapshot.context.creationDraft;
export const selectPendingOperation = (snapshot: ScheduleSnapshot) => snapshot.context.pending;
export const selectEditorId = (snapshot: ScheduleSnapshot) => snapshot.context.editorId;
export const selectDeleteId = (snapshot: ScheduleSnapshot) => snapshot.context.deleteId;
export const selectError = (snapshot: ScheduleSnapshot) => snapshot.context.error;
export const selectLoadError = (snapshot: ScheduleSnapshot) => snapshot.context.loadError;
export const selectNotice = (snapshot: ScheduleSnapshot) => snapshot.context.notice;
export const selectIsLoading = (snapshot: ScheduleSnapshot) => snapshot.matches("loading");
export const selectIsSaving = (snapshot: ScheduleSnapshot) => snapshot.matches("saving");
export const selectIsRefreshing = (snapshot: ScheduleSnapshot) => snapshot.matches("refreshing");
export const selectIsReady = (snapshot: ScheduleSnapshot) => snapshot.matches("ready");
export const selectIsCreating = (snapshot: ScheduleSnapshot) =>
  snapshot.matches({ ready: "creating" });
export const selectIsEditing = (snapshot: ScheduleSnapshot) =>
  snapshot.matches({ ready: "editing" });
export const selectIsConfirmingDelete = (snapshot: ScheduleSnapshot) =>
  snapshot.matches({ ready: "confirmingDelete" });

export const selectEditorActor = (snapshot: ScheduleSnapshot) => snapshot.children.meetingEditor;
export const selectIsBusy = (snapshot: ScheduleSnapshot) =>
  selectIsSaving(snapshot) || selectIsRefreshing(snapshot);
export const selectCanRetry = (snapshot: ScheduleSnapshot) =>
  snapshot.matches("loadFailed") || snapshot.matches("refreshFailed");
export const selectHasSchedule = (snapshot: ScheduleSnapshot) => selectSchedule(snapshot) !== null;
export const selectPendingMeetingId = (snapshot: ScheduleSnapshot) => {
  const pending = selectPendingOperation(snapshot);
  return pending && pending.type !== "delete" ? pending.meeting.id : null;
};
