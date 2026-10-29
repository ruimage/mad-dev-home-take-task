import { useLayoutEffect, useRef } from "react";
import type { DaySchedule } from "@/entities/day-schedule";
import { formatMinute, type ClockTime } from "@/shared/lib/date-time";
import { currentTimeOffset, gridRows, meetingGridLayout, timeTicks } from "../model/grid-layout";
import { ScheduleMeeting } from "./schedule-meeting";

interface DayScheduleGridProps {
  schedule: DaySchedule;
  now: ClockTime;
  selectedId: string | null;
  pendingId: string | null;
  canManage: boolean;
  onEdit(id: string, trigger: HTMLButtonElement): void;
  onDelete(id: string, trigger: HTMLButtonElement): void;
}

export function DayScheduleGrid({
  schedule,
  now,
  selectedId,
  pendingId,
  canManage,
  onEdit,
  onDelete,
}: DayScheduleGridProps) {
  const rows = gridRows(schedule.data);
  const nowOffset = currentTimeOffset(schedule.data.date, now, schedule.data);
  const hasCurrentTime = nowOffset !== null;
  const date = schedule.data.date;
  const scrollArea = useRef<HTMLDivElement>(null);
  const currentTimeLine = useRef<HTMLDivElement>(null);
  const centeredDate = useRef<string | null>(null);
  const previousPadding = useRef(0);
  useLayoutEffect(() => {
    const viewport = scrollArea.current;
    if (!viewport) return;
    function positionInitially() {
      if (!viewport || viewport.clientHeight === 0) return;
      // Padding permits exact centering even at the start and end of the day.
      const padding = hasCurrentTime ? viewport.clientHeight / 2 : 0;
      const delta = padding - previousPadding.current;
      const previousScroll = viewport.scrollTop;
      viewport.style.setProperty("--schedule-scroll-padding", `${padding}px`);
      previousPadding.current = padding;
      if (centeredDate.current === date) {
        if (delta !== 0) viewport.scrollTop = previousScroll + delta;
        return;
      }
      const line = currentTimeLine.current;
      if (!line) return;
      const lineBounds = line.getBoundingClientRect();
      const viewportCenter =
        viewport.getBoundingClientRect().top + viewport.clientTop + viewport.clientHeight / 2;
      viewport.scrollTop += lineBounds.top + lineBounds.height / 2 - viewportCenter;
      centeredDate.current = date;
    }
    positionInitially();
    const observer = new ResizeObserver(positionInitially);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [date, hasCurrentTime]);
  const currentTimeLabel = formatMinute(Math.floor(now.minute));
  const meetings = schedule
    .toMeetings()
    .map((meeting) => ({ meeting, layout: meetingGridLayout(meeting, schedule.data) }));
  return (
    <div className="space-y-3">
      {meetings.length === 0 && (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          На этот день бронирований нет
        </p>
      )}
      <div
        ref={scrollArea}
        role="region"
        aria-label="Временная сетка расписания"
        tabIndex={0}
        className="max-h-[42rem] overflow-y-auto rounded-xl border bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div style={{ paddingBlock: hasCurrentTime ? "var(--schedule-scroll-padding, 0px)" : 0 }}>
          <div data-testid="schedule-grid-canvas" className="relative my-4 ml-14 mr-3">
            <div
              className="grid"
              style={{ gridTemplateRows: rows.map((row) => `${row.height}px`).join(" ") }}
            >
              {rows.map((row, index) => (
                <div key={row.minute} data-slot-start={row.minute} className="relative">
                  {meetings
                    .filter(({ layout }) => layout.anchorIndex === index)
                    .map(({ meeting, layout }) => (
                      <ScheduleMeeting
                        key={meeting.id}
                        meeting={meeting}
                        layout={layout}
                        now={now}
                        selected={selectedId === meeting.id}
                        pending={pendingId === meeting.id}
                        canManage={canManage}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                </div>
              ))}
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {timeTicks(schedule.data).map((tick) => (
                <div
                  key={tick.minute}
                  data-tick-kind={tick.kind}
                  data-tick-minute={tick.minute}
                  className="absolute inset-x-0"
                  style={{ top: tick.top }}
                >
                  {tick.kind === "hour" && (
                    <time
                      className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs font-medium tabular-nums text-muted-foreground"
                      dateTime={formatMinute(tick.minute)}
                    >
                      {formatMinute(tick.minute)}
                    </time>
                  )}
                  <span
                    data-tick-line
                    className={`absolute block ${tick.kind === "hour" ? "inset-x-0 border-t-2 border-border" : tick.kind === "half" ? "-left-2 w-4 border-t-2 border-muted-foreground/60" : "-left-1 w-2 border-t border-muted-foreground/40"}`}
                  />
                </div>
              ))}
            </div>
            {nowOffset !== null && (
              <div
                ref={currentTimeLine}
                role="separator"
                aria-orientation="horizontal"
                aria-label={`Текущее время ${currentTimeLabel}`}
                data-testid="current-time-indicator"
                className="pointer-events-none absolute -left-12 right-0 z-40 h-0.5 -translate-y-1/2 bg-rose-400/60 dark:bg-rose-400/50"
                style={{ top: nowOffset }}
              >
                <time
                  dateTime={currentTimeLabel}
                  className="absolute left-0 top-1/2 w-10 -translate-y-1/2 rounded bg-rose-50 py-0.5 text-center text-[10px] font-medium tabular-nums text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                >
                  {currentTimeLabel}
                </time>
                <span
                  aria-hidden="true"
                  className="absolute left-12 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400/80 dark:bg-rose-400/60"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
