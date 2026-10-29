import { assign, fromPromise, setup } from "xstate";
import { DaySchedule, type ScheduleService } from "@/entities/day-schedule";
import type { ClockTime } from "@/shared/lib/date-time";

interface DisplayInput {
  service: ScheduleService;
  now: ClockTime;
}
interface DisplayContext extends DisplayInput {
  schedule: DaySchedule | null;
  error: string | null;
}

export const displayMachine = setup({
  types: {
    context: {} as DisplayContext,
    input: {} as DisplayInput,
    events: {} as
      | { type: "clock.changed"; now: ClockTime }
      | { type: "schedule.refresh.requested" },
  },
  actors: {
    loadDay: fromPromise<DaySchedule, { service: ScheduleService; date: string }>(
      // Like the management machine, allow the GET to survive StrictMode rehydration.
      ({ input }) => input.service.load(input.date),
    ),
  },
  guards: {
    dateChanged: ({ context, event }) =>
      event.type === "clock.changed" && context.now.date !== event.now.date,
  },
  actions: {
    updateClock: assign(({ event }) => (event.type === "clock.changed" ? { now: event.now } : {})),
    clearSchedule: assign({ schedule: null, error: null }),
  },
}).createMachine({
  id: "displaySchedule",
  context: ({ input }) => ({ ...input, schedule: null, error: null }),
  initial: "loading",
  on: {
    "clock.changed": [
      {
        guard: "dateChanged",
        target: ".loading",
        reenter: true,
        actions: ["updateClock", "clearSchedule"],
      },
      { actions: "updateClock" },
    ],
  },
  states: {
    loading: {
      invoke: {
        src: "loadDay",
        input: ({ context }) => ({ service: context.service, date: context.now.date }),
        onDone: {
          target: "ready",
          actions: assign(({ event }) => ({ schedule: event.output, error: null })),
        },
        onError: {
          target: "failed",
          actions: assign({ error: "Не удалось обновить расписание. Повторим автоматически." }),
        },
      },
    },
    ready: {
      after: { 30_000: "loading" },
      on: { "schedule.refresh.requested": "loading" },
    },
    failed: {
      after: { 30_000: "loading" },
      on: { "schedule.refresh.requested": "loading" },
    },
  },
});
