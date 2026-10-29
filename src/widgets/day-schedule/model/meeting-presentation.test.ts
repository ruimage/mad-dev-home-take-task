import { expect, test } from "bun:test";
import { getMeetingPresentation } from "./meeting-presentation";

const meeting = { id: "A", date: "2030-01-15", start: 600, end: 660 };
const now = { date: meeting.date, minute: 480 };

test("unnamed meetings have a title and an exact time range", () => {
  expect(getMeetingPresentation(meeting, now)).toMatchObject({
    title: "Встреча без названия",
    timeLabel: "10:00–11:00",
    statusLabel: "Предстоит",
    showActions: false,
  });
});

test.each([
  [599.99, "Предстоит", true],
  [600, "Идёт сейчас", false],
  [659.99, "Идёт сейчас", false],
  [660, "Завершена", false],
])("presentation at minute %f", (minute, statusLabel, showActions) => {
  expect(getMeetingPresentation(meeting, { ...now, minute }, { hasActions: true })).toMatchObject({
    statusLabel,
    showActions,
  });
});

test("pending status takes precedence and actions can remain visible but disabled", () => {
  expect(
    getMeetingPresentation({ ...meeting, title: "Планирование" }, now, {
      pending: true,
      hasActions: true,
      canManage: false,
    }),
  ).toMatchObject({
    title: "Планирование",
    statusLabel: "Сохраняется…",
    showActions: true,
    actionsDisabled: true,
  });
  expect(getMeetingPresentation(meeting, now, { canManage: true }).actionsDisabled).toBe(false);
});
