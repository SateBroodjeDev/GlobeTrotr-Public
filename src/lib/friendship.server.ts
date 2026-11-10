export type FriendshipChange = {
  slug?: string;
  friendshipId?: string;
  action: "request" | "accept" | "remove";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Notice = (userId: string, eventKey: string, accepted: boolean) => Promise<void>;

/** All privileged writes are constrained to a relationship of the authenticated user. */
export async function updateFriendship(db: any, userId: string, input: FriendshipChange, notify: Notice) {
  if (!["request", "accept", "remove"].includes(input.action)) throw new Error("INVALID_FRIEND_ACTION");
  let profile: any;
  if (input.action === "request" || !input.friendshipId) {
    if (typeof input.slug !== "string" || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(input.slug)) throw new Error("INVALID_PROFILE");
    const result = await db.from("profiles").select("id,friend_requests_enabled")
      .eq("public_slug", input.slug).eq("public_profile_enabled", true).maybeSingle();
    if (result.error) throw new Error("FRIEND_LOOKUP_FAILED");
    profile = result.data;
    if (!profile || profile.id === userId) throw new Error("INVALID_PROFILE");
  } else if (!UUID.test(input.friendshipId)) throw new Error("INVALID_FRIEND_REQUEST");

  let lookup = db.from("traveler_friendships").select("id,requester_id,addressee_id,status");
  lookup = input.action !== "request" && input.friendshipId
    ? lookup.eq("id", input.friendshipId).or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    : lookup.or(`and(requester_id.eq.${userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${userId})`);
  const { data: existing, error } = await lookup.maybeSingle();
  if (error) throw new Error("FRIEND_LOOKUP_FAILED");
  if (existing && existing.requester_id !== userId && existing.addressee_id !== userId) throw new Error("INVALID_FRIEND_REQUEST");

  let notice: [string, string, boolean] | undefined;
  if (input.action === "request") {
    if (existing) return { ok: true };
    if (profile.friend_requests_enabled === false) throw new Error("FRIEND_REQUESTS_DISABLED");
    const created = await db.from("traveler_friendships").insert({ requester_id: userId, addressee_id: profile.id }).select("id").single();
    if (created.error || !created.data?.id) throw new Error("FRIEND_REQUEST_FAILED");
    notice = [profile.id, `friend-request:${created.data.id}`, false];
  } else if (input.action === "accept") {
    if (!existing || existing.addressee_id !== userId) throw new Error("INVALID_FRIEND_REQUEST");
    if (existing.status === "accepted") return { ok: true };
    if (existing.status !== "pending") throw new Error("INVALID_FRIEND_REQUEST");
    const changed = await db.from("traveler_friendships").update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", existing.id).eq("addressee_id", userId).eq("status", "pending").select("id").maybeSingle();
    if (changed.error || !changed.data) throw new Error("FRIEND_ACCEPT_FAILED");
    notice = [existing.requester_id, `friend-accepted:${existing.id}`, true];
  } else if (existing) {
    const removed = await db.from("traveler_friendships").delete().eq("id", existing.id)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).select("id").maybeSingle();
    if (removed.error || !removed.data) throw new Error("FRIEND_REMOVE_FAILED");
  }
  // The relationship is already committed. A delivery error must not present it as rejected.
  if (notice) {
    try { await notify(...notice); }
    catch { console.warn(JSON.stringify({ event: "social.notification_failed", code: "FRIEND_NOTIFICATION_FAILED", action: input.action })); }
  }
  return { ok: true };
}
