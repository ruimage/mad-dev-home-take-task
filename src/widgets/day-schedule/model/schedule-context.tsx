import { useEffect, type ReactNode } from "react";
import { createActorContext } from "@xstate/react";
import { SCHEDULE_SERVICE } from "@/entities/day-schedule";
import { readClock } from "@/shared/lib/date-time";
import { useService } from "@/shared/lib/di";
import { inspectStateMachines } from "@/shared/lib/state-inspection";
import { dayScheduleMachine } from "./schedule.machine";

export const ScheduleContext = createActorContext(dayScheduleMachine);

function ScheduleClock() {
  const actor = ScheduleContext.useActorRef();
  useEffect(() => {
    const update = () => actor.send({ type: "clock.changed", now: readClock() });
    update();
    const timer = window.setInterval(update, 1_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [actor]);
  return null;
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const service = useService(SCHEDULE_SERVICE);
  return (
    <ScheduleContext.Provider
      options={{
        input: { service, now: readClock() },
        inspect: process.env.NODE_ENV === "development" ? inspectStateMachines : undefined,
      }}
    >
      <ScheduleClock />
      {children}
    </ScheduleContext.Provider>
  );
}
