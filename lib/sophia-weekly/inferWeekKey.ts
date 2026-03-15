import { getMondayForDate } from "./weekUtils";

/**
 * Infer reporting week key (Monday of Thu–Mon week, YYYY-MM-DD).
 * Priority:
 * 1. Explicit date range in subject/filename (use end date, then normalize to that week's Monday)
 * 2. Single date in subject/filename (normalize to that week's Monday)
 * 3. Fallback: received date -> Monday of the Thu–Mon week containing that date
 */
export function inferWeekKey(
  subject: string,
  attachmentNames: string[],
  receivedDate: Date
): string {
  const combined = [subject, ...attachmentNames].join(" ");

  // e.g. "2026-03-02 to 2026-03-08" or "03/02/2026 - 03/08/2026"
  const rangeEnd = combined.match(
    /(?:to|–|-)\s*(\d{4})-(\d{2})-(\d{2})/
  ) || combined.match(
    /(?:to|–|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );
  if (rangeEnd) {
    const [, y, m, d] = rangeEnd;
    if (y && m && d) {
      const year = rangeEnd[3]?.length === 4 ? rangeEnd[3] : rangeEnd[1];
      const month = rangeEnd[1]?.length <= 2 ? rangeEnd[1] : rangeEnd[2];
      const day = rangeEnd[2]?.length <= 2 ? rangeEnd[2] : rangeEnd[3];
      const pad = (n: string) => n.padStart(2, "0");
      const iso = `${year}-${pad(month)}-${pad(day)}`;
      return getMondayForDate(new Date(iso + "T12:00:00"));
    }
  }

  // Single date YYYY-MM-DD or MM/DD/YYYY
  const single = combined.match(/(\d{4})-(\d{2})-(\d{2})/) ||
    combined.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (single) {
    const [, a, b, c] = single;
    if (a && b && c) {
      const isIso = a.length === 4 && (c?.length === 2 || c?.length === 4);
      const year = isIso ? a : c;
      const month = isIso ? b : a;
      const day = isIso ? c : b;
      const pad = (n: string) => n.padStart(2, "0");
      const iso = `${year}-${pad(month)}-${pad(day)}`;
      return getMondayForDate(new Date(iso + "T12:00:00"));
    }
  }

  // Fallback: received date -> Monday of the Thu–Mon week containing that date
  return getMondayForDate(new Date(receivedDate));
}
