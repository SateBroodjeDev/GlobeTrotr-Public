/** Match journal audience rules even when an export uses the service-role client. */
export function filterExportJournalRows<T extends { author_id: string; trip_uuid: string; visibility: string }>(
  rows: T[], userId: string, ownedTripIds: string[],
): T[] {
  const owned = new Set(ownedTripIds);
  return rows.filter((row) => row.author_id === userId
    || (owned.has(row.trip_uuid) && (row.visibility === "members" || row.visibility === "public")));
}
