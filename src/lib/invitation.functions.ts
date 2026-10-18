import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripMemberRole } from "@/lib/types";
import {
  requireTripManagementAccess,
  recordTripManagementAudit,
} from "@/lib/trip-management-access.server";
import { queueInvitationEmail } from "@/lib/email-outbox.server";
import { mailLocale } from "@/lib/mail-locale";

const INVITABLE_ROLES: TripMemberRole[] = ["traveler", "viewer", "advisor", "finance", "client"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InvitationResponseStatus =
  "accepted" | "already_member" | "declined" | "expired" | "revoked" | "forbidden" | "invalid";

export type PendingTripInvitation = {
  id: string;
  email: string;
  role: TripMemberRole;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "expired";
  emailStatus: "held" | "pending" | "processing" | "sent" | "failed" | "cancelled" | null;
  emailError: string | null;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function invitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const createTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; email: string; role: TripMemberRole }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (
      !/^[0-9a-f-]{36}$/i.test(data.tripId) ||
      !EMAIL_PATTERN.test(email) ||
      !INVITABLE_ROLES.includes(data.role)
    )
      throw new Error("INVALID_INPUT");
    const db = await adminClient();
    const access = await requireTripManagementAccess(
      db,
      context.userId,
      data.tripId,
      "members_manage",
    );

    const token = invitationToken();
    const { data: invitation, error } = await db
      .from("trip_invitations")
      .insert({
        trip_uuid: data.tripId,
        email,
        role: data.role,
        token_hash: await sha256(token),
        invited_by: context.userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, expires_at")
      .single();
    if (error) throw error;
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      "trip_invitation.create",
      "invitation",
      invitation.id,
    );
    const [{ data: trip }, { data: recipient }] = await Promise.all([
      db.from("trips").select("name").eq("trip_uuid", data.tripId).single(),
      db.from("profiles").select("id,locale").ilike("email", email).maybeSingle(),
    ]);
    const mailDelivery = await queueInvitationEmail(db, {
      recipient: email,
      preferenceUserId: recipient?.id,
      locale: mailLocale(recipient?.locale),
      title: `Uitnodiging voor ${trip?.name ?? "een reis"} / Invitation to ${trip?.name ?? "a trip"}`,
      body: `Je bent als ${data.role} uitgenodigd voor ${trip?.name ?? "een reis"}. Bekijk eerst de reisgegevens en kies daarna zelf of je deelneemt. Deze persoonlijke link is zeven dagen geldig. / You have been invited to ${trip?.name ?? "a trip"} as ${data.role}. Review the trip details and then choose whether to join. This personal link is valid for seven days.`,
      actionUrl: `https://portal.globetrotr.nl/invite/${token}`,
      invitationType: "trip",
      invitationId: invitation.id,
    });
    return {
      id: invitation.id as string,
      token,
      expiresAt: invitation.expires_at as string,
      mailDelivery,
    };
  });

export const listPendingTripInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.tripId)) throw new Error("INVALID_INPUT");
    const db = await adminClient();
    await requireTripManagementAccess(db, context.userId, data.tripId, "members_manage");
    const { data: invitations, error } = await db
      .from("trip_invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("trip_uuid", data.tripId)
      .is("accepted_at", null)
      .is("declined_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const invitationIds = (invitations ?? []).map((item: any) => item.id);
    const { data: deliveries, error: deliveryError } = invitationIds.length
      ? await db
          .from("email_outbox")
          .select("invitation_id,status,last_error_code,created_at")
          .eq("invitation_type", "trip")
          .in("invitation_id", invitationIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (deliveryError) throw deliveryError;
    const latestDelivery = new Map<string, any>();
    for (const delivery of deliveries ?? [])
      if (!latestDelivery.has(delivery.invitation_id))
        latestDelivery.set(delivery.invitation_id, delivery);
    const now = Date.now();
    return (invitations ?? []).map((invitation: any) => ({
      id: invitation.id as string,
      email: invitation.email as string,
      role: invitation.role as TripMemberRole,
      createdAt: invitation.created_at as string,
      expiresAt: invitation.expires_at as string,
      status: Date.parse(invitation.expires_at) <= now ? "expired" : "pending",
      emailStatus: latestDelivery.get(invitation.id)?.status ?? null,
      emailError: latestDelivery.get(invitation.id)?.last_error_code ?? null,
    })) as PendingTripInvitation[];
  });

export const manageTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; invitationId: string; action: "revoke" | "renew" }) => input)
  .handler(async ({ data, context }) => {
    if (
      !/^[0-9a-f-]{36}$/i.test(data.tripId) ||
      !/^[0-9a-f-]{36}$/i.test(data.invitationId) ||
      !["revoke", "renew"].includes(data.action)
    )
      throw new Error("INVALID_INPUT");
    const token = data.action === "renew" ? invitationToken() : "";
    const db = await adminClient();
    const access = await requireTripManagementAccess(
      db,
      context.userId,
      data.tripId,
      "members_manage",
    );
    const { data: result, error } = await db.rpc("manage_trip_invitation", {
      p_invitation_id: data.invitationId,
      p_trip_uuid: data.tripId,
      p_owner_id: access.ownerId,
      p_action: data.action,
      p_token_hash: token ? await sha256(token) : null,
    });
    if (error) {
      console.error("[Trip invitation] Management failed.", {
        code: error.code,
        action: data.action,
      });
      throw new Error(
        error.code === "PGRST202"
          ? "INVITATION_MANAGEMENT_UNAVAILABLE"
          : "INVITATION_MANAGEMENT_FAILED",
      );
    }
    const expectedStatus = data.action === "renew" ? "renewed" : "revoked";
    if (!result || result.status !== expectedStatus) {
      throw new Error(`INVITATION_MANAGEMENT_${String(result?.status ?? "INVALID").toUpperCase()}`);
    }
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      `trip_invitation.${data.action}`,
      "invitation",
      data.invitationId,
    );
    let mailDelivery: "queued" | "skipped" | "failed" | undefined;
    if (data.action === "renew") {
      const { data: invitation } = await db
        .from("trip_invitations")
        .select("email")
        .eq("id", data.invitationId)
        .single();
      const [{ data: trip }, { data: recipient }] = await Promise.all([
        db.from("trips").select("name").eq("trip_uuid", data.tripId).single(),
        db
          .from("profiles")
          .select("id,locale")
          .ilike("email", invitation?.email ?? "")
          .maybeSingle(),
      ]);
      if (invitation?.email)
        mailDelivery = await queueInvitationEmail(db, {
          recipient: invitation.email,
          preferenceUserId: recipient?.id,
          locale: mailLocale(recipient?.locale),
          title: `Uitnodiging voor ${trip?.name ?? "een reis"} / Invitation to ${trip?.name ?? "a trip"}`,
          body: `Je vernieuwde uitnodiging voor ${trip?.name ?? "een reis"} staat klaar. / Your renewed invitation to ${trip?.name ?? "a trip"} is ready.`,
          actionUrl: `https://portal.globetrotr.nl/invite/${token}`,
          invitationType: "trip",
          invitationId: data.invitationId,
        });
    }
    return {
      status: result.status as "revoked" | "renewed",
      token: token || undefined,
      expiresAt: result.expiresAt as string | undefined,
      mailDelivery,
    };
  });

export const getTripInvitation = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{64}$/i.test(data.token)) return { status: "invalid" as const };
    const db = await adminClient();
    const { data: invitation, error } = await db
      .from("trip_invitations")
      .select(
        "id, trip_uuid, role, expires_at, accepted_at, declined_at, revoked_at, trips(name, workspace_user_id)",
      )
      .eq("token_hash", await sha256(data.token))
      .maybeSingle();
    if (error || !invitation) return { status: "invalid" as const };
    const status = invitation.revoked_at
      ? "revoked"
      : invitation.accepted_at
        ? "accepted"
        : invitation.declined_at
          ? "declined"
          : Date.parse(invitation.expires_at) <= Date.now()
            ? "expired"
            : "pending";
    const trip = Array.isArray(invitation.trips) ? invitation.trips[0] : invitation.trips;
    return {
      status,
      invitationId: invitation.id as string,
      tripId: invitation.trip_uuid as string,
      tripName: String(trip?.name ?? "Reis"),
      role: invitation.role as TripMemberRole,
      expiresAt: invitation.expires_at as string,
    };
  });

export const respondToTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { response: "accept" | "decline"; token?: string; invitationId?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    let tokenHash =
      data.token && /^[0-9a-f]{64}$/i.test(data.token) ? await sha256(data.token) : "";
    let invitationId = "";
    if (tokenHash) {
      const { data: invitation, error } = await db
        .from("trip_invitations")
        .select("id")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error || !invitation) throw error ?? new Error("INVITATION_NOT_FOUND");
      invitationId = invitation.id;
    }
    if (!tokenHash && data.invitationId && /^[0-9a-f-]{36}$/i.test(data.invitationId)) {
      const { data: invitation, error } = await db
        .from("trip_invitations")
        .select("token_hash")
        .eq("id", data.invitationId)
        .maybeSingle();
      if (error || !invitation) throw error ?? new Error("INVITATION_NOT_FOUND");
      tokenHash = invitation.token_hash;
      invitationId = data.invitationId;
    }
    if (!tokenHash) throw new Error("INVALID_INVITATION");
    const functionName =
      data.response === "accept" ? "accept_trip_invitation" : "decline_trip_invitation";
    const { data: result, error } = await db.rpc(functionName, {
      p_token_hash: tokenHash,
      p_user_id: context.userId,
    });
    if (error) {
      const reference =
        error.code === "PGRST202"
          ? "rpc-unavailable"
          : error.code === "23505"
            ? "membership-conflict"
            : "database-error";
      console.error("[Trip invitation] Response failed.", {
        reference,
        code: error.code,
        response: data.response,
      });
      throw new Error(`INVITATION_RESPONSE_FAILED:${reference}`);
    }
    if (!result || typeof result !== "object" || typeof result.status !== "string") {
      console.error("[Trip invitation] RPC returned an invalid response shape.");
      throw new Error("INVITATION_RESPONSE_FAILED:invalid-response");
    }
    if (["accepted", "already_member", "declined"].includes(result.status) && invitationId) {
      const { error: notificationError } = await db
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("event_key", `invitation:${invitationId}`)
        .is("dismissed_at", null);
      if (notificationError) {
        console.error("[Trip invitation] Notification could not be dismissed.", {
          code: notificationError.code,
        });
      }
    }
    return result as { status: InvitationResponseStatus; tripId?: string };
  });

export const removeTripMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; memberId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.tripId) || !data.memberId.trim()) {
      throw new Error("INVALID_INPUT");
    }
    const db = await adminClient();
    const access = await requireTripManagementAccess(
      db,
      context.userId,
      data.tripId,
      "members_manage",
    );
    const { data: removed, error } = await db.rpc("remove_trip_member", {
      p_trip_uuid: data.tripId,
      p_member_id: data.memberId,
      p_owner_id: access.ownerId,
    });
    if (error) {
      console.error("[Trip member] Removal failed.", { code: error.code });
      throw new Error(
        error.code === "PGRST202" ? "MEMBER_REMOVAL_UNAVAILABLE" : "MEMBER_REMOVAL_FAILED",
      );
    }
    if (!removed) throw new Error("MEMBER_NOT_FOUND");
    await recordTripManagementAudit(
      db,
      access,
      context.userId,
      "trip_member.remove",
      "member",
      data.memberId,
    );
    return { removed: true };
  });
