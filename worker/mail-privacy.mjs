const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recheck consent and source visibility immediately before handing mail to SMTP. */
export async function mayDeliverOptionalMail(message, readSingle) {
  const preferenceKey = {
    invitation: "invitations", trip_access: "invitations", agency_access: "invitations",
    trip_settlement: "payments", trip_change: "tripUpdates", trip_booking: "tripUpdates",
    trip_expense: "tripUpdates", trip_document: "tripUpdates", flight_alert: "flightAlerts",
  }[message.template_key];
  if (preferenceKey && message.user_id) {
    const profile = await readSingle(`profiles?id=eq.${encodeURIComponent(message.user_id)}&select=notification_preferences`);
    if (!profile || profile.notification_preferences?.[preferenceKey] === false) return false;
    const tripPreference = { trip_change: "planning", trip_booking: "bookings", trip_expense: "expenses",
      trip_document: "documents", flight_alert: "flight_alerts" }[message.template_key];
    const tripId = message.payload?.tripId;
    if (tripPreference && typeof tripId === "string" && uuid.test(tripId)) {
      const preferences = await readSingle(`trip_notification_preferences?user_id=eq.${encodeURIComponent(message.user_id)}&trip_uuid=eq.${tripId}&select=${tripPreference}`);
      if (preferences?.[tripPreference] === false) return false;
    }
    return true;
  }
  if (message.template_key !== "public_trip_update") return true;
  const { tripId, entryId, followerId, entryUpdatedAt } = message.payload ?? {};
  // Old queued copies cannot establish current consent and must be sent again deliberately.
  if (![tripId, entryId, followerId].every((id) => typeof id === "string" && uuid.test(id)) || !entryUpdatedAt) return false;
  const [trip, entry, follower] = await Promise.all([
    readSingle(`trips?trip_uuid=eq.${tripId}&select=is_public,archived,share_pin_hash`),
    readSingle(`trip_journal_entries?id=eq.${entryId}&trip_uuid=eq.${tripId}&select=visibility,updated_at`),
    readSingle(`trip_journal_followers?id=eq.${followerId}&trip_uuid=eq.${tripId}&select=status,email`),
  ]);
  return Boolean(trip?.is_public === true && trip.archived === false && !trip.share_pin_hash
    && entry?.visibility === "public" && entry.updated_at === entryUpdatedAt
    && follower?.status === "active" && follower.email?.toLowerCase() === message.recipient_email?.toLowerCase());
}
