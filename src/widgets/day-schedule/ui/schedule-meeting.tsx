import type { Meeting } from "@/entities/meeting";
import type { ClockTime } from "@/shared/lib/date-time";
import { Button } from "@/shared/ui";
import type { meetingGridLayout } from "../model/grid-layout";
import { getMeetingPresentation } from "../model/meeting-presentation";

export interface ScheduleMeetingProps {
  meeting: Meeting;
  layout: ReturnType<typeof meetingGridLayout>;
  now: ClockTime;
  selected?: boolean;
  pending?: boolean;
  canManage?: boolean;
  onEdit?(id: string): void;
  onDelete?(id: string): void;
}

/** Positioned relative to its minimum-slot row, not snapped to that row's start. */
export function ScheduleMeeting({
  meeting,
  layout,
  now,
  selected = false,
  pending = false,
  canManage = false,
  onEdit,
  onDelete,
}: ScheduleMeetingProps) {
  const view = getMeetingPresentation(meeting, now, {
    pending,
    canManage,
    hasActions: Boolean(onEdit && onDelete),
  });
  return (
    <div
      data-meeting-id={meeting.id}
      data-anchor-minute={layout.anchorMinute}
      className={`absolute inset-x-1 top-0 py-px ${selected ? "z-20" : "z-10"}`}
      style={{ height: layout.height, transform: `translateY(${layout.translateY}px)` }}
    >
      <article
        aria-label={view.title}
        className={`flex h-full min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-l-[3px] bg-background px-2 py-2 shadow-sm ${selected ? "border-foreground" : view.future ? "border-l-foreground/70" : "border-l-muted-foreground/40 bg-muted/90"}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-sm font-semibold tabular-nums">{view.timeLabel}</p>
          <span className="text-[10px] text-muted-foreground">{view.statusLabel}</span>
        </div>
        <h3 className="truncate text-xs" title={view.title}>
          {view.title}
        </h3>
        {view.showActions && (
          <div className="mt-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              disabled={view.actionsDisabled}
              onClick={() => onEdit?.(meeting.id)}
            >
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={view.actionsDisabled}
              onClick={() => onDelete?.(meeting.id)}
            >
              Удалить
            </Button>
          </div>
        )}
      </article>
    </div>
  );
}
