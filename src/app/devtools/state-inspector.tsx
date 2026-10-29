import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  formatInspection,
  getMachineInspections,
  subscribeToMachines,
} from "@/shared/lib/state-inspection";
import { connectStatelyInspector, openStatelyInspector } from "./stately-inspector";

function StateInspector() {
  const machines = useSyncExternalStore(
    subscribeToMachines,
    getMachineInspections,
    getMachineInspections,
  );
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState("daySchedule");
  const [popupBlocked, setPopupBlocked] = useState(false);
  const selected = machines.find((machine) => machine.id === selectedId) ?? machines[0];
  return (
    <aside aria-label="Инспектор XState" className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            XState Inspector <span className="text-xs text-muted-foreground">DEV · локальный</span>
          </h2>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            aria-expanded={expanded}
            aria-controls="state-inspector-content"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Свернуть инспектор" : "Развернуть инспектор"}
          </button>
        </div>
        {expanded && (
          <div id="state-inspector-content" className="min-w-0 space-y-4">
            <div className="space-y-2">
              <button
                type="button"
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setPopupBlocked(!openStatelyInspector())}
              >
                Открыть Stately Inspector
              </button>
              {popupBlocked && (
                <p role="alert" className="text-sm text-destructive">
                  Разрешите всплывающие окна для localhost и повторите открытие инспектора.
                </p>
              )}
            </div>
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label htmlFor="inspected-machine">Машина</label>
                  <select
                    id="inspected-machine"
                    className="max-w-full rounded border bg-background px-2 py-1"
                    value={selected.id}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.id}
                      </option>
                    ))}
                  </select>
                  <span>Статус: {selected.status}</span>
                </div>
                <p className="break-words text-sm">
                  Состояние:{" "}
                  <code aria-label="Текущее состояние машины">
                    {JSON.stringify(selected.state)}
                  </code>
                </p>
                <pre
                  tabIndex={0}
                  aria-label="Context машины"
                  className="max-h-96 max-w-full overflow-auto rounded-lg border bg-background p-3 text-xs leading-relaxed"
                >
                  {formatInspection(selected.context)}
                </pre>
                <details className="text-sm">
                  <summary className="cursor-pointer">
                    Последние события ({selected.events.length})
                  </summary>
                  <pre
                    tabIndex={0}
                    aria-label="События машины"
                    className="mt-3 max-h-64 max-w-full overflow-auto rounded-lg border bg-background p-3 text-xs"
                  >
                    {formatInspection(selected.events)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ожидаем запуска машин…</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function mountStateInspector(): void {
  connectStatelyInspector();
  if (document.getElementById("state-inspector")) return;
  const host = document.createElement("div");
  host.id = "state-inspector";
  document.body.append(host);
  createRoot(host).render(<StateInspector />);
}
