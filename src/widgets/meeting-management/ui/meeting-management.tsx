import { DeleteMeeting } from "@/features/delete-meeting";
import { MeetingEditorView, MeetingForm, type MeetingDraft } from "@/features/meeting-editor";
import { readClock } from "@/shared/lib/date-time";
import { Card, CardContent, Input } from "@/shared/ui";
import { ScheduleContext } from "@/widgets/day-schedule";
import { useMeetingManagementView } from "../model/use-meeting-management-view";

export function MeetingManagement() {
  const { send } = ScheduleContext.useActorRef();
  const view = useMeetingManagementView();

  function onDraftChange(patch: Partial<MeetingDraft>) {
    send({ type: "meeting.draft.changed", patch });
  }
  function onSubmit() {
    send({ type: "clock.changed", now: readClock() });
    send({ type: "meeting.save.requested" });
  }
  function onCancelEdit() {
    send({ type: "meeting.edit.cancelled" });
  }

  return (
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
              value={view.scheduleData.date}
              disabled={view.scheduleData.busy}
              onChange={(event) =>
                send({ type: "schedule.date.selected", date: event.target.value })
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">{view.dateLabel}</p>
        </div>

        {view.editorActor && (
          <MeetingEditorView
            key={view.scheduleData.editorId}
            actor={view.editorActor}
            disabled={!view.scheduleData.ready}
            onChange={onDraftChange}
            onSubmit={onSubmit}
            onCancel={onCancelEdit}
          />
        )}
        {view.showCreationForm && (
          <>
            {view.creationNotice && (
              <p className="mb-4 text-sm text-muted-foreground">{view.creationNotice}</p>
            )}
            <MeetingForm
              draft={view.scheduleData.draft}
              error={view.scheduleData.error}
              disabled={view.creationDisabled}
              onChange={onDraftChange}
              onSubmit={onSubmit}
            />
          </>
        )}
      </CardContent>
      <DeleteMeeting />
    </Card>
  );
}
