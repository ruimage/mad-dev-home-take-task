import { useState } from "react";
import { errorMessage } from "@/features/meeting-editor";
import { DEMO_API } from "@/shared/api";
import { useService } from "@/shared/lib/di";
import { Button } from "@/shared/ui";
import { ScheduleContext, scheduleSelectors } from "@/widgets/day-schedule";

export function HomePageFooter() {
  const demo = useService(DEMO_API);
  const creating = ScheduleContext.useSelector(scheduleSelectors.selectIsCreating);
  const [demoMessage, setDemoMessage] = useState("");
  const [armingDemo, setArmingDemo] = useState(false);

  async function armConflict() {
    setArmingDemo(true);
    try {
      await demo.armConflict();
      setDemoMessage("Конфликт подготовлен: следующее создание свободного интервала вернёт 409.");
    } catch (cause) {
      setDemoMessage(errorMessage(cause));
    } finally {
      setArmingDemo(false);
    }
  }
  return (
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
  );
}
