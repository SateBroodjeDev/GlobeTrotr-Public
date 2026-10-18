import type { Stop } from "@/lib/types";

export type JournalSuggestion = { date: string; location?: string };

function dateRange(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return [];
  const values: string[] = [], cursor = new Date(`${start}T00:00:00Z`), finish = new Date(`${end}T00:00:00Z`);
  while (cursor <= finish && values.length < 366) { values.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return values;
}

export function journalSuggestions(start: string, end: string, stops: Stop[], entryDates: string[], today = new Date().toISOString().slice(0, 10)) {
  const completedThrough = end < today ? end : today;
  const used = new Set(entryDates);
  return dateRange(start, end).filter((date) => date <= completedThrough && !used.has(date)).map((date) => {
    const location = stops.filter((stop) => stop.arrive && stop.arrive <= date).sort((a, b) => (a.arrive ?? "").localeCompare(b.arrive ?? "")).at(-1)?.name;
    return { date, ...(location ? { location } : {}) } satisfies JournalSuggestion;
  }).slice(-3).reverse();
}
