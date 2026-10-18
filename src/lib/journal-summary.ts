export type JournalSummarySource = {
  id: string;
  date: string;
  title: string;
  body: string;
  location?: string | null;
};

export function createJournalSummaryDraft(
  entries: JournalSummarySource[],
  language: "nl" | "en",
) {
  const ordered = [...entries]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 100);
  if (!ordered.length) return "";
  const locations = [...new Set(
    ordered
      .map((entry) => entry.location?.trim())
      .filter((value): value is string => Boolean(value)),
  )].slice(0, 6);
  const intro = language === "nl"
    ? "Deze reis bracht ons langs " + (locations.join(", ") || "bijzondere plekken") + "."
    : "This trip took us through " + (locations.join(", ") || "memorable places") + ".";
  const moments = ordered.map((entry) => {
    const body = entry.body.trim().replace(/\s+/g, " ");
    const excerpt = body.length > 220 ? body.slice(0, 217) + "…" : body;
    return entry.date
      + (entry.location ? " · " + entry.location : "")
      + " — " + entry.title
      + (excerpt ? ": " + excerpt : "");
  });
  return intro + "\n\n" + moments.join("\n\n");
}
