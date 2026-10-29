import { z } from "zod";
import type { HttpClient } from "@/shared/api";
import { formatMinute, parseMinute } from "@/shared/lib/date-time";
import { dateSchema, timeSchema, type Meeting } from "../model/meeting";

export const bookingDtoSchema = z.object({
  id: z.string().min(1),
  date: dateSchema,
  start: timeSchema,
  end: timeSchema,
  title: z.string().optional(),
});
export const bookingInputSchema = bookingDtoSchema.omit({ id: true });
export type BookingDto = z.infer<typeof bookingDtoSchema>;

export function fromBookingDto(dto: BookingDto): Meeting {
  return { ...dto, start: parseMinute(dto.start), end: parseMinute(dto.end) };
}

export function toBookingDto(meeting: Meeting): BookingDto {
  return { ...meeting, start: formatMinute(meeting.start), end: formatMinute(meeting.end) };
}

export class MeetingService {
  constructor(private readonly http: HttpClient) {}

  async list(date: string, signal?: AbortSignal): Promise<Meeting[]> {
    return (
      await this.http.get(
        `/api/bookings?date=${encodeURIComponent(date)}`,
        bookingDtoSchema.array(),
        signal,
      )
    ).map(fromBookingDto);
  }

  async create(meeting: Meeting, signal?: AbortSignal): Promise<Meeting> {
    const { id: _id, ...body } = toBookingDto(meeting);
    return fromBookingDto(await this.http.post("/api/bookings", body, bookingDtoSchema, signal));
  }

  async update(meeting: Meeting, signal?: AbortSignal): Promise<Meeting> {
    const { id, ...body } = toBookingDto(meeting);
    return fromBookingDto(
      await this.http.patch(
        `/api/bookings/${encodeURIComponent(id)}`,
        body,
        bookingDtoSchema,
        signal,
      ),
    );
  }

  delete(id: string, signal?: AbortSignal): Promise<void> {
    return this.http.delete(`/api/bookings/${encodeURIComponent(id)}`, signal);
  }
}
