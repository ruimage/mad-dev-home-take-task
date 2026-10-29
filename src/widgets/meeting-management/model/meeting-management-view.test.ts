import { expect, test } from "bun:test";
import { getMeetingManagementView } from "./meeting-management-view";

const input = {
  date: "2030-01-15",
  now: { date: "2030-01-15", minute: 480 },
  hasSchedule: true,
  editing: false,
  hasEditor: true,
  creating: true,
};

test.each([
  [false, false, true, false, false],
  [true, false, true, false, true],
  [true, true, true, true, false],
  [true, true, false, false, true],
])(
  "form visibility: loaded=%s editing=%s actor=%s",
  (hasSchedule, editing, hasEditor, showEditor, showCreationForm) => {
    const view = getMeetingManagementView({ ...input, hasSchedule, editing, hasEditor });
    expect(view.showEditor).toBe(showEditor);
    expect(view.showCreationForm).toBe(showCreationForm);
  },
);

test("past dates are read-only with the past-date notice", () => {
  const view = getMeetingManagementView({ ...input, date: "2030-01-14" });
  expect(view.creationDisabled).toBe(true);
  expect(view.creationNotice).toBe("Прошедшая дата — доступен только просмотр.");
});

test.each([
  [1049.99, false],
  [1050, true],
  [1080, true],
])("today's creation cutoff at minute %f", (minute, disabled) => {
  const view = getMeetingManagementView({ ...input, now: { ...input.now, minute } });
  expect(view.creationDisabled).toBe(disabled);
  expect(view.creationNotice).toBe(
    disabled ? "На сегодня больше нет времени для новой встречи." : null,
  );
});

test("future dates are available even after today's working hours", () => {
  const view = getMeetingManagementView({
    ...input,
    date: "2030-01-16",
    now: { ...input.now, minute: 1200 },
  });
  expect(view.creationDisabled).toBe(false);
  expect(view.creationNotice).toBeNull();
});

test("saving or refreshing disables creation without a date restriction notice", () => {
  const view = getMeetingManagementView({ ...input, creating: false });
  expect(view.creationDisabled).toBe(true);
  expect(view.creationNotice).toBeNull();
});

test("invalid dates produce a selection prompt", () => {
  expect(getMeetingManagementView({ ...input, date: "" }).dateLabel).toBe("Выберите дату");
});
