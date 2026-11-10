/** Validate record ownership before any service-role Storage action. */
export function ownedAvatarPath(path: unknown, ownerId: unknown): path is string {
  if (typeof path !== "string" || typeof ownerId !== "string" || !ownerId) return false;
  const prefix = `${ownerId}/`;
  if (!path.startsWith(prefix)) return false;
  const file = path.slice(prefix.length);
  return /^[a-zA-Z0-9_.-]+$/.test(file) && file !== "." && file !== "..";
}

export function ownedTripCoverPath(path: unknown, tripId: string): path is string {
  return typeof path === "string" && path.startsWith(`${tripId}/`) &&
    /^[0-9a-f-]{36}\/cover-[0-9]+\.(?:jpg|png|webp)$/i.test(path);
}
