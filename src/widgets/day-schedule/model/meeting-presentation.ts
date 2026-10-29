import { isFutureMeeting, meetingStatus, type Meeting } from "@/entities/meeting";
import { formatMinute, type ClockTime } from "@/shared/lib/date-time";

interface MeetingPresentationState {
  pending?: boolean;
  canManage?: boolean;
  hasActions?: boolean;
}

export function getMeetingPresentation(
  meeting: Meeting,
  now: ClockTime,
  state: MeetingPresentationState = {},
) {
  const future = isFutureMeeting(meeting, now);
  return {
    future,
    title: meeting.title || "Встреча без названия",
    timeLabel: `${formatMinute(meeting.start)}–${formatMinute(meeting.end)}`,
    statusLabel: state.pending ? "Сохраняется…" : meetingStatus(meeting, now),
    showActions: future && Boolean(state.hasActions),
    actionsDisabled: !state.canManage,
  };
}
