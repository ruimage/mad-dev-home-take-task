import { readClock } from "@/shared/lib/date-time";
import { ScheduleContext, scheduleSelectors } from "@/widgets/day-schedule";
import { DeleteConfirmation } from "./delete-confirmation";

export function DeleteMeeting() {
  const { send } = ScheduleContext.useActorRef();
  const open = ScheduleContext.useSelector(scheduleSelectors.selectIsConfirmingDelete);

  return (
    <DeleteConfirmation
      open={open}
      onCancel={() => send({ type: "meeting.delete.cancelled" })}
      onConfirm={() => {
        send({ type: "clock.changed", now: readClock() });
        send({ type: "meeting.delete.confirmed" });
      }}
    />
  );
}
