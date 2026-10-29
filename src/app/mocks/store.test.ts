import { expect, test } from "bun:test";
import { BookingStore } from "./store";

const date = "2030-01-15";
const meeting = { id: "A", date, start: 600, end: 660, title: "First" };

test("only the first competing create wins", () => {
  const store = new BookingStore(() => ({ date, minute: 480 }));
  store.save({ type: "create", meeting });
  expect(() => store.save({ type: "create", meeting: { ...meeting, id: "B" } })).toThrow("занято");
  expect(
    store
      .list(date)
      .toMeetings()
      .filter((value) => value.start === 600),
  ).toHaveLength(1);
});

test("demo conflict creates a real competing meeting and is one-shot", () => {
  const store = new BookingStore(() => ({ date, minute: 480 }));
  store.conflictNextCreate = true;
  expect(() => store.save({ type: "create", meeting })).toThrow("занято");
  expect(store.conflictNextCreate).toBe(false);
  expect(
    store
      .list(date)
      .toMeetings()
      .some((value) => value.title === "Параллельная встреча"),
  ).toBe(true);
  expect(() => store.find("A")).toThrow("не существует");
});

test("mock validates current time again at the actual write", () => {
  let minute = 480;
  const store = new BookingStore(() => ({ date, minute }));
  store.save({ type: "create", meeting });
  minute = 600;
  expect(() => store.save({ type: "delete", meetingId: "A" })).toThrow("просмотра");
  expect(store.find("A")).toEqual(meeting);
});
