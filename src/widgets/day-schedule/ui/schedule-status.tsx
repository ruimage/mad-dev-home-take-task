import { Button } from "@/shared/ui";
import { ScheduleContext } from "../model/schedule-context";
import { useScheduleData } from "../model/use-schedule-data";

export function ScheduleStatus() {
  const scheduleData = useScheduleData();
  const { send } = ScheduleContext.useActorRef();

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="text-sm">
        {scheduleData.loading && <p role="status">Загрузка расписания…</p>}
        {scheduleData.saving && <p role="status">Сохраняем изменение…</p>}
        {scheduleData.refreshing && <p role="status">Обновляем расписание…</p>}
        {scheduleData.ready && scheduleData.notice && <p>{scheduleData.notice}</p>}
      </div>
      {scheduleData.loadError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {scheduleData.loadError}
        </div>
      )}
      {scheduleData.canRetry && (
        <Button variant="outline" onClick={() => send({ type: "schedule.load.retry" })}>
          Повторить загрузку
        </Button>
      )}
    </>
  );
}
