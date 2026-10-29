export {
  BookingError,
  dateSchema,
  timeSchema,
  isFutureMeeting,
  meetingStatus,
} from "./model/meeting";
export type { Meeting } from "./model/meeting";
export {
  MeetingService,
  bookingDtoSchema,
  bookingInputSchema,
  fromBookingDto,
  toBookingDto,
} from "./api/meeting.service";
export type { BookingDto } from "./api/meeting.service";
