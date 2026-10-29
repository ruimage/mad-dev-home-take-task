import { Fragment, useRef, type ReactNode } from "react";
import type { DaySchedule } from "@/entities/day-schedule";
import type { Meeting } from "@/entities/meeting";
import { formatMinute, type ClockTime } from "@/shared/lib/date-time";
import { useCenteredScroll } from "@/shared/lib/dom";
import { buildScheduleRows, currentTimeOffset, type meetingGridLayout } from "../model/grid-layout";
import { ScheduleMeeting } from "./schedule-meeting";
import { TimeTicks } from "./time-ticks";

interface DayScheduleGridProps {
  schedule: DaySchedule;
  now: ClockTime;
  className?: string;
  viewportClassName?: string;
  renderMeeting?(meeting: Meeting, layout: ReturnType<typeof meetingGridLayout>): ReactNode;
}

export function DayScheduleGrid({
  schedule,
  now,
  className = "space-y-3",
  viewportClassName = "max-h-[42rem]",
  renderMeeting,
}: DayScheduleGridProps) {
  const scrollArea = useRef<HTMLDivElement>(null);

  const grid = buildScheduleRows(schedule.toMeetings(), schedule.data);
  const nowOffset = currentTimeOffset(schedule.data.date, now, schedule.data);
  const hasCurrentTime = nowOffset !== null;
  const date = schedule.data.date;
  const currentTimeLine = useRef<HTMLDivElement>(null);
  useCenteredScroll({
    viewportRef: scrollArea,
    targetRef: currentTimeLine,
    resetKey: date,
    enabled: hasCurrentTime,
  });
  const currentTimeLabel = formatMinute(Math.floor(now.minute));
  return (
    <div className={className}>
      {grid.meetingCount === 0 && (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          На этот день бронирований нет
        </p>
      )}
      <div
        ref={scrollArea}
        role="region"
        aria-label="Временная сетка расписания"
        tabIndex={0}
        className={`${viewportClassName} overflow-y-auto rounded-xl border bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring`}
      >
        <div style={{ paddingBlock: hasCurrentTime ? "var(--centered-scroll-padding, 0px)" : 0 }}>
          <div data-testid="schedule-grid-canvas" className="relative my-4 ml-14 mr-3">
            <div className="grid" style={{ gridTemplateRows: grid.templateRows }}>
              {grid.rows.map((row) => (
                <div key={row.minute} data-slot-start={row.minute} className="relative">
                  {row.meetings.map(({ meeting, layout }) => (
                    <Fragment key={meeting.id}>
                      {renderMeeting ? (
                        renderMeeting(meeting, layout)
                      ) : (
                        <ScheduleMeeting meeting={meeting} layout={layout} now={now} />
                      )}
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
            <TimeTicks settings={schedule.data} />
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
