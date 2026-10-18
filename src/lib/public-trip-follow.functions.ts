import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mailLocale } from "@/lib/mail-locale";
import { requireTripManagementAccess, recordTripManagementAudit } from "@/lib/trip-management-access.server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function publicTrip(db: any, token: string, tripId: string, pin?: string) {
  if (!uuidPattern.test(tripId) || token.length < 16 || token.length > 200) return null;
  const { data: workspace } = await db.from("workspaces").select("workspace_uuid,public_token,branding").eq("public_token", token).maybeSingle();
  if (!workspace) return null;
  const { data: trip } = await db.from("trips").select("trip_uuid,name,is_public,archived,share_pin_hash,workspace_uuid").eq("trip_uuid", tripId).eq("workspace_uuid", workspace.workspace_uuid).eq("is_public", true).eq("archived", false).maybeSingle();
  if (!trip) return null;
  if (trip.share_pin_hash) {
    if (!pin || await sha256(pin) !== trip.share_pin_hash) return null;
  }
  return { trip, workspace };
}

async function deliveryStatus(db: any) {
  const { data } = await db.from("email_delivery_config").select("mode").eq("id", true).maybeSingle();
  return data?.mode === "live" ? "pending" : "held";
}

function publicUrl(path: string) { return `https://globetrotr.nl${path}`; }

export const getPublicTripShareDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuidPattern.test(data.tripId)) throw new Error("INVALID_INPUT");
    const db = await database();
    const { data: trip } = await db
      .from("trips")
      .select("trip_uuid,name,is_public,archived,share_pin_hash,workspace_uuid,workspace_user_id")
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    if (trip.workspace_user_id !== context.userId) {
      const { data: member } = await db
        .from("trip_members")
        .select("id")
        .eq("trip_uuid", data.tripId)
        .eq("user_id", context.userId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) throw new Error("TRIP_ACCESS_REQUIRED");
    }
    if (!trip.is_public || trip.archived) return { public: false as const };
    const { data: workspace } = await db
      .from("workspaces")
      .select("public_token")
      .eq("workspace_uuid", trip.workspace_uuid)
      .maybeSingle();
    if (!workspace?.public_token) throw new Error("PUBLIC_LINK_UNAVAILABLE");
    return {
      public: true as const,
      name: String(trip.name),
      url: publicUrl(`/reis/${workspace.public_token}/${trip.trip_uuid}`),
      pinProtected: Boolean(trip.share_pin_hash),
    };
  });

export const followPublicTrip = createServerFn({ method: "POST" })
  .validator((input: { token: string; tripId: string; pin?: string; email: string; locale: string }) => input)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!emailPattern.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
    const db = await database();
    const shared = await publicTrip(db, data.token, data.tripId, data.pin);
    if (!shared) throw new Error("PUBLIC_TRIP_NOT_FOUND");
    const { data: existing } = await db.from("trip_journal_followers").select("id,status,last_requested_at").eq("trip_uuid", data.tripId).eq("email", email).maybeSingle();
    if (existing?.status === "active") return { ok: true };
    if (existing?.last_requested_at && Date.now() - Date.parse(existing.last_requested_at) < 60_000) return { ok: true };
    const { count: pendingCount } = await db.from("trip_journal_followers").select("id", { count: "exact", head: true }).eq("trip_uuid", data.tripId).eq("status", "pending").gt("confirmation_expires_at", new Date().toISOString());
    if (!existing && (pendingCount ?? 0) >= 100) throw new Error("FOLLOW_REQUEST_LIMIT");
    const confirmationToken = randomToken(), unsubscribeToken = randomToken();
    const record = {
      trip_uuid: data.tripId, email, locale: mailLocale(data.locale), status: "pending",
      confirmation_token_hash: await sha256(confirmationToken), unsubscribe_token_hash: await sha256(unsubscribeToken),
      confirmation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), confirmed_at: null, unsubscribed_at: null, last_requested_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const { data: follower, error } = await db.from("trip_journal_followers").upsert(record, { onConflict: "trip_uuid,email" }).select("id").single();
    if (error) throw new Error("FOLLOW_REQUEST_FAILED");
    const english = record.locale === "en";
    const actionUrl = publicUrl(`/reis-volgen?actie=bevestigen&token=${confirmationToken}`);
    const branding = shared.workspace.branding && typeof shared.workspace.branding === "object" ? shared.workspace.branding : {};
    const { error: queueError } = await db.from("email_outbox").insert({
      notification_id: null, user_id: null, recipient_email: email, locale: record.locale,
      template_key: "public_trip_follow", status: await deliveryStatus(db),
      payload: {
        title: english ? `Confirm following ${shared.trip.name}` : `Bevestig volgen van ${shared.trip.name}`,
        body: english ? `Someone shared “${shared.trip.name}” with you. Confirm your email address to receive only travel memories a trip member deliberately sends. Nothing is sent automatically, and every update contains an unsubscribe link.` : `Iemand heeft “${shared.trip.name}” met je gedeeld. Bevestig je e-mailadres om alleen reisherinneringen te ontvangen die een reisgenoot bewust verstuurt. Er wordt niets automatisch verzonden en iedere update bevat een afmeldlink.`,
        actionUrl,
        branding: { brandName: String(branding.brandName || branding.name || "GlobeTrotr"), accentHue: Number(branding.accentHue || 168), workspaceId: shared.workspace.workspace_uuid },
      },
    });
    if (queueError) {
      await db.from("trip_journal_followers").delete().eq("id", follower.id).eq("status", "pending");
      throw new Error("FOLLOW_EMAIL_QUEUE_FAILED");
    }
    return { ok: true, requestId: follower.id };
  });

export const managePublicTripFollow = createServerFn({ method: "POST" })
  .validator((input: { token: string; action: "confirm" | "unsubscribe" }) => input)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{64}$/i.test(data.token)) return { status: "invalid" as const };
    const db = await database(), hash = data.action === "confirm" ? await sha256(data.token) : data.token.toLowerCase();
    const column = data.action === "confirm" ? "confirmation_token_hash" : "unsubscribe_token_hash";
    const values = data.action === "confirm"
      ? { status: "active", confirmed_at: new Date().toISOString(), unsubscribed_at: null, updated_at: new Date().toISOString() }
      : { status: "unsubscribed", unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    let query = db.from("trip_journal_followers").update(values).eq(column, hash);
    if (data.action === "confirm") query = query.eq("status", "pending").gt("confirmation_expires_at", new Date().toISOString());
    const { data: row } = await query.select("id").maybeSingle();
    if (row) return { status: data.action === "confirm" ? "confirmed" as const : "unsubscribed" as const };
    const expectedStatus = data.action === "confirm" ? "active" : "unsubscribed";
    const { data: existing } = await db.from("trip_journal_followers").select("id").eq(column, hash).eq("status", expectedStatus).maybeSingle();
    return { status: existing ? (data.action === "confirm" ? "confirmed" as const : "unsubscribed" as const) : "invalid" as const };
  });

export const savePublicJournalReaction = createServerFn({ method: "POST" })
  .validator((input: { token: string; tripId: string; pin?: string; entryId: string; visitorToken: string; liked: boolean; name?: string; comment?: string }) => input)
  .handler(async ({ data }) => {
    if (!uuidPattern.test(data.entryId) || !/^[0-9a-f-]{36}$/i.test(data.visitorToken)) throw new Error("INVALID_REACTION");
    const name=data.name?.trim().slice(0,60)||null,comment=data.comment?.trim().slice(0,500)||null;
    if(comment&&!name) throw new Error("REACTION_NAME_REQUIRED");
    const db=await database(),shared=await publicTrip(db,data.token,data.tripId,data.pin);
    if(!shared) throw new Error("PUBLIC_TRIP_NOT_FOUND");
    const {data:entry}=await db.from("trip_journal_entries").select("id").eq("id",data.entryId).eq("trip_uuid",data.tripId).eq("visibility","public").maybeSingle();
    if(!entry) throw new Error("PUBLIC_ENTRY_NOT_FOUND");
    const visitorHash=await sha256(data.visitorToken);
    const {data:existing}=await db.from("trip_journal_reactions").select("id,updated_at").eq("entry_id",data.entryId).eq("visitor_hash",visitorHash).maybeSingle();
    if(existing?.updated_at&&Date.now()-Date.parse(existing.updated_at)<3000) throw new Error("REACTION_TOO_FAST");
    if(!data.liked&&!comment){if(existing)await db.from("trip_journal_reactions").delete().eq("id",existing.id);return{ok:true};}
    if(!existing){const{count}=await db.from("trip_journal_reactions").select("id",{count:"exact",head:true}).eq("entry_id",data.entryId);if((count??0)>=5000)throw new Error("REACTION_LIMIT");}
    const {error}=await db.from("trip_journal_reactions").upsert({trip_uuid:data.tripId,entry_id:data.entryId,visitor_hash:visitorHash,liked:Boolean(data.liked),display_name:name,comment,status:"visible",updated_at:new Date().toISOString()},{onConflict:"entry_id,visitor_hash"});
    if(error)throw new Error("REACTION_SAVE_FAILED");
    return{ok:true};
  });

export const listPublicJournalReactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input:{tripId:string})=>input)
  .handler(async({data,context})=>{
    if(!uuidPattern.test(data.tripId))throw new Error("INVALID_INPUT");
    const db=await database();await requireTripManagementAccess(db,context.userId,data.tripId,"trips_plan");
    const{data:rows,error}=await db.from("trip_journal_reactions").select("id,entry_id,liked,display_name,comment,status,created_at").eq("trip_uuid",data.tripId).order("created_at",{ascending:false}).limit(100);
    if(error)throw new Error("REACTIONS_LOAD_FAILED");return rows??[];
  });

export const hidePublicJournalReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input:{tripId:string;reactionId:string})=>input)
  .handler(async({data,context})=>{
    if(!uuidPattern.test(data.tripId)||!uuidPattern.test(data.reactionId))throw new Error("INVALID_INPUT");
    const db=await database(),access=await requireTripManagementAccess(db,context.userId,data.tripId,"trips_plan");
    const{error}=await db.from("trip_journal_reactions").update({status:"hidden",updated_at:new Date().toISOString()}).eq("id",data.reactionId).eq("trip_uuid",data.tripId);
    if(error)throw new Error("REACTION_HIDE_FAILED");
    await recordTripManagementAudit(db,access,context.userId,"trip_journal.reaction_hidden","journal_reaction",data.reactionId);
    return{ok:true};
  });

export const broadcastPublicJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; entryId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuidPattern.test(data.tripId) || !uuidPattern.test(data.entryId)) throw new Error("INVALID_INPUT");
    const db = await database();
    let access;
    try { access = await requireTripManagementAccess(db, context.userId, data.tripId, "trips_plan"); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "TRIP_OWNER_REQUIRED") throw error;
      const [{ data: tripAccess }, { data: member }] = await Promise.all([
        db.from("trips").select("workspace_user_id,workspace_uuid").eq("trip_uuid", data.tripId).maybeSingle(),
        db.from("trip_members").select("role,status").eq("trip_uuid", data.tripId).eq("user_id", context.userId).eq("status", "active").in("role", ["owner","traveler"]).maybeSingle(),
      ]);
      if (!tripAccess || !member) throw new Error("TRIP_PUBLISH_PERMISSION_REQUIRED");
      const { data: workspacePlan, error: workspaceError } = await db.from("workspaces").select("plan").eq("workspace_uuid", tripAccess.workspace_uuid).maybeSingle();
      if (workspaceError || !workspacePlan || workspacePlan.plan === "agency") throw new Error("TRIP_PUBLISH_PERMISSION_REQUIRED");
      access = { ownerId: tripAccess.workspace_user_id, workspaceId: tripAccess.workspace_uuid, isAgency: workspacePlan?.plan === "agency" };
    }
    const [{ data: entry }, { data: trip }, { data: workspace }, { data: followers }] = await Promise.all([
      db.from("trip_journal_entries").select("id,title,body,entry_date,location_name,updated_at,visibility").eq("id", data.entryId).eq("trip_uuid", data.tripId).maybeSingle(),
      db.from("trips").select("name,is_public,archived,share_pin_hash").eq("trip_uuid", data.tripId).maybeSingle(),
      db.from("workspaces").select("public_token,branding").eq("workspace_uuid", access.workspaceId).maybeSingle(),
      db.from("trip_journal_followers").select("id,email,locale,unsubscribe_token_hash").eq("trip_uuid", data.tripId).eq("status", "active"),
    ]);
    if (!entry || entry.visibility !== "public" || !trip?.is_public || trip.archived || trip.share_pin_hash || !workspace?.public_token) throw new Error("PUBLIC_ENTRY_REQUIRED");
    const { data: broadcast, error: broadcastError } = await db.from("trip_journal_broadcasts").insert({ trip_uuid: data.tripId, entry_id: data.entryId, entry_updated_at: entry.updated_at, sent_by: context.userId, recipient_count: followers?.length ?? 0 }).select("id").maybeSingle();
    if (broadcastError?.code === "23505") throw new Error("UPDATE_ALREADY_SENT");
    if (broadcastError || !broadcast) throw new Error("BROADCAST_FAILED");
    const status = await deliveryStatus(db), branding = workspace.branding && typeof workspace.branding === "object" ? workspace.branding : {};
    const actionUrl = publicUrl(`/reis/${workspace.public_token}/${data.tripId}`);
    if (followers?.length) {
      const rows = followers.map((follower: any) => {
        const english = mailLocale(follower.locale) === "en";
        return { notification_id: null, user_id: null, recipient_email: follower.email, locale: follower.locale, template_key: "public_trip_update", status,
          payload: { tripId: data.tripId, entryId: data.entryId, followerId: follower.id, entryUpdatedAt: entry.updated_at,
            title: `${trip.name}: ${entry.title}`, body: `${entry.entry_date}${entry.location_name ? ` · ${entry.location_name}` : ""}\n\n${String(entry.body || "").slice(0, 900)}`, actionUrl,
            secondaryActionUrl: publicUrl(`/reis-volgen?actie=afmelden&token=${follower.unsubscribe_token_hash}`),
            secondaryActionLabel: english ? "Unsubscribe from this trip" : "Deze reis niet meer volgen",
            branding: { brandName: String(branding.brandName || branding.name || "GlobeTrotr"), accentHue: Number(branding.accentHue || 168), workspaceId: access.workspaceId },
          } };
      });
      const { error } = await db.from("email_outbox").insert(rows);
      if (error) { await db.from("trip_journal_broadcasts").delete().eq("id", broadcast.id); throw new Error("BROADCAST_QUEUE_FAILED"); }
      await db.from("trip_journal_followers").update({ last_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in("id", followers.map((item: any) => item.id));
    }
    await recordTripManagementAudit(db, access, context.userId, "trip_journal.broadcast", "journal_entry", data.entryId);
    return { ok: true, recipients: followers?.length ?? 0 };
  });
