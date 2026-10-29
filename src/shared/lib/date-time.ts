export interface ClockTime {
  date: string;
  minute: number;
}

export function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function readClock(value = new Date()): ClockTime {
  return {
    date: localDate(value),
    minute:
      value.getHours() * 60 +
      value.getMinutes() +
      value.getSeconds() / 60 +
      value.getMilliseconds() / 60_000,
  };
}

export function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function parseMinute(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
