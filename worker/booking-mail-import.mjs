import { createHash } from "node:crypto";

// Keep the first fingerprint compatible with drafts imported by older workers.
export function bookingSegments(recognized, fingerprint) {
  return (recognized.bookings || [recognized]).map((booking, index) => ({
    ...booking,
    fingerprint:
      index === 0
        ? fingerprint
        : createHash("sha256").update(`${fingerprint}\nsegment:${index}`).digest("hex"),
  }));
}

export async function storeBookingDraft({ rest, record }) {
  record = {
    ...record,
    parsed_data: { ...record.parsed_data, importParserVersion: "itinerary-v2" },
  };
  const created = await rest("trip_booking_mail_drafts?on_conflict=trip_uuid,source_fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(record),
  });
  if (created?.length) return created;
  // Enrich an older unreviewed draft, without resurrecting reviewed/expired mail
  // or extending its original retention period. The status condition is atomic.
  await rest(
    `trip_booking_mail_drafts?trip_uuid=eq.${encodeURIComponent(record.trip_uuid)}&source_fingerprint=eq.${record.source_fingerprint}&status=eq.pending&parsed_data->>importParserVersion=is.null`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        booking_type: record.booking_type,
        parsed_data: record.parsed_data,
        confidence: record.confidence,
      }),
    },
  );
  return [];
}
