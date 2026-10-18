const sections = new Set([
  "today",
  "route",
  "plan",
  "expenses",
  "offline",
  "discover",
  "plan-edit",
  "options",
  "booking-mail",
  "packing",
  "documents",
  "money",
  "insights",
  "settings",
]);

export function tripSection(value: unknown): string | undefined {
  // Older internal links used bookings for the booking editor.
  if (value === "bookings") return "plan-edit";
  return typeof value === "string" && sections.has(value) ? value : undefined;
}
