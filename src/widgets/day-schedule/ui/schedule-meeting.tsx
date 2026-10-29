import { isFutureMeeting, meetingStatus, type Meeting } from "@/entities/meeting";
import { formatMinute, type ClockTime } from "@/shared/lib/date-time";
import { Button } from "@/shared/ui";
import type { meetingGridLayout } from "../model/grid-layout";

export interface ScheduleMeetingProps {
  meeting: Meeting;
  layout: ReturnType<typeof meetingGridLayout>;
  now: ClockTime;
  selected: boolean;
  pending: boolean;
  canManage: boolean;
  displayOnly?: boolean;
  onEdit?(id: string, trigger: HTMLButtonElement): void;
  onDelete?(id: string, trigger: HTMLButtonElement): void;
}

/** Positioned relative to its minimum-slot row, not snapped to that row's start. */
export function ScheduleMeeting({
  meeting,
  layout,
  now,
  selected,
  pending,
  canManage,
  displayOnly = false,
  onEdit,
  onDelete,
}: ScheduleMeetingProps) {
  const future = isFutureMeeting(meeting, now);
  return (
    <div
      data-meeting-id={meeting.id}
      data-anchor-minute={layout.anchorMinute}
      className={`absolute inset-x-1 top-0 py-px ${selected ? "z-20" : "z-10"}`}
      style={{ height: layout.height, transform: `translateY(${layout.translateY}px)` }}
    >
      <article
        aria-label={meeting.title || "Встреча без названия"}
        className={`flex h-full min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-l-[3px] bg-background px-2 py-2 shadow-sm ${selected ? "border-foreground" : future ? "border-l-foreground/70" : "border-l-muted-foreground/40 bg-muted/90"}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-sm font-semibold tabular-nums">
            {formatMinute(meeting.start)}–{formatMinute(meeting.end)}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {pending ? "Сохраняется…" : meetingStatus(meeting, now)}
          </span>
        </div>
        <h3 className="truncate text-xs" title={meeting.title || "Встреча без названия"}>
          {meeting.title || "Встреча без названия"}
        </h3>
        {future && !displayOnly && (
          <div className="mt-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              disabled={!canManage}
              onClick={(event) => onEdit?.(meeting.id, event.currentTarget)}
            >
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={!canManage}
              onClick={(event) => onDelete?.(meeting.id, event.currentTarget)}
            >
              Удалить
            </Button>
          </div>
        )}
      </article>
    </div>
  );
}
