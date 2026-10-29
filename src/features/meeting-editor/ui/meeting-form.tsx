import { useSelector } from "@xstate/react";
import { Button, Input } from "@/shared/ui";
import type { MeetingEditorActor } from "../model/editor.machine";
import type { MeetingDraft } from "../model/editor.logic";
import { selectDraft, selectError } from "../model/editor.selectors";

interface MeetingFormProps {
  draft: MeetingDraft;
  error: string | null;
  disabled: boolean;
  editing?: boolean;
  onChange(patch: Partial<MeetingDraft>): void;
  onSubmit(): void;
  onCancel?(): void;
}

export function MeetingForm({
  draft,
  error,
  disabled,
  editing = false,
  onChange,
  onSubmit,
  onCancel,
}: MeetingFormProps) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold">
          {editing ? "Редактирование встречи" : "Новая встреча"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          От 30 минут до 2 часов. Название необязательно.
        </p>
      </div>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="meeting-start" className="text-sm font-medium">
              Начало
            </label>
            <Input
              id="meeting-start"
              type="time"
              min="09:00"
              max="18:00"
              step={60}
              required
              value={draft.start}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "meeting-error" : undefined}
              onChange={(event) => onChange({ start: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="meeting-end" className="text-sm font-medium">
              Окончание
            </label>
            <Input
              id="meeting-end"
              type="time"
              min="09:00"
              max="18:00"
              step={60}
              required
              value={draft.end}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "meeting-error" : undefined}
              onChange={(event) => onChange({ end: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="meeting-title" className="text-sm font-medium">
            Название
          </label>
          <Input
            id="meeting-title"
            placeholder="Например, обсуждение проекта"
            autoComplete="off"
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editing ? "Сохранить изменения" : "Забронировать"}</Button>
          {editing && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Отменить редактирование
            </Button>
          )}
        </div>
      </fieldset>
      {error && (
        <p id="meeting-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export function MeetingEditorView({
  actor,
  ...props
}: Omit<MeetingFormProps, "draft" | "error" | "editing"> & { actor: MeetingEditorActor }) {
  const draft = useSelector(actor, selectDraft);
  const error = useSelector(actor, selectError);
  return <MeetingForm {...props} draft={draft} error={error} editing />;
}
