import { delay, http, HttpResponse } from "msw";
import { z } from "zod";
import {
  BookingError,
  bookingInputSchema,
  dateSchema,
  fromBookingDto,
  toBookingDto,
} from "@/entities/meeting";
import { BookingStore } from "./store";

async function respond(action: () => Response | Promise<Response>) {
  await delay(250);
  try {
    return await action();
  } catch (error) {
    if (error instanceof BookingError)
      return HttpResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    return HttpResponse.json(
      { code: "VALIDATION_ERROR", message: "Проверьте дату и время встречи" },
      { status: 400 },
    );
  }
}

export function createHandlers(store = new BookingStore()) {
  return [
    http.get("/api/bookings", ({ request }) =>
      respond(() => {
        if (store.failNextLoad) {
          store.failNextLoad = false;
          throw new BookingError("Не удалось загрузить расписание", 503, "SERVER_ERROR");
        }
        const date = dateSchema.parse(new URL(request.url).searchParams.get("date"));
        return HttpResponse.json(store.list(date).toMeetings().map(toBookingDto));
      }),
    ),
    http.post("/api/bookings", ({ request }) =>
      respond(async () => {
        const input = bookingInputSchema.parse(await request.json());
        const meeting = fromBookingDto({ ...input, id: crypto.randomUUID() });
        store.save({ type: "create", meeting });
        return HttpResponse.json(toBookingDto(meeting), { status: 201 });
      }),
    ),
    http.patch("/api/bookings/:id", ({ request, params }) =>
      respond(async () => {
        const id = String(params.id);
        const existing = store.find(id);
        const input = bookingInputSchema.partial().parse(await request.json());
        const meeting = fromBookingDto({ ...toBookingDto(existing), ...input, id });
        store.save({ type: "update", meeting });
        return HttpResponse.json(toBookingDto(meeting));
      }),
    ),
    http.delete("/api/bookings/:id", ({ params }) =>
      respond(() => {
        store.save({ type: "delete", meetingId: String(params.id) });
        return new HttpResponse(null, { status: 204 });
      }),
    ),
    http.post("/api/demo/conflict", () => {
      store.conflictNextCreate = true;
      return HttpResponse.json({ armed: true });
    }),
    http.post("/api/demo/failure", async ({ request }) => {
      const { kind } = z.object({ kind: z.enum(["load", "mutation"]) }).parse(await request.json());
      if (kind === "load") store.failNextLoad = true;
      else store.failNextMutation = true;
      return HttpResponse.json({ armed: true });
    }),
  ];
}
