// Pure pickup-availability logic — no DB access, so it's safe to import from
// both server code (order submission validation) and "use client" components
// (the wizard's calendar). Admin config (weekly hours + date overrides +
// settings) is the single source of truth; this module just answers "is this
// date/time open" given that config.

export type WeeklyHour = {
  dayOfWeek: number; // 0=Sunday..6=Saturday
  isOpen: boolean;
  openTime: string | null; // HH:MM
  closeTime: string | null;
};

export type DateOverride = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, inclusive
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
};

export type PickupSettings = {
  leadTimeHours: number;
  maxAdvanceDays: number;
  slotIntervalMinutes: number;
  maxOrdersPerDay: number | null; // null means no cap
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD key into a local Date at midnight (no timezone shift). */
export function fromDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function findOverride(dateKey: string, overrides: DateOverride[]): DateOverride | undefined {
  return overrides.find((o) => o.startDate <= dateKey && dateKey <= o.endDate);
}

/** Effective open hours for a date: override wins if one covers it, else the
 *  weekly default for that day-of-week. */
export function getDayHours(
  dateKey: string,
  weeklyHours: WeeklyHour[],
  overrides: DateOverride[]
): { open: boolean; openTime: string | null; closeTime: string | null } {
  const override = findOverride(dateKey, overrides);
  if (override) {
    return override.closed
      ? { open: false, openTime: null, closeTime: null }
      : { open: true, openTime: override.openTime, closeTime: override.closeTime };
  }

  const weekly = weeklyHours.find((w) => w.dayOfWeek === fromDateKey(dateKey).getDay());
  if (!weekly || !weekly.isOpen) return { open: false, openTime: null, closeTime: null };
  return { open: true, openTime: weekly.openTime, closeTime: weekly.closeTime };
}

/** HH:MM slots from openTime up to (not including) closeTime, every intervalMinutes. */
export function generateTimeSlots(
  openTime: string | null,
  closeTime: string | null,
  intervalMinutes: number
): string[] {
  if (!openTime || !closeTime || intervalMinutes <= 0) return [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const start = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  const slots: string[] = [];
  for (let t = start; t < end; t += intervalMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

/** The earliest instant an order may be picked up, given lead time notice. */
export function earliestPickupInstant(now: Date, leadTimeHours: number): Date {
  return new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
}

/** Whether a date falls within the bookable window: not in the past, and not
 *  further out than maxAdvanceDays. Does not account for lead time within the
 *  day — use getAvailableSlots for that. */
export function isDateInWindow(dateKey: string, settings: PickupSettings, now: Date): boolean {
  const todayKey = toDateKey(now);
  if (dateKey < todayKey) return false;
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + settings.maxAdvanceDays);
  return dateKey <= toDateKey(maxDate);
}

/** Whether a date has already hit the admin-configured max-orders-per-day cap
 *  (a null/unset cap means unlimited). Once reached, the day closes to new
 *  bookings automatically, on top of whatever the day's hours allow. */
export function isDayAtCapacity(
  dateKey: string,
  settings: PickupSettings,
  orderCountsByDate: Record<string, number>
): boolean {
  if (!settings.maxOrdersPerDay) return false;
  return (orderCountsByDate[dateKey] ?? 0) >= settings.maxOrdersPerDay;
}

/** All bookable HH:MM slots for a date, after applying hours, lead time, the
 *  advance-booking window, and the per-day order cap. Empty means the date
 *  has no pickup availability. */
export function getAvailableSlots(
  dateKey: string,
  weeklyHours: WeeklyHour[],
  overrides: DateOverride[],
  settings: PickupSettings,
  now: Date,
  orderCountsByDate: Record<string, number> = {}
): string[] {
  if (!isDateInWindow(dateKey, settings, now)) return [];
  if (isDayAtCapacity(dateKey, settings, orderCountsByDate)) return [];

  const hours = getDayHours(dateKey, weeklyHours, overrides);
  if (!hours.open) return [];

  const slots = generateTimeSlots(hours.openTime, hours.closeTime, settings.slotIntervalMinutes);
  const earliest = earliestPickupInstant(now, settings.leadTimeHours);
  const day = fromDateKey(dateKey);

  return slots.filter((slot) => {
    const [h, m] = slot.split(":").map(Number);
    const slotInstant = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    return slotInstant >= earliest;
  });
}

export function isSlotAvailable(
  dateKey: string,
  time: string,
  weeklyHours: WeeklyHour[],
  overrides: DateOverride[],
  settings: PickupSettings,
  now: Date,
  orderCountsByDate: Record<string, number> = {}
): boolean {
  return getAvailableSlots(dateKey, weeklyHours, overrides, settings, now, orderCountsByDate).includes(
    time
  );
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
