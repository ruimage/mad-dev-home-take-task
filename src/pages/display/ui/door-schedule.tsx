import { useEffect } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { SCHEDULE_SERVICE } from "@/entities/day-schedule";
import { formatCalendarDate, readClock } from "@/shared/lib/date-time";
import { useService } from "@/shared/lib/di";
import { Button } from "@/shared/ui";
import { DayScheduleGrid } from "@/widgets/day-schedule";
import { displayMachine } from "../model/display.machine";
import {
  selectNow,
  selectSchedule,
  selectError,
  selectIsLoading,
} from "../model/display.selectors";

export function DoorSchedule() {
  const service = useService(SCHEDULE_SERVICE);
  const actor = useActorRef(displayMachine, { input: { service, now: readClock() } });
  const { send } = actor;
  const now = useSelector(actor, selectNow);
  const schedule = useSelector(actor, selectSchedule);
  const error = useSelector(actor, selectError);
  const loading = useSelector(actor, selectIsLoading);
  useEffect(() => {
    const tick = () => send({ type: "clock.changed", now: readClock() });
    const refresh = () => {
      tick();
      send({ type: "schedule.refresh.requested" });
    };
    const timer = window.setInterval(tick, 1_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [send]);
  return (
    <section className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Переговорная</h1>
        <time dateTime={now.date} className="text-sm text-muted-foreground sm:text-base">
          {formatCalendarDate(now.date)}
        </time>
      </header>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <p>
            {error} {schedule && "Показаны последние загруженные данные."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => send({ type: "schedule.refresh.requested" })}
          >
            Повторить загрузку
          </Button>
        </div>
      )}
      {!schedule && loading && <p role="status">Загрузка расписания…</p>}
      {schedule && (
        <DayScheduleGrid
          schedule={schedule}
          now={now}
          className="flex h-full min-h-0 flex-col gap-3"
          viewportClassName="min-h-0 flex-1"
        />
      )}
    </section>
  );
}
