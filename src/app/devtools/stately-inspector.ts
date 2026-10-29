import { createBrowserInspector, type StatelyInspectionEvent } from "@statelyai/inspect";
import { formatInspection, subscribeToInspections } from "@/shared/lib/state-inspection";

let inspector: ReturnType<typeof createBrowserInspector> | undefined;

function plainContext(context: unknown): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(formatInspection(context));
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function serializeInspection(event: StatelyInspectionEvent): StatelyInspectionEvent {
  // The default SDK serializer temporarily mutates objects when limiting depth.
  // Keep only public snapshot data, excluding actor refs and machine internals.
  const value =
    event.type === "@xstate.event"
      ? event
      : {
          ...event,
          snapshot: {
            status: event.snapshot.status,
            ...("context" in event.snapshot ? { context: event.snapshot.context } : {}),
            ...("value" in event.snapshot ? { value: event.snapshot.value } : {}),
            ...("output" in event.snapshot ? { output: event.snapshot.output } : {}),
          },
        };
  return JSON.parse(formatInspection(value)) as StatelyInspectionEvent;
}

/** Connect before actors start; the SDK buffers events until its window is opened. */
export function connectStatelyInspector(): void {
  if (inspector) return;
  const instance = createBrowserInspector({
    autoStart: false,
    maxDeferredEvents: 200,
    sanitizeContext: plainContext,
    serialize: serializeInspection,
  });
  inspector = instance;
  subscribeToInspections((event) => {
    // Convert Map before the SDK's snapshot serialization can turn it into {}.
    const inspected =
      event.type === "@xstate.snapshot" && "context" in event.snapshot
        ? {
            ...event,
            snapshot: { ...event.snapshot, context: plainContext(event.snapshot.context) },
          }
        : event;
    instance.inspect.next?.(inspected);
  });
}

export function openStatelyInspector(): boolean {
  if (!inspector) return false;
  const existingWindow = inspector.adapter.targetWindow;
  if (!existingWindow || existingWindow.closed) inspector.start();
  return inspector.adapter.targetWindow !== null;
}
