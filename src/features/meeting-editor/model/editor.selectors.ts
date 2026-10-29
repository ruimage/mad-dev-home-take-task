import type { SnapshotFrom } from "xstate";
import type { meetingEditorMachine } from "./editor.machine";

export type EditorSnapshot = SnapshotFrom<typeof meetingEditorMachine>;

export const selectOriginalMeeting = (snapshot: EditorSnapshot) => snapshot.context.original;
export const selectDraft = (snapshot: EditorSnapshot) => snapshot.context.draft;
export const selectSchedule = (snapshot: EditorSnapshot) => snapshot.context.schedule;
export const selectNow = (snapshot: EditorSnapshot) => snapshot.context.now;
export const selectError = (snapshot: EditorSnapshot) => snapshot.context.error;
export const selectIsClosed = (snapshot: EditorSnapshot) => snapshot.matches("closed");
export const selectIsEditing = (snapshot: EditorSnapshot) => snapshot.matches("editing");
export const selectIsSubmitting = (snapshot: EditorSnapshot) => snapshot.matches("submitting");
export const selectHasConflict = (snapshot: EditorSnapshot) => snapshot.matches("conflict");
export const selectHasFailed = (snapshot: EditorSnapshot) => snapshot.matches("failed");
