import { formatMinute } from "@/shared/lib/date-time";
import { timeTicks, type GridSettings } from "../model/grid-layout";

export function TimeTicks({ settings }: { settings: GridSettings }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {timeTicks(settings).map((tick) => (
        <div
          key={tick.minute}
          data-tick-kind={tick.kind}
          data-tick-minute={tick.minute}
          className="absolute inset-x-0"
          style={{ top: tick.top }}
        >
          {tick.kind === "hour" && (
            <time
              className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs font-medium tabular-nums text-muted-foreground"
              dateTime={formatMinute(tick.minute)}
            >
              {formatMinute(tick.minute)}
            </time>
          )}
          <span
            data-tick-line
            className={`absolute block ${tick.kind === "hour" ? "inset-x-0 border-t-2 border-border" : tick.kind === "half" ? "-left-2 w-4 border-t-2 border-muted-foreground/60" : "-left-1 w-2 border-t border-muted-foreground/40"}`}
          />
        </div>
      ))}
    </div>
  );
}
