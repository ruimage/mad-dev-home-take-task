import type { SnapshotFrom } from "xstate";
import type { displayMachine } from "./display.machine";

export type DisplaySnapshot = SnapshotFrom<typeof displayMachine>;

export const selectNow = (snapshot: DisplaySnapshot) => snapshot.context.now;
export const selectSchedule = (snapshot: DisplaySnapshot) => snapshot.context.schedule;
export const selectError = (snapshot: DisplaySnapshot) => snapshot.context.error;
export const selectIsLoading = (snapshot: DisplaySnapshot) => snapshot.matches("loading");
export const selectIsReady = (snapshot: DisplaySnapshot) => snapshot.matches("ready");
export const selectHasFailed = (snapshot: DisplaySnapshot) => snapshot.matches("failed");
