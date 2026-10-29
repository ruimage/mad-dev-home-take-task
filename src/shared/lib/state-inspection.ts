import type { InspectionEvent } from "xstate";

export interface MachineInspection {
  id: string;
  state: unknown;
  context: unknown;
  status: string;
  events: readonly { type: string; payload: unknown }[];
}

const machines = new Map<string, MachineInspection>();
const listeners = new Set<() => void>();
const inspectionObservers = new Set<(event: InspectionEvent) => void>();
let snapshot: readonly MachineInspection[] = [];
let notificationQueued = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** Attach to the root actor; XState forwards inspections of its children too. */
export function inspectStateMachines(event: InspectionEvent): void {
  for (const observer of inspectionObservers) observer(event);
  if (event.type !== "@xstate.snapshot") return;
  const value = event.snapshot;
  if (!isRecord(value) || !("context" in value) || !("value" in value)) return;
  const machine = "machine" in value ? value.machine : undefined;
  const id =
    isRecord(machine) && typeof machine.id === "string" ? machine.id : event.actorRef.sessionId;
  const previous = machines.get(id);
  machines.set(id, {
    id,
    state: value.value,
    context: value.context,
    status: value.status,
    events: [...(previous?.events ?? []), { type: event.event.type, payload: event.event }].slice(
      -40,
    ),
  });
  snapshot = [...machines.values()];
  // Inspection can happen while React creates an actor during render.
  // Notify the independent devtools root after that render, batching bursts.
  if (!notificationQueued) {
    notificationQueued = true;
    queueMicrotask(() => {
      notificationQueued = false;
      for (const listener of listeners) listener();
    });
  }
}

export function subscribeToInspections(observer: (event: InspectionEvent) => void): () => void {
  inspectionObservers.add(observer);
  return () => {
    inspectionObservers.delete(observer);
  };
}

export function subscribeToMachines(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMachineInspections(): readonly MachineInspection[] {
  return snapshot;
}

export function formatInspection(value: unknown): string {
  try {
    return (
      JSON.stringify(
        value,
        (key, item: unknown) => {
          if (key === "service") return "[API service]";
          if (item instanceof Map) return Object.fromEntries(item);
          if (item instanceof Error) return { name: item.name, message: item.message };
          if (typeof item === "function") return "[Function]";
          return item;
        },
        2,
      ) ?? "undefined"
    );
  } catch {
    return "Не удалось сериализовать context: обнаружена циклическая ссылка";
  }
}
