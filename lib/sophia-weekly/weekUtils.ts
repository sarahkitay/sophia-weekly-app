/**
 * Week = 5 days Thursday through Monday. weekKey is the Monday (YYYY-MM-DD) of that week.
 * So for weekKey 2026-03-10, the week is Thu Mar 6 – Mon Mar 10.
 */

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get the Monday (YYYY-MM-DD) of the Thu–Mon week that contains the given date. */
export function getMondayForDate(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 Sun, 1 Mon, ..., 6 Sat
  // Thu=4, Fri=5, Sat=6, Sun=0, Mon=1 → Monday of this week
  if (day === 1) return toDateOnly(date);
  if (day === 0) date.setDate(date.getDate() + 1);
  else if (day === 2) date.setDate(date.getDate() - 1);
  else if (day === 3) date.setDate(date.getDate() - 2);
  else if (day === 4) date.setDate(date.getDate() + 4);
  else if (day === 5) date.setDate(date.getDate() + 3);
  else if (day === 6) date.setDate(date.getDate() + 2);
  return toDateOnly(date);
}

/** Current week's Monday: the Thu–Mon period that contains today. Tue/Wed → previous week's Monday. */
export function getCurrentWeekKey(): string {
  return getMondayForDate(new Date());
}

/** Next week's Monday (7 days after the given Monday). */
export function getNextWeekKey(weekKey: string): string {
  const d = new Date(weekKey + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return toDateOnly(d);
}

/** Thursday and Monday for the given weekKey (Monday). */
export function getWeekStartEnd(weekKey: string): { startDate: string; endDate: string } {
  const end = new Date(weekKey + "T12:00:00");
  const start = new Date(end);
  start.setDate(end.getDate() - 4);
  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
  };
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const DAYS = "Sun Mon Tue Wed Thu Fri Sat".split(" ");

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dayName = DAYS[d.getDay()];
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  return `${dayName} ${month} ${day}`;
}

/** Human-readable range e.g. "Thu Mar 6 – Mon Mar 10". */
export function getWeekRangeLabel(weekKey: string): string {
  const { startDate, endDate } = getWeekStartEnd(weekKey);
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

/** Same as getWeekRangeLabel but with full weekday names for email. */
export function getWeekRangeLabelLong(weekKey: string): string {
  const { startDate, endDate } = getWeekStartEnd(weekKey);
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const dayNames = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");
  const months = "January February March April May June July August September October November December".split(" ");
  const fmt = (d: Date) => `${dayNames[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
