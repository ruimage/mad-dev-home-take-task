import { useEffect, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { SCHEDULE_SERVICE } from "@/entities/day-schedule";
import { dateSchema } from "@/entities/meeting";
import { MeetingEditorView, MeetingForm, errorMessage } from "@/features/meeting-editor";
import { DEMO_API } from "@/shared/api";
import { readClock } from "@/shared/lib/date-time";
import { useService } from "@/shared/lib/di";
import { inspectStateMachines } from "@/shared/lib/state-inspection";
import { Button, Card, CardContent, Input } from "@/shared/ui";
import { DayScheduleGrid } from "@/widgets/day-schedule";
import { dayScheduleMachine } from "../model/schedule.machine";

function DeleteConfirmation({ onCancel, onConfirm }: { onCancel(): void; onConfirm(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-heading"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id="delete-heading" className="text-lg font-semibold">
        Удалить встречу?
      </h2>
      <p className="my-4 text-sm text-muted-foreground">
        После подтверждения время освободится для других встреч.
      </p>
      <div className="flex gap-2">
        <Button ref={cancel} variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Удалить встречу
        </Button>
      </div>
    </dialog>
  );
}

export function HomePage() {
  const service = useService(SCHEDULE_SERVICE);
  const demo = useService(DEMO_API);
  const [snapshot, send] = useMachine(dayScheduleMachine, {
    input: { service, now: readClock() },
    inspect: process.env.NODE_ENV === "development" ? inspectStateMachines : undefined,
  });
  const context = snapshot.context;
  const editor = snapshot.children.meetingEditor;
  const busy = snapshot.matches("saving") || snapshot.matches("refreshing");
  const ready = snapshot.matches("ready");
  const editing = context.editorId !== null;
  const creating = snapshot.matches({ ready: "creating" });
  const validDate = dateSchema.safeParse(context.date).success;
  const meetings = context.optimistic?.toMeetings() ?? [];
  const pastDate = context.date < context.now.date;
  const dayFinished = context.date === context.now.date && context.now.minute >= 1050;
  const [demoMessage, setDemoMessage] = useState("");
  const [armingDemo, setArmingDemo] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    const update = () => send({ type: "clock.changed", now: readClock() });
    const timer = window.setInterval(update, 1_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [send]);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
      else heading.current?.focus();
    }
    wasBusy.current = busy;
  }, [busy]);
  function submit() {
    send({ type: "clock.changed", now: readClock() });
    send({ type: "meeting.save.requested" });
  }
  async function armConflict() {
    setArmingDemo(true);
    try {
      await demo.armConflict();
      setDemoMessage("Конфликт подготовлен: следующее создание свободного интервала вернёт 409.");
    } catch (error) {
      setDemoMessage(errorMessage(error));
    } finally {
      setArmingDemo(false);
    }
  }
  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 px-4 py-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Одна комната · один рабочий день
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Бронирование переговорной
        </h1>
        <p className="text-sm text-muted-foreground">
          Выберите день и свободное время. Рабочие часы: 09:00–18:00.
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="text-sm">
        {snapshot.matches("loading") && <p role="status">Загрузка расписания…</p>}
        {snapshot.matches("saving") && <p role="status">Сохраняем изменение…</p>}
        {snapshot.matches("refreshing") && <p role="status">Обновляем расписание…</p>}
        {ready && context.notice && <p>{context.notice}</p>}
      </div>
      {context.loadError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {context.loadError}
        </div>
      )}
      {(snapshot.matches("loadFailed") || snapshot.matches("refreshFailed")) && (
        <Button variant="outline" onClick={() => send({ type: "schedule.load.retry" })}>
          Повторить загрузку
        </Button>
      )}
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {context.optimistic && (
            <div className="flex items-baseline justify-between">
              <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
                Расписание дня
              </h2>
              <span className="text-sm text-muted-foreground">Встреч: {meetings.length}</span>
            </div>
          )}
          {context.optimistic && (
            <DayScheduleGrid
              schedule={context.optimistic}
              now={context.now}
              selectedId={context.editorId}
              pendingId={
                context.pending && context.pending.type !== "delete"
                  ? context.pending.meeting.id
                  : null
              }
              canManage={creating}
              onEdit={(meetingId, trigger) => {
                restoreFocus.current = trigger;
                send({ type: "clock.changed", now: readClock() });
                send({ type: "meeting.edit.requested", meetingId });
              }}
              onDelete={(meetingId, trigger) => {
                restoreFocus.current = trigger;
                send({ type: "clock.changed", now: readClock() });
                send({ type: "meeting.delete.requested", meetingId });
              }}
            />
          )}
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-3 border-b pb-5">
              <div className="space-y-2">
                <label htmlFor="booking-date" className="text-sm font-medium">
                  Дата
                </label>
                <Input
                  className="w-full"
                  id="booking-date"
                  type="date"
                  value={context.date}
                  disabled={busy}
                  onChange={(event) =>
                    send({ type: "schedule.date.selected", date: event.target.value })
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {validDate
                  ? new Intl.DateTimeFormat("ru-RU", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date(`${context.date}T12:00:00`))
                  : "Выберите дату"}
              </p>
            </div>

            {context.optimistic &&
              (editing && editor ? (
                <MeetingEditorView
                  key={context.editorId}
                  actor={editor}
                  disabled={!ready}
                  onChange={(patch) => send({ type: "meeting.draft.changed", patch })}
                  onSubmit={submit}
                  onCancel={() => {
                    send({ type: "meeting.edit.cancelled" });
                    requestAnimationFrame(() => restoreFocus.current?.focus());
                  }}
                />
              ) : (
                <>
                  {(pastDate || dayFinished) && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      {pastDate
                        ? "Прошедшая дата — доступен только просмотр."
                        : "На сегодня больше нет времени для новой встречи."}
                    </p>
                  )}
                  <MeetingForm
                    draft={context.creationDraft}
                    error={context.error}
                    disabled={!creating || pastDate || dayFinished}
                    onChange={(patch) => send({ type: "meeting.draft.changed", patch })}
                    onSubmit={submit}
                  />
                </>
              ))}
          </CardContent>
        </Card>
      </div>
      {snapshot.matches({ ready: "confirmingDelete" }) && (
        <DeleteConfirmation
          onCancel={() => send({ type: "meeting.delete.cancelled" })}
          onConfirm={() => {
            send({ type: "clock.changed", now: readClock() });
            send({ type: "meeting.delete.confirmed" });
          }}
        />
      )}
      <footer className="space-y-3 border-t pt-5 text-xs text-muted-foreground">
        <p>Демо: данные хранятся в памяти вкладки и сбрасываются при перезагрузке.</p>
        <details>
          <summary className="cursor-pointer">Проверить серверный конфликт</summary>
          <div className="mt-3 space-y-2">
            <p>Подготовьте конфликт и попробуйте создать встречу в свободное время.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={!creating || armingDemo}
              onClick={() => void armConflict()}
            >
              Смоделировать конфликт
            </Button>
            <p role="status">{demoMessage}</p>
          </div>
        </details>
      </footer>
    </section>
  );
}
