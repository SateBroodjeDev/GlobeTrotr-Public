import type { Trip, TripMemberRole } from "./types";

/** Houd velden buiten de bevoegdheid van een reisgenoot gelijk aan de databaseversie. */
export function protectTripUpdate(
  current: Trip,
  submitted: Trip,
  role: Exclude<TripMemberRole, "owner" | "viewer" | "client">,
): Trip {
  if (role === "finance") {
    return { ...current, revision: submitted.revision, expenses: submitted.expenses };
  }
  return {
    ...submitted,
    members: current.members,
    archived: current.archived,
    public: current.public,
    shareFinancials: current.shareFinancials,
    sharePinHash: current.sharePinHash,
  };
}
