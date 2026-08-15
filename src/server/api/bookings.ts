import { BookingStatus } from "@/src/generated/prisma/enums";
import { ApiError } from "@/src/server/api/errors";

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.DECLINED],
  [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.CHECKED_IN]: [BookingStatus.IN_PROGRESS, BookingStatus.NO_SHOW],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
  [BookingStatus.DECLINED]: [],
};

export function assertValidBookingStatusTransition(fromStatus: BookingStatus, toStatus: BookingStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  const allowed = allowedTransitions[fromStatus];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Cannot change booking status from ${fromStatus} to ${toStatus}`);
  }
}
