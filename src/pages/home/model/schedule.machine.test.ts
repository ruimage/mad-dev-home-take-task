import { expect, test } from "bun:test";
import { createActor, waitFor } from "xstate";
import { DaySchedule, ScheduleService, type ScheduleOperation } from "@/entities/day-schedule";
import { MeetingService, type Meeting } from "@/entities/meeting";
import { ApiError, FetchHttpClient } from "@/shared/api";
import { dayScheduleMachine } from "./schedule.machine";

const date = "2030-01-15";
const meeting: Meeting = { id: "A", date, start: 720, end: 780, title: "Original" };

class TestService extends ScheduleService {
  constructor(
    readonly loadFn: (selectedDate: string) => Promise<DaySchedule>,
    readonly saveFn: (operation: ScheduleOperation) => Promise<Meeting | null>,
  ) {
    super(new MeetingService(new FetchHttpClient()));
  }
  override load(selectedDate: string) {
    return this.loadFn(selectedDate);
  }
  override save(operation: ScheduleOperation) {
    return this.saveFn(operation);
  }
}

test("editor survives a 409 and receives new slots without losing its draft", async () => {
  let loads = 0;
  const service = new TestService(
    async () =>
      new DaySchedule(
        date,
        ++loads === 1 ? [meeting] : [meeting, { ...meeting, id: "B", start: 780, end: 840 }],
      ),
    async () => {
      throw new ApiError("Conflict", { status: 409 });
    },
  );
  const actor = createActor(dayScheduleMachine, {
    input: { service, now: { date, minute: 480 } },
  }).start();
  try {
    await waitFor(actor, (state) => state.matches("ready"));
    const editor = actor.getSnapshot().children.meetingEditor;
    actor.send({ type: "meeting.edit.requested", meetingId: "A" });
    actor.send({
      type: "meeting.draft.changed",
      patch: { start: "13:00", end: "14:00", title: "Keep me" },
    });
    actor.send({ type: "meeting.save.requested" });
    expect(actor.getSnapshot().context.optimistic?.data.slots[780]).toBe("A");
    await waitFor(actor, (state) => state.matches("ready") && state.context.error !== null);
    expect(actor.getSnapshot().children.meetingEditor).toBe(editor);
    expect(editor?.getSnapshot().value).toBe("conflict");
    expect(editor?.getSnapshot().context.draft.title).toBe("Keep me");
    expect(actor.getSnapshot().context.optimistic?.data.slots[780]).toBe("B");
    actor.send({ type: "meeting.save.requested" });
    expect(editor?.getSnapshot().context.error).toContain("занято");
  } finally {
    actor.stop();
  }
});

test("retry after a successful write and failed refresh only repeats GET", async () => {
  let loads = 0;
  let saves = 0;
  const service = new TestService(
    async () => {
      if (++loads === 2) throw new Error("Refresh unavailable");
      return new DaySchedule(date, saves ? [{ id: "server", date, start: 540, end: 570 }] : []);
    },
    async (operation) => {
      saves++;
      return operation.type === "delete" ? null : { ...operation.meeting, id: "server" };
    },
  );
  const actor = createActor(dayScheduleMachine, {
    input: { service, now: { date, minute: 480 } },
  }).start();
  try {
    await waitFor(actor, (state) => state.matches("ready"));
    actor.send({ type: "meeting.save.requested" });
    await waitFor(actor, (state) => state.matches("refreshFailed"));
    expect(actor.getSnapshot().context.confirmed?.data.meetingsById.has("server")).toBe(true);
    actor.send({ type: "schedule.load.retry" });
    await waitFor(actor, (state) => state.matches("ready"));
    expect(saves).toBe(1);
    expect(loads).toBe(3);
    expect(actor.getSnapshot().context.loadError).toBeNull();
  } finally {
    actor.stop();
  }
});

test("late response from an old date is ignored", async () => {
  let resolveFirst!: (schedule: DaySchedule) => void;
  const first = new Promise<DaySchedule>((resolve) => {
    resolveFirst = resolve;
  });
  const service = new TestService(
    (value) => (value === date ? first : Promise.resolve(new DaySchedule(value))),
    async () => null,
  );
  const actor = createActor(dayScheduleMachine, {
    input: { service, now: { date, minute: 480 } },
  }).start();
  try {
    actor.send({ type: "schedule.date.selected", date: "2030-01-16" });
    await waitFor(actor, (state) => state.matches("ready"));
    resolveFirst(new DaySchedule(date, [meeting]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(actor.getSnapshot().context.optimistic?.data.date).toBe("2030-01-16");
    expect(actor.getSnapshot().context.optimistic?.toMeetings()).toEqual([]);
    actor.send({ type: "schedule.date.selected", date: "" });
    expect(actor.getSnapshot().matches("selectingDate")).toBe(true);
  } finally {
    actor.stop();
  }
});
