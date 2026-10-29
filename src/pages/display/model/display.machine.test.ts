import { expect, test } from "bun:test";
import { createActor, SimulatedClock, waitFor } from "xstate";
import { DaySchedule, ScheduleService } from "@/entities/day-schedule";
import { MeetingService } from "@/entities/meeting";
import { FetchHttpClient } from "@/shared/api";
import { displayMachine } from "./display.machine";

const date = "2030-01-15";
class TestService extends ScheduleService {
  constructor(readonly loadFn: (date: string) => Promise<DaySchedule>) {
    super(new MeetingService(new FetchHttpClient()));
  }
  override load(selectedDate: string) {
    return this.loadFn(selectedDate);
  }
}

test("display refreshes every 30 seconds, retains data on failure and recovers", async () => {
  let loads = 0;
  const service = new TestService(async (day) => {
    if (++loads === 2) throw new Error("Offline");
    return new DaySchedule(day, []);
  });
  const clock = new SimulatedClock();
  const actor = createActor(displayMachine, {
    input: { service, now: { date, minute: 600 } },
    clock,
  }).start();
  try {
    await waitFor(actor, (state) => state.matches("ready"));
    const schedule = actor.getSnapshot().context.schedule;
    clock.increment(30_000);
    await waitFor(actor, (state) => state.matches("failed"));
    expect(actor.getSnapshot().context.schedule).toBe(schedule);
    expect(actor.getSnapshot().context.error).not.toBeNull();
    clock.increment(30_000);
    await waitFor(actor, (state) => state.matches("ready"));
    expect(loads).toBe(3);
    expect(actor.getSnapshot().context.error).toBeNull();
  } finally {
    actor.stop();
  }
});

test("midnight drops yesterday's data and ignores its late response", async () => {
  let finishYesterday!: (value: DaySchedule) => void;
  const service = new TestService((day) =>
    day === date
      ? new Promise((resolve) => {
          finishYesterday = resolve;
        })
      : Promise.resolve(new DaySchedule(day, [])),
  );
  const actor = createActor(displayMachine, {
    input: { service, now: { date, minute: 1439 } },
  }).start();
  try {
    actor.send({ type: "clock.changed", now: { date: "2030-01-16", minute: 0 } });
    expect(actor.getSnapshot().context.schedule).toBeNull();
    await waitFor(actor, (state) => state.matches("ready"));
    finishYesterday(new DaySchedule(date, []));
    await Promise.resolve();
    expect(actor.getSnapshot().context.schedule?.data.date).toBe("2030-01-16");
  } finally {
    actor.stop();
  }
});
