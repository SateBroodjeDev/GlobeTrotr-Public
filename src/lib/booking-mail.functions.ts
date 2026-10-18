import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requireTripManagementAccess,
  recordTripManagementAudit,
} from "@/lib/trip-management-access.server";
import { BOOKING_MAIL_FIELDS, bookingMailTravelItem } from "@/lib/booking-mail";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function bookingMailEnabled() {
  return process.env.TRIP_BOOKING_MAIL_ENABLED === "true";
}
function requireBookingMailEnabled() {
  if (!bookingMailEnabled()) throw new Error("BOOKING_MAIL_TEMPORARILY_UNAVAILABLE");
}
function sharedInboxAddress() {
  return String(process.env.BOOKING_IMPORT_INBOX_ADDRESS || "info@globetrotr.nl")
    .trim()
    .toLowerCase();
}

export const getTripBookingMail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((x: { tripId: string; view?: "pending" | "reviewed"; page?: number }) => {
    if (
      !uuid.test(x.tripId) ||
      (x.view && !["pending", "reviewed"].includes(x.view)) ||
      (x.page != null && (!Number.isInteger(x.page) || x.page < 0 || x.page > 10000))
    )
      throw new Error("INVALID_TRIP");
    return x;
  })
  .handler(async ({ data, context }) => {
    const db = await database();
    await requireTripManagementAccess(db, context.userId, data.tripId, "trips_plan");
    if (!bookingMailEnabled())
      return { available: false, address: null, drafts: [], pendingCount: 0, reviewedCount: 0 };
    const { data: address, error } = await db
      .from("trip_booking_mail_addresses")
      .select(
        "id,address,allowed_senders,retention_days,active,revoked_at,mailbox_id,corporate_mailboxes(provisioning_status,sync_status,last_synced_at)",
      )
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (error) throw new Error("BOOKING_MAIL_UNAVAILABLE");
    if (!address)
      return { available: true, address: null, drafts: [], pendingCount: 0, reviewedCount: 0 };
    const now = new Date().toISOString();
    const rows = db
      .from("trip_booking_mail_drafts")
      .select(
        "id,sender_address,subject,booking_type,status,parsed_data,confidence,created_at,source_expires_at",
      )
      .eq("trip_uuid", data.tripId)
      .gt("source_expires_at", now);
    const page = data.page || 0;
    const reviewed = data.view === "reviewed";
    const [drafts, pending, history] = await Promise.all([
      (reviewed ? rows.neq("status", "pending") : rows.eq("status", "pending"))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * 25, page * 25 + 24),
      db
        .from("trip_booking_mail_drafts")
        .select("id", { count: "exact", head: true })
        .eq("trip_uuid", data.tripId)
        .eq("status", "pending")
        .gt("source_expires_at", now),
      db
        .from("trip_booking_mail_drafts")
        .select("id", { count: "exact", head: true })
        .eq("trip_uuid", data.tripId)
        .neq("status", "pending")
        .gt("source_expires_at", now),
    ]);
    if (drafts.error || pending.error || history.error) throw new Error("BOOKING_MAIL_UNAVAILABLE");
    return {
      available: true,
      address,
      drafts: drafts.data || [],
      pendingCount: pending.count || 0,
      reviewedCount: history.count || 0,
    };
  });

export const createTripBookingMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { tripId: string; retentionDays: number; allowedSenders: string[] }) => {
    if (
      !uuid.test(x.tripId) ||
      !Number.isInteger(x.retentionDays) ||
      x.retentionDays < 1 ||
      x.retentionDays > 365 ||
      !Array.isArray(x.allowedSenders) ||
      x.allowedSenders.length > 30 ||
      x.allowedSenders.some(
        (sender) =>
          typeof sender !== "string" ||
          sender.length > 254 ||
          (sender.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender.trim())),
      )
    )
      throw new Error("BOOKING_MAIL_SETTINGS_INVALID");
    return x;
  })
  .handler(async ({ data, context }) => {
    requireBookingMailEnabled();
    const db = await database();
    const access = await requireTripManagementAccess(db, context.userId, data.tripId, "trips_plan");
    const senders = [
      ...new Set(data.allowedSenders.map((sender) => sender.trim().toLowerCase()).filter(Boolean)),
    ];
    const inbox = await db
      .from("corporate_mailboxes")
      .select("id")
      .eq("address", sharedInboxAddress())
      .eq("active", true)
      .eq("hosting_mode", "self_hosted")
      .eq("provisioning_status", "ready")
      .maybeSingle();
    if (inbox.error || !inbox.data) throw new Error("BOOKING_IMPORT_INBOX_MISSING");
    const existing = await db
      .from("trip_booking_mail_addresses")
      .select("id,active")
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (existing.error) throw new Error("BOOKING_MAIL_UNAVAILABLE");
    // Rotating a revoked address prevents an old forwarded message from being
    // treated as a new submission when the inbox is enabled again.
    const { randomBytes } = await import("node:crypto");
    const address = `trip.${randomBytes(6).toString("hex")}@globetrotr.nl`;
    const changes = {
      allowed_senders: senders,
      retention_days: data.retentionDays,
      mailbox_id: inbox.data.id,
      active: true,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    };
    if (existing.data) {
      const saved = await db
        .from("trip_booking_mail_addresses")
        .update({ ...changes, ...(!existing.data.active ? { address } : {}) })
        .eq("id", existing.data.id);
      if (saved.error) throw new Error("BOOKING_MAIL_SAVE_FAILED");
    } else {
      const saved = await db
        .from("trip_booking_mail_addresses")
        .insert({
          ...changes,
          trip_uuid: data.tripId,
          workspace_uuid: access.workspaceId,
          address,
          created_by: context.userId,
        });
      if (saved.error) throw new Error("BOOKING_MAIL_CREATE_FAILED");
    }
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      "trip.booking_mail.save",
      "trip",
      data.tripId,
    );
    return { ok: true };
  });

export const reviewTripBookingMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      tripId: string;
      draftId: string;
      action: "accepted" | "rejected";
      bookingType?: string;
      parsedData?: Record<string, unknown>;
    }) => {
      if (
        !uuid.test(x.tripId) ||
        !uuid.test(x.draftId) ||
        !["accepted", "rejected"].includes(x.action)
      )
        throw new Error("INVALID_BOOKING_DRAFT");
      if (
        x.parsedData &&
        (typeof x.parsedData !== "object" ||
          Array.isArray(x.parsedData) ||
          Object.keys(x.parsedData).length > 20 ||
          Object.values(x.parsedData).some(
            (value) => typeof value !== "string" || value.length > 160,
          ))
      )
        throw new Error("INVALID_BOOKING_DRAFT");
      if (
        x.bookingType &&
        !["flight", "lodging", "transport", "car_rental", "activity"].includes(x.bookingType)
      )
        throw new Error("INVALID_BOOKING_DRAFT");
      return x;
    },
  )
  .handler(async ({ data, context }) => {
    requireBookingMailEnabled();
    const db = await database();
    const access = await requireTripManagementAccess(db, context.userId, data.tripId, "trips_plan");
    let corrections = {};
    if (data.action === "accepted") {
      const original = await db
        .from("trip_booking_mail_drafts")
        .select("id,subject,sender_address,booking_type,confidence,status,parsed_data")
        .eq("id", data.draftId)
        .eq("trip_uuid", data.tripId)
        .gt("source_expires_at", new Date().toISOString())
        .maybeSingle();
      if (original.error || !original.data) throw new Error("BOOKING_DRAFT_REVIEW_FAILED");
      if (original.data.status !== "accepted") {
        const fields = Object.fromEntries(
          BOOKING_MAIL_FIELDS.filter(([key]) => key in (data.parsedData || {})).map(([key]) => [
            key,
            data.parsedData![key],
          ]),
        );
        const reviewed = {
          ...original.data,
          booking_type: data.bookingType || original.data.booking_type,
          parsed_data: { ...original.data.parsed_data, ...fields },
        };
        bookingMailTravelItem(reviewed, "");
        corrections = { booking_type: reviewed.booking_type, parsed_data: reviewed.parsed_data };
      }
    }
    const result = await db
      .from("trip_booking_mail_drafts")
      .update({
        status: data.action,
        ...corrections,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.draftId)
      .eq("trip_uuid", data.tripId)
      .eq("status", "pending")
      .gt("source_expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error("BOOKING_DRAFT_REVIEW_FAILED");
    if (!result.data) {
      const existing = await db
        .from("trip_booking_mail_drafts")
        .select("status")
        .eq("id", data.draftId)
        .eq("trip_uuid", data.tripId)
        .gt("source_expires_at", new Date().toISOString())
        .maybeSingle();
      if (existing.error || existing.data?.status !== data.action)
        throw new Error("BOOKING_DRAFT_REVIEW_FAILED");
      return { ok: true };
    }
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      `trip.booking_mail.${data.action}`,
      "booking_mail_draft",
      data.draftId,
    );
    return { ok: true };
  });

export const revokeTripBookingMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { tripId: string }) => {
    if (!uuid.test(x.tripId)) throw new Error("INVALID_TRIP");
    return x;
  })
  .handler(async ({ data, context }) => {
    requireBookingMailEnabled();
    const db = await database();
    const access = await requireTripManagementAccess(db, context.userId, data.tripId, "trips_plan");
    const now = new Date().toISOString();
    const stopped = await db
      .from("trip_booking_mail_addresses")
      .update({ active: false, revoked_at: now, updated_at: now })
      .eq("trip_uuid", data.tripId)
      .eq("active", true)
      .select("id")
      .maybeSingle();
    if (stopped.error || !stopped.data) throw new Error("BOOKING_MAIL_REVOKE_FAILED");
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      "trip.booking_mail.revoke",
      "trip",
      data.tripId,
    );
    return { ok: true };
  });
