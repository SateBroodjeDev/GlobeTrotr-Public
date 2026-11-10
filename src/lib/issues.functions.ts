import { runAdminEffect } from "./audited-admin-fetch";
import { savePlatformPlan } from "./workspace-plan.server";
import { validateDevelopmentInput } from "./development";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteUserWithStorage } from "./account-deletion.server";
import { validatePlatformAnnouncementInput, type PlatformAnnouncementInput } from "./platform-incident";

async function adminDb(userId: string, permission: "operations" | "users" | "issues" | "agencies" | "overview") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.auth.admin.getUserById(userId);
  const { data: assigned, error: assignmentError } = await db
    .from("platform_admins")
    .select("role,permissions")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error || assignmentError || data.user?.app_metadata?.corporate_admin !== true || !assigned ||
    (permission !== "overview" && assigned.role !== "owner" && assigned.permissions?.[permission] !== true)) {
    await audit(db, userId, "admin.access", "platform", null, "failure", {
      reason: "authorization_denied",
    });
    throw new Error("FORBIDDEN");
  }
  return (await import("./audited-admin.server")).createAuditedAdminClient(userId, permission);
}

async function audit(
  db: any,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  result: "success" | "failure",
  details: Record<string, unknown> = {},
) {
  const { error } = await db.from("platform_admin_audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    result,
    details,
  });
  if (error) {
    console.error(JSON.stringify({ event: "admin.audit_failed", code: "ADMIN_AUDIT_WRITE_FAILED" }));
    throw new Error("ADMIN_AUDIT_WRITE_FAILED");
  }
}

export type ApplicationDiagnosticRow = {
  id: string; operation: string; code: string; first_seen: string; last_seen: string;
  first_release: string; last_release: string; samples: number; status: "open" | "resolved";
};
export const getApplicationDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const db = await adminDb(context.userId, "operations");
    const [control, rows] = await Promise.all([
      db.from("application_diagnostic_control").select("enabled,notifications_enabled").eq("singleton", true).single(),
      db.from("application_diagnostics").select("id,operation,code,first_seen,last_seen,first_release,last_release,samples,status").order("last_seen", { ascending: false }).limit(50),
    ]);
    if (control.error || rows.error) throw new Error("DIAGNOSTICS_UNAVAILABLE");
    return { enabled: Boolean(control.data.enabled), notificationsEnabled: Boolean(control.data.notifications_enabled),
      rows: (rows.data ?? []) as ApplicationDiagnosticRow[],
    };
  });

export const manageApplicationDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { action: "enable" | "disable" | "alerts_on" | "alerts_off" | "resolve"; id?: string }) => {
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!input || !["enable", "disable", "alerts_on", "alerts_off", "resolve"].includes(input.action)
      || (input.action === "resolve" && !uuid.test(input.id ?? ""))) throw new Error("INVALID_DIAGNOSTIC_ACTION");
    return input;
  }).handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "operations");
    const { error } = await db.rpc("manage_application_diagnostic", {
      p_actor: context.userId, p_action: data.action, p_id: data.id ?? null, p_issue: null,
    });
    if (error) throw new Error("DIAGNOSTIC_UPDATE_FAILED");
    return { ok: true };
  });

async function syncGithub(issue: any, db: any, actor: string) {
  const token = process.env["GITHUB_ISSUES_TOKEN"]?.trim();
  const repository = process.env["GITHUB_ISSUES_REPOSITORY"]
    ?.trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "");
  if (!token || !repository) return { synced: false, reason: "not_configured" };
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return { synced: false, reason: "repository_invalid" };
  const body = `## Nederlands\n\n${issue.description_nl}\n\n## English\n\n${issue.description_en}\n\n**Category:** ${issue.category}\n**Status:** ${issue.status}  \n**Severity:** ${issue.severity}  \n**Public:** ${issue.public ? "yes" : "no"}\n\n_Automatically synchronized from GlobeTrotr Corporate Admin._`;
  const existing = Number(issue.github_issue_number);
  const payload = existing
    ? { title: issue.title_en, body, state: issue.status === "resolved" ? "closed" : "open" }
    : { title: issue.title_en, body };
  const response = await runAdminEffect(db, actor, "issues", "development.github", String(issue.id ?? ""), () => fetch(
    existing
      ? `https://api.github.com/repos/${owner}/${repo}/issues/${existing}`
      : `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: existing ? "PATCH" : "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "Content-Type": "application/json",
        "User-Agent": "GlobeTrotr-Corporate-Admin",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    },
  ));
  if (!response.ok) {
    console.error(`[GitHub Issues] Synchronisatie mislukt met HTTP ${response.status}.`);
    return { synced: false, reason: `http_${response.status}` };
  }
  const result = (await response.json()) as { number: number };
  return { synced: true, number: result.number };
}

export const getDevelopmentData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const db = await adminDb(context.userId, "issues");
    const { data, error } = await db.from("known_issues").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("DEVELOPMENT_DATA_UNAVAILABLE");
    const repository = process.env.GITHUB_ISSUES_REPOSITORY?.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    const repositoryUrl = repository && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) ? `https://github.com/${repository}` : null;
    return { issues: data ?? [], repositoryUrl, syncConfigured: Boolean(repositoryUrl && process.env.GITHUB_ISSUES_TOKEN?.trim()), limit: 500 };
  });

export const getCorporateAgencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "agencies");
    const { data, error } = await db
      .from("workspaces")
      .select(
        "workspace_uuid,user_id,created_at,agency_settings(system_name,sender_name,contact_email,default_locale,timezone,currency,domain,tagline,accent,logo_path,updated_at)",
      )
      .eq("plan", "agency")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const owners = await Promise.all(
      (data ?? []).map(async (row: any) => {
        const user = await db.auth.admin.getUserById(row.user_id);
        return {
          ...row,
          ownerEmail: user.data.user?.email ?? "",
          settings: Array.isArray(row.agency_settings)
            ? row.agency_settings[0]
            : row.agency_settings,
        };
      }),
    );
    await audit(db, context.userId, "admin.agencies.view", "agency", null, "success");
    return owners;
  });

export const listPublicTripsForModeration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "issues");
    const { data, error } = await db
      .from("trips")
      .select(
        "trip_uuid,workspace_user_id,name,description,start_date,end_date,is_public,archived,updated_at",
      )
      .or("is_public.eq.true,archived.eq.true")
      .order("updated_at", { ascending: false })
      .limit(250);
    if (error) throw error;
    const owners = await Promise.all(
      (data ?? []).map(async (row: any) => {
        const result = await db.auth.admin.getUserById(row.workspace_user_id);
        return { ...row, ownerEmail: result.data.user?.email ?? "" };
      }),
    );
    await audit(db, context.userId, "public_trips.moderation.view", "trip", null, "success");
    return owners;
  });

export const moderatePublicTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { tripId: string; action: "unpublish" | "archive" | "restore"; reason: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues"),
      reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.tripId) || reason.length < 5 || reason.length > 500)
      throw new Error("INVALID_MODERATION");
    const { data: trip, error: loadError } = await db
      .from("trips")
      .select("trip_uuid,workspace_user_id,name")
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (loadError || !trip) throw new Error("TRIP_NOT_FOUND");
    const changes =
      data.action === "unpublish"
        ? { is_public: false }
        : data.action === "archive"
          ? { archived: true, is_public: false }
          : { archived: false };
    const { error } = await db
      .from("trips")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("trip_uuid", data.tripId);
    if (error) throw error;
    await db
      .from("notifications")
      .upsert(
        {
          user_id: trip.workspace_user_id,
          kind: "platform",
          title: "Openbare reis beoordeeld / Public trip reviewed",
          body: `${data.action}|${trip.name}|${reason}`,
          trip_uuid: trip.trip_uuid,
          event_key: `trip-moderation:${trip.trip_uuid}`,
          created_at: new Date().toISOString(),
          dismissed_at: null,
        },
        { onConflict: "user_id,event_key" },
      );
    await audit(db, context.userId, `public_trip.${data.action}`, "trip", data.tripId, "success", {
      reason,
    });
    return { ok: true };
  });

export const saveCorporateAgencySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      ownerId: string;
      settings: {
        systemName: string;
        senderName: string;
        contactEmail: string;
        defaultLocale: "nl" | "en";
        timezone: string;
        currency: string;
        domain: string;
        tagline: string;
        accent: number;
        logoPath: string | null;
      };
      reason: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "agencies");
    const reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.ownerId) || reason.length < 5)
      throw new Error("INVALID_INPUT");
    const { data: result, error } = await db.rpc("save_agency_settings", {
      p_owner_id: data.ownerId,
      p_settings: data.settings,
    });
    await audit(
      db,
      context.userId,
      "admin.agency_settings.update",
      "agency",
      data.ownerId,
      error || !result?.ok ? "failure" : "success",
      { reason },
    );
    if (error || !result?.ok) throw new Error("AGENCY_SETTINGS_SAVE_FAILED");
    return { ok: true };
  });

export const getCorporateAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "overview");
    const { data: capabilities, error: capabilityError } = await db.from("platform_admins")
      .select("role,permissions").eq("user_id", context.userId).eq("active", true).single();
    if (capabilityError || !capabilities) throw new Error("FORBIDDEN");
    const allowed = (permission: string) => capabilities.role === "owner" || capabilities.permissions?.[permission] === true;
    const empty = { data: [], error: null };
    const [feedback, feedbackReplies, workspaces, trips, auditLog, profiles, authUsers] =
      await Promise.all([
        allowed("issues") ? db.from("beta_feedback").select("*").order("created_at", { ascending: false }) : empty,
        allowed("issues") ? db
          .from("feedback_replies")
          .select("id,feedback_id,author_user_id,body,created_at")
          .order("created_at") : empty,
        db.from("workspaces").select("user_id, plan, created_at, updated_at"),
        db.from("trips").select("archived, is_public"),
        allowed("operations") ? db
          .from("platform_admin_audit_log")
          .select("id, actor_user_id, action, target_type, target_id, result, details, created_at")
          .order("created_at", { ascending: false })
          .limit(30) : empty,
        (allowed("users") || allowed("operations")) ? db.from("profiles").select("id, display_name, email, locale, created_at, updated_at") : empty,
        (allowed("users") || allowed("operations")) ? db.auth.admin.listUsers({ page: 1, perPage: 1000 }) : { data: { users: [] }, error: null },
      ]);
    if (feedback.error) throw feedback.error;
    if (feedbackReplies.error) throw feedbackReplies.error;
    if (workspaces.error) throw workspaces.error;
    if (trips.error) throw trips.error;
    if (auditLog.error) throw auditLog.error;
    if (profiles.error) throw profiles.error;
    if (authUsers.error) throw authUsers.error;
    const workspaceRows = workspaces.data ?? [];
    const tripRows = trips.data ?? [];
    const feedbackRows = feedback.data ?? [];
    const profileById = new Map((profiles.data ?? []).map((profile: any) => [profile.id, profile]));
    const workspaceById = new Map(
      workspaceRows.map((workspace: any) => [workspace.user_id, workspace]),
    );
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await audit(db, context.userId, "admin.dashboard.view", "platform", null, "success");
    return {
      feedback: feedbackRows,
      feedbackReplies: feedbackReplies.data ?? [],
      auditLog: (auditLog.data ?? []).map((entry: any) => {
        const actor: any = profileById.get(entry.actor_user_id);
        const authActor = authUsers.data.users.find((user: any) => user.id === entry.actor_user_id);
        const target: any = profileById.get(entry.target_id);
        const authTarget = authUsers.data.users.find((user: any) => user.id === entry.target_id);
        return {
          ...entry,
          actorName: actor?.display_name || authActor?.user_metadata?.full_name || "",
          actorEmail: actor?.email || authActor?.email || "",
          targetName: target?.display_name || authTarget?.user_metadata?.full_name || "",
          targetEmail: target?.email || authTarget?.email || "",
        };
      }),
      users: (allowed("users") ? authUsers.data.users : []).map((user: any) => {
        const profile: any = profileById.get(user.id);
        const workspace: any = workspaceById.get(user.id);
        return {
          id: user.id,
          email: user.email ?? profile?.email ?? "",
          displayName: profile?.display_name ?? "",
          locale: profile?.locale ?? "nl-NL",
          plan: workspace?.plan ?? "free",
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          emailConfirmed: Boolean(user.email_confirmed_at),
          hasWorkspace: Boolean(workspace),
        };
      }),
      metrics: {
        workspaces: workspaceRows.length,
        newWorkspaces30d: workspaceRows.filter(
          (row: any) => Date.parse(row.created_at) >= thirtyDaysAgo,
        ).length,
        activeWorkspaces30d: workspaceRows.filter(
          (row: any) => Date.parse(row.updated_at) >= thirtyDaysAgo,
        ).length,
        plans: {
          free: workspaceRows.filter((row: any) => row.plan === "free").length,
          pro: workspaceRows.filter((row: any) => row.plan === "pro").length,
          agency: workspaceRows.filter((row: any) => row.plan === "agency").length,
        },
        activeTrips: tripRows.filter((row: any) => !row.archived).length,
        publicTrips: tripRows.filter((row: any) => !row.archived && row.is_public).length,
        openFeedback: feedbackRows.filter(
          (row: any) => !row.archived_at && !["resolved", "closed"].includes(row.status),
        ).length,
      },
    };
  });

export const getPlatformUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    if (!/^[0-9a-f-]{36}$/i.test(data.userId)) throw new Error("INVALID_INPUT");

    const [authUser, profile, workspace, ownedTrips, memberships, agencyMemberships] = await Promise.all([
      db.auth.admin.getUserById(data.userId),
      db
        .from("profiles")
        .select("display_name, email, locale, created_at, updated_at, public_slug, biography, public_profile_enabled, friend_requests_enabled, visited_countries")
        .eq("id", data.userId)
        .maybeSingle(),
      db
        .from("workspaces")
        .select("workspace_uuid, plan, share_enabled, created_at, updated_at")
        .eq("user_id", data.userId)
        .maybeSingle(),
      db
        .from("trips")
        .select(
          "trip_uuid, name, start_date, end_date, archived, is_public, created_at, updated_at",
        )
        .eq("workspace_user_id", data.userId)
        .order("updated_at", { ascending: false }),
      db
        .from("trip_members")
        .select("trip_uuid", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .eq("status", "active"),
      db
        .from("workspace_members")
        .select("workspace_uuid")
        .eq("user_id", data.userId)
        .eq("status", "active"),
    ]);
    if (authUser.error || !authUser.data.user) throw authUser.error ?? new Error("USER_NOT_FOUND");
    if (profile.error) throw profile.error;
    if (workspace.error) throw workspace.error;
    if (ownedTrips.error) throw ownedTrips.error;
    if (memberships.error) throw memberships.error;
    if (agencyMemberships.error) throw agencyMemberships.error;

    const manualPlan = workspace.data
      ? await db.from("workspace_plan_overrides").select("plan").eq("workspace_uuid", workspace.data.workspace_uuid).maybeSingle()
      : { data: null, error: null };
    if (manualPlan.error) throw manualPlan.error;
    const memberWorkspaceIds=(agencyMemberships.data??[]).map((membership:any)=>membership.workspace_uuid);
    const agencyMemberWorkspace=memberWorkspaceIds.length
      ? await db.from("workspaces").select("workspace_uuid").in("workspace_uuid",memberWorkspaceIds).eq("plan","agency").limit(1)
      : {data:[],error:null};
    if (agencyMemberWorkspace.error) throw agencyMemberWorkspace.error;
    const agencyAccount=workspace.data?.plan==="agency"||(agencyMemberWorkspace.data?.length??0)>0;

    const trips = ownedTrips.data ?? [];
    await audit(db, context.userId, "user.detail.view", "user", data.userId, "success");
    return {
      user: {
        id: authUser.data.user.id,
        email: authUser.data.user.email ?? profile.data?.email ?? "",
        displayName: profile.data?.display_name ?? "",
        locale: profile.data?.locale ?? "nl-NL",
        phone: authUser.data.user.phone ?? "",
        publicSlug: profile.data?.public_slug ?? "",
        biography: profile.data?.biography ?? "",
        publicProfileEnabled: Boolean(profile.data?.public_profile_enabled),
        friendRequestsEnabled: profile.data?.friend_requests_enabled !== false,
        visitedCountries: profile.data?.visited_countries ?? [],
        identities: (authUser.data.user.identities ?? []).map((identity: any) => ({
          id: identity.id,
          provider: identity.provider,
          createdAt: identity.created_at ?? null,
        })),
        emailConfirmed: Boolean(authUser.data.user.email_confirmed_at),
        blockedUntil: authUser.data.user.banned_until ?? null,
        createdAt: authUser.data.user.created_at,
        lastSignInAt: authUser.data.user.last_sign_in_at ?? null,
        agencyAccount,
      },
      workspace: workspace.data
          ? {
            id: workspace.data.workspace_uuid,
            plan: workspace.data.plan ?? "free",
            manualPlan: manualPlan.data?.plan ?? null,
            publicSharingEnabled: Boolean(workspace.data.share_enabled),
            createdAt: workspace.data.created_at,
            updatedAt: workspace.data.updated_at,
          }
        : null,
      tripCounts: {
        total: trips.length,
        active: trips.filter((trip: any) => !trip.archived).length,
        public: trips.filter((trip: any) => !trip.archived && trip.is_public).length,
        archived: trips.filter((trip: any) => trip.archived).length,
        shared: memberships.count ?? 0,
      },
      recentTrips: trips.slice(0, 10).map((trip: any) => ({
        id: trip.trip_uuid,
        name: trip.name,
        start: trip.start_date,
        end: trip.end_date,
        archived: trip.archived,
        public: trip.is_public,
        createdAt: trip.created_at,
        updatedAt: trip.updated_at,
      })),
    };
  });

export const updatePlatformUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; displayName: string; email: string; phone: string; locale: "nl-NL" | "en-GB"; plan: "free" | "pro" | "agency"; planMode?: "manual" | "automatic"; planChange?: boolean; publicSlug: string; biography: string; publicProfileEnabled: boolean; friendRequestsEnabled: boolean; visitedCountries: string[]; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    const email = data.email.trim().toLowerCase(), phone = data.phone.trim(), displayName = data.displayName.trim(), reason = data.reason.trim(),publicSlug=data.publicSlug.trim().toLowerCase(),biography=data.biography.trim();
    const reserved=new Set(["admin","administrator","api","auth","billing","contact","corp","corporate-admin","dashboard","globetrotr","help","journal","login","privacy","register","root","security","status","support","trips","users","vrienden"]);
    const visitedCountries=[...new Map((data.visitedCountries??[]).map(country=>country.trim()).filter(country=>country.length>=2&&country.length<=80).map(country=>[country.toLocaleLowerCase(),country])).values()].slice(0,100);
    if ((data.planChange !== undefined && typeof data.planChange !== "boolean") || (data.planMode !== undefined && !["manual","automatic"].includes(data.planMode)) || !/^[0-9a-f-]{36}$/i.test(data.userId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length > 120 || phone.length > 40 || biography.length>500 || visitedCountries.length!==(data.visitedCountries??[]).length || (publicSlug&&(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(publicSlug)||reserved.has(publicSlug))) || (data.publicProfileEnabled&&!publicSlug) || !["nl-NL", "en-GB"].includes(data.locale) || !["free","pro","agency"].includes(data.plan) || reason.length < 10 || reason.length > 500) throw new Error("INVALID_INPUT");
    const { data: beforeWorkspace, error: workspaceReadError } = await db.from("workspaces").select("plan").eq("user_id", data.userId).maybeSingle();
    if (workspaceReadError || !beforeWorkspace) throw workspaceReadError ?? new Error("WORKSPACE_NOT_FOUND");
    const { data: current, error: readError } = await db.auth.admin.getUserById(data.userId);
    if (readError || !current.user) throw readError ?? new Error("USER_NOT_FOUND");
    const { error: authError } = await db.auth.admin.updateUserById(data.userId, {
      email,
      phone: phone || undefined,
      user_metadata: { ...current.user.user_metadata, full_name: displayName, language: data.locale.startsWith("en") ? "en" : "nl" },
    });
    if (authError) throw authError;
    const { error: profileError } = await db.from("profiles").upsert({ id: data.userId, email, display_name: displayName || null, locale: data.locale,public_slug:publicSlug||null,biography:biography||null,public_profile_enabled:data.publicProfileEnabled,friend_requests_enabled:data.friendRequestsEnabled,visited_countries:visitedCountries, updated_at: new Date().toISOString() });
    if (profileError) throw profileError;
    await savePlatformPlan(db, context.userId, beforeWorkspace.plan, data);
    await audit(db, context.userId, "user.profile.update", "user", data.userId, "success", { reason, changed: ["display_name", "email", "phone", "locale","plan","public_slug","biography","public_profile_enabled","friend_requests_enabled","visited_countries"] });
    return { ok: true };
  });

export const unlinkPlatformUserIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; identityId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users"), reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.userId) || !data.identityId || reason.length < 10 || reason.length > 500) throw new Error("INVALID_INPUT");
    const { data: target, error } = await db.auth.admin.getUserById(data.userId);
    if (error || !target.user) throw error ?? new Error("USER_NOT_FOUND");
    const identity = target.user.identities?.find((item: any) => item.id === data.identityId);
    if (!identity || identity.provider === "email") throw new Error("IDENTITY_NOT_REMOVABLE");
    const base = process.env["SUPABASE_URL"]?.replace(/\/$/, ""), key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!base || !key) throw new Error("ADMIN_IDENTITY_API_UNAVAILABLE");
    const headers: Record<string,string> = { apikey: key };
    if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
    const response = await runAdminEffect(db, context.userId, "users", "auth.action", data.userId, () => fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(data.userId)}/identities/${encodeURIComponent(data.identityId)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) }));
    if (!response.ok) throw new Error("IDENTITY_UNLINK_FAILED");
    await audit(db, context.userId, "user.identity.unlink", "user", data.userId, "success", { reason, provider: identity.provider });
    return { ok: true };
  });

export const deletePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; notify: boolean; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users"), reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.userId) || reason.length < 10 || reason.length > 500 || data.userId === context.userId) throw new Error("INVALID_INPUT");
    const [{ data: target, error }, profile, delivery] = await Promise.all([
      db.auth.admin.getUserById(data.userId),
      db.from("profiles").select("locale").eq("id", data.userId).maybeSingle(),
      db.from("email_delivery_config").select("mode").eq("id", true).maybeSingle(),
    ]);
    if (error || !target.user?.email) throw error ?? new Error("USER_NOT_FOUND");
    if (target.user.app_metadata?.corporate_admin === true) throw new Error("CANNOT_DELETE_CORPORATE_ADMIN");
    const recipient = target.user.email.toLowerCase(), locale = String(profile.data?.locale ?? "nl-NL").startsWith("en") ? "en" : "nl";
    await deleteUserWithStorage(db, data.userId);
    let mailQueued = false;
    if (data.notify) {
      const title = locale === "en" ? "Your GlobeTrotr account has been deleted" : "Je GlobeTrotr-account is verwijderd";
      const body = locale === "en" ? "Your account and associated personal access have been permanently deleted by an administrator. Contact info@globetrotr.nl if you have questions." : "Je account en bijbehorende persoonlijke toegang zijn definitief verwijderd door een beheerder. Neem bij vragen contact op via info@globetrotr.nl.";
      const queued = await db.from("email_outbox").insert({ notification_id: null, user_id: null, recipient_email: recipient, locale, template_key: "account_deletion", payload: { title, body }, status: delivery.data?.mode === "live" ? "pending" : "held" });
      mailQueued = !queued.error;
      if (queued.error) await audit(db, context.userId, "user.delete.notification", "user", data.userId, "failure", { reason: "mail_queue_failed", locale });
    }
    await audit(db, context.userId, "user.delete", "user", data.userId, "success", { reason, notificationRequested: data.notify, mailQueued, locale });
    return { ok: true, mailQueued };
  });

export const setPlatformUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; blocked: boolean; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    const reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.userId) || reason.length < 10 || reason.length > 500)
      throw new Error("INVALID_INPUT");
    if (data.userId === context.userId) throw new Error("CANNOT_BLOCK_SELF");

    const { data: target, error: readError } = await db.auth.admin.getUserById(data.userId);
    if (readError || !target.user) throw readError ?? new Error("USER_NOT_FOUND");
    const wasBlocked = Boolean(
      target.user.banned_until && Date.parse(target.user.banned_until) > Date.now(),
    );
    if (wasBlocked === data.blocked) return { ok: true, blocked: wasBlocked };

    const { error } = await db.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (error) {
      await audit(
        db,
        context.userId,
        data.blocked ? "user.block" : "user.restore",
        "user",
        data.userId,
        "failure",
        { reason, error: error.name ?? "auth_update_failed" },
      );
      throw error;
    }
    await audit(
      db,
      context.userId,
      data.blocked ? "user.block" : "user.restore",
      "user",
      data.userId,
      "success",
      { reason },
    );
    const { error: notificationError } = await db.from("notifications").upsert(
      {
        user_id: data.userId,
        kind: "account",
        title: data.blocked
          ? "Account geblokkeerd / Account blocked"
          : "Account hersteld / Account restored",
        body: `access|${data.blocked ? "blocked" : "restored"}`,
        event_key: "account-access",
        created_at: new Date().toISOString(),
        dismissed_at: null,
      },
      { onConflict: "user_id,event_key" },
    );
    if (notificationError) {
      await audit(db, context.userId, "user.notification", "user", data.userId, "failure", {
        action: data.blocked ? "blocked" : "restored",
      });
    }
    return { ok: true, blocked: data.blocked };
  });

export const resetPlatformUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    const reason = data.reason.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.userId) || reason.length < 10 || reason.length > 500)
      throw new Error("INVALID_INPUT");
    const { data: factors, error } = await db.auth.admin.mfa.listFactors({ userId: data.userId });
    if (error) throw error;
    const totp = [...(factors?.factors ?? [])].filter(
      (factor: any) => factor.factor_type === "totp",
    );
    for (const factor of totp) {
      const result = await db.auth.admin.mfa.deleteFactor({ userId: data.userId, id: factor.id });
      if (result.error) throw result.error;
    }
    await audit(db, context.userId, "user.mfa.reset", "user", data.userId, "success", {
      reason,
      removed: totp.length,
    });
    await db
      .from("notifications")
      .insert({
        user_id: data.userId,
        kind: "account",
        title: "Tweestapsverificatie hersteld / Two-step verification reset",
        body: "security|mfa-reset",
        event_key: `mfa-reset:${Date.now()}`,
        link: "/account",
      });
    return { ok: true, removed: totp.length };
  });

export const updatePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      userId: string;
      displayName: string;
      locale: "nl-NL" | "en-GB";
      plan: "free" | "pro" | "agency";
      reason: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    const displayName = data.displayName.trim();
    const reason = data.reason.trim();
    if (
      !/^[0-9a-f-]{36}$/i.test(data.userId) ||
      displayName.length < 1 ||
      displayName.length > 100 ||
      reason.length < 10 ||
      reason.length > 500
    )
      throw new Error("INVALID_INPUT");
    if (!["nl-NL", "en-GB"].includes(data.locale) || !["free", "pro", "agency"].includes(data.plan))
      throw new Error("INVALID_INPUT");
    const { data: beforeWorkspace, error: workspaceReadError } = await db
      .from("workspaces")
      .select("plan")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (workspaceReadError || !beforeWorkspace)
      throw workspaceReadError ?? new Error("WORKSPACE_NOT_FOUND");
    const { data: beforeProfile, error: profileReadError } = await db
      .from("profiles")
      .select("display_name, locale")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileReadError || !beforeProfile)
      throw profileReadError ?? new Error("PROFILE_NOT_FOUND");
    const { error: profileError } = await db
      .from("profiles")
      .update({ display_name: displayName, locale: data.locale })
      .eq("id", data.userId);
    if (profileError) throw profileError;
    await savePlatformPlan(db, context.userId, beforeWorkspace.plan, data);
    await audit(db, context.userId, "user.update", "user", data.userId, "success", {
      reason,
      changes: {
        display_name: [beforeProfile.display_name, displayName],
        locale: [beforeProfile.locale, data.locale],
        plan: [beforeWorkspace.plan, data.plan],
      },
    });
    return { ok: true };
  });

type HealthStatus = "operational" | "degraded" | "not_configured";
async function timedCheck(name: string, check: () => Promise<boolean>, configured = true) {
  const started = Date.now();
  if (!configured) return { name, status: "not_configured" as HealthStatus, durationMs: 0 };
  try {
    return {
      name,
      status: (await check()) ? ("operational" as HealthStatus) : ("degraded" as HealthStatus),
      durationMs: Date.now() - started,
    };
  } catch {
    return { name, status: "degraded" as HealthStatus, durationMs: Date.now() - started };
  }
}
async function reachable(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

const providerNames = [
  "weather",
  "flight_lookup",
  "routing",
  "email",
  "domain_verification",
  "object_storage",
] as const;

export const getPlatformOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "operations");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [controls, usage, failedJobs] = await Promise.all([
      db
        .from("platform_provider_controls")
        .select("provider,enabled,reason,updated_at")
        .order("provider"),
      db.from("external_api_usage").select("usage_date,provider,calls").gte("usage_date", since),
      db
        .from("worker_jobs")
        .select("id,provider,job_type,status,attempts,last_error_code,available_at,updated_at")
        .in("status", ["failed", "cancelled"])
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);
    if (controls.error || usage.error || failedJobs.error)
      throw new Error("PLATFORM_OPERATIONS_UNAVAILABLE");
    const totals = new Map<string, number>();
    for (const row of usage.data ?? [])
      totals.set(row.provider, (totals.get(row.provider) ?? 0) + row.calls);
    await audit(db, context.userId, "platform.operations.view", "platform", null, "success");
    return {
      providers: (controls.data ?? []).map((row: any) => ({
        ...row,
        calls7d: totals.get(row.provider) ?? 0,
      })),
      failedJobs: failedJobs.data ?? [],
    };
  });

export const setPlatformProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { provider: string; enabled: boolean; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "users");
    if (!providerNames.includes(data.provider as (typeof providerNames)[number]))
      throw new Error("INVALID_PROVIDER");
    const reason = data.reason.trim();
    if (!data.enabled && reason.length < 5) throw new Error("PROVIDER_REASON_REQUIRED");
    const { data: updated, error } = await db
      .from("platform_provider_controls")
      .update({
        enabled: data.enabled,
        reason: data.enabled ? null : reason.slice(0, 240),
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("provider", data.provider)
      .select("provider")
      .maybeSingle();
    await audit(
      db,
      context.userId,
      data.enabled ? "platform.provider.enable" : "platform.provider.disable",
      "provider",
      data.provider,
      error || !updated ? "failure" : "success",
      { reason: data.enabled ? "restored" : reason },
    );
    if (error || !updated) throw new Error("PROVIDER_UPDATE_FAILED");
    return { ok: true };
  });

export const runPlatformHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "operations");
    const githubToken = process.env["GITHUB_ISSUES_TOKEN"]?.trim();
    const githubRepository = process.env["GITHUB_ISSUES_REPOSITORY"]
      ?.trim()
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
    const checks = await Promise.all([
      timedCheck(
        "database",
        async () =>
          !(await db.from("workspaces").select("user_id", { head: true, count: "exact" })).error,
      ),
      timedCheck("storage", async () => !(await db.storage.listBuckets()).error),
      timedCheck(
        "weather",
        async () =>
          (await reachable(
            "https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.90&current=temperature_2m,weather_code",
            { Accept: "application/json" },
          )) ||
          reachable(
            "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=52.37&lon=4.90",
            { Accept: "application/json", "User-Agent": "GlobeTrotr/1.0 info@globetrotr.nl" },
          ),
      ),
      timedCheck("rates", () => reachable("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD")),
      timedCheck(
        "github",
        () =>
          reachable(`https://api.github.com/repos/${githubRepository}`, {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken}`,
            "User-Agent": "GlobeTrotr-Corporate-Admin",
          }),
        Boolean(githubToken && githubRepository),
      ),
      timedCheck(
        "worker",
        () => reachable(process.env["WORKER_HEALTH_URL"]!),
        Boolean(process.env["WORKER_HEALTH_URL"]?.trim()),
      ),
      timedCheck(
        "mail_server",
        () => reachable(process.env["MAIL_SERVER_HEALTH_URL"]!),
        Boolean(process.env["MAIL_SERVER_HEALTH_URL"]?.trim()),
      ),
    ]);
    const publicKeys: Record<string, string> = {
      database: "database",
      storage: "storage",
      weather: "weather",
      rates: "rates",
      worker: "worker",
      mail_server: "mail_server",
    };
    const saved = await Promise.all(
      checks
        .filter((check) => publicKeys[check.name])
        .map((check) =>
          db
            .from("platform_status_components")
            .update({
              status: check.status === "not_configured" ? "unknown" : check.status,
              response_ms: check.durationMs,
              checked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("component_key", publicKeys[check.name]),
        ),
    );
    if (saved.some(result => result.error)) throw new Error("PLATFORM_STATUS_SAVE_FAILED");
    // Only the independent external probe can confirm website reachability.
    await audit(db, context.userId, "platform.health_check", "platform", null, "success", {
      overall_status: checks.some((check) => check.status === "degraded")
        ? "degraded"
        : "operational",
      statuses: Object.fromEntries(checks.map((check) => [check.name, check.status])),
    });
    return { checkedAt: new Date().toISOString(), checks };
  });

export const saveDevelopmentIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateDevelopmentInput)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues");
    const row = {
      title_nl: data.titleNl.trim(),
      title_en: data.titleEn.trim(),
      description_nl: data.descriptionNl.trim(),
      description_en: data.descriptionEn.trim(),
      category: data.category,
      status: data.status,
      severity: data.severity,
      public: false,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? db.from("known_issues").update(row).eq("id", data.id)
      : db.from("known_issues").insert(row);
    const { data: saved, error } = await query.select("*").single();
    if (error) throw error;
    let github: Awaited<ReturnType<typeof syncGithub>>;
    try {
      github = await syncGithub(saved, db, context.userId);
    } catch (error) {
      console.error(JSON.stringify({ event: "development.github_sync_failed", code: "GITHUB_SYNC_UNAVAILABLE" }));
      github = { synced: false, reason: "network_error" };
    }
    if (github.synced && saved.github_issue_number !== github.number)
      await db
        .from("known_issues")
        .update({ github_issue_number: github.number })
        .eq("id", saved.id);
    await audit(
      db,
      context.userId,
      data.id ? "known_issue.update" : "known_issue.create",
      "known_issue",
      saved.id,
      "success",
      { github_synced: github.synced, category: saved.category },
    );
    return { issue: saved, github };
  });

export const syncDevelopmentIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "issues");
    const { data: issues, error } = await db
      .from("known_issues")
      .select("*")
      .is("github_issue_number", null)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(25);
    if (error) throw error;
    let synced = 0;
    let failed = 0;
    for (const issue of issues ?? []) {
      let github: Awaited<ReturnType<typeof syncGithub>>;
      try {
        github = await syncGithub(issue, db, context.userId);
      } catch (error) {
        console.error(JSON.stringify({ event: "development.github_sync_failed", code: "GITHUB_SYNC_UNAVAILABLE" }));
        github = { synced: false, reason: "network_error" };
      }
      if (github.synced) {
        const { error: updateError } = await db
          .from("known_issues")
          .update({ github_issue_number: github.number })
          .eq("id", issue.id)
          .is("github_issue_number", null);
        if (updateError) throw updateError;
        synced += 1;
      } else {
        failed += 1;
      }
    }
    await audit(
      db,
      context.userId,
      "known_issue.github_sync",
      "known_issue",
      null,
      failed ? "failure" : "success",
      { synced, failed },
    );
    return { synced, failed };
  });

export const updateFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { id: string; status: "new" | "reviewing" | "planned" | "resolved" | "closed" }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues");
    const { error } = await db
      .from("beta_feedback")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    await audit(db, context.userId, "feedback.status.update", "feedback", data.id, "success", {
      status: data.status,
    });
    return { ok: true };
  });

export const replyToFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues");
    const body = data.body.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.id) || body.length < 2 || body.length > 2000)
      throw new Error("INVALID_FEEDBACK_REPLY");
    const { data: feedback, error: feedbackError } = await db
      .from("beta_feedback")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (feedbackError || !feedback) throw new Error("FEEDBACK_NOT_FOUND");
    const { error } = await db
      .from("feedback_replies")
      .insert({ feedback_id: data.id, author_user_id: context.userId, body });
    if (error) throw error;
    if (feedback.status === "new")
      await db
        .from("beta_feedback")
        .update({ status: "reviewing", updated_at: new Date().toISOString() })
        .eq("id", data.id);
    await audit(db, context.userId, "feedback.reply.create", "feedback", data.id, "success");
    return { ok: true };
  });

export const publishPlatformAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: PlatformAnnouncementInput) => validatePlatformAnnouncementInput(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "operations");
    const { error } = await db.rpc("publish_platform_announcement_v3", {
      p_actor_id: context.userId,
      p_request_id: data.requestId,
      p_expected_latest_id: data.expectedLatestId,
      p_announcement_type: data.type,
      p_severity: data.severity,
      p_title_nl: data.titleNl,
      p_title_en: data.titleEn,
      p_body_nl: data.bodyNl,
      p_body_en: data.bodyEn,
      p_status_key: data.statusKey ?? null,
      p_public_status: data.publicStatus,
      p_component_keys: data.componentKeys,
      p_incident_phase: data.phase,
    });
    if (error) {
      if (error.message === "PLATFORM_STATUS_ALREADY_ACTIVE" || error.message === "PLATFORM_STATUS_CHANGED")
        throw new Error(error.message);
      throw new Error("ANNOUNCEMENT_PUBLISH_FAILED");
    }
    // Publication, existing notifications and audit are committed together in SQL.
    return { published: true };
  });

export const listPlatformAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "operations");
    const { data, error } = await db
      .from("platform_announcements")
      .select(
        "id,announcement_type,severity,title_nl,title_en,body_nl,body_en,status_key,published_at,public_status,component_keys,incident_phase",
      )
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const latestStatus = new Set<string>();
    return (data ?? []).map((item: any) => {
      const key = item.status_key as string | null;
      const current =
        item.announcement_type === "status" && Boolean(key) && !latestStatus.has(key!);
      if (key) latestStatus.add(key);
      return { ...item, current };
    });
  });

export const getNotificationDeliveryOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId, "operations");
    const { data, error } = await db
      .from("notifications")
      .select("kind,dismissed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    const rows = data ?? [];
    const byKind = new Map<
      string,
      { kind: string; sent: number; dismissed: number; open: number }
    >();
    for (const row of rows) {
      const value = byKind.get(row.kind) ?? { kind: row.kind, sent: 0, dismissed: 0, open: 0 };
      value.sent += 1;
      if (row.dismissed_at) value.dismissed += 1;
      else value.open += 1;
      byKind.set(row.kind, value);
    }
    await audit(
      db,
      context.userId,
      "notifications.delivery.view",
      "notification",
      null,
      "success",
      { sample: rows.length },
    );
    return { sample: rows.length, groups: [...byKind.values()].sort((a, b) => b.sent - a.sent) };
  });

export const manageAdminRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { kind: "feedback"; id: string; action: "archive" | "restore" | "delete" }) => {
    if (!input || input.kind !== "feedback" || !["archive", "restore", "delete"].includes(input.action)
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.id))
      throw new Error("INVALID_ADMIN_RECORD");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues");
    const table = "beta_feedback";
    if (data.action === "delete") {
      const { error } = await db.from(table).delete().eq("id", data.id);
      if (error) throw error;
    } else {
      const archived_at = data.action === "archive" ? new Date().toISOString() : null;
      const { error } = await db.from(table)
        .update({ archived_at, updated_at: new Date().toISOString() }).eq("id", data.id).select("id").single();
      if (error) throw error;
    }
    await audit(db, context.userId, `feedback.${data.action}`, "feedback", data.id, "success");
    return { ok: true };
  });

export const manageDevelopmentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { kind: "issue"; id: string; action: "archive" | "restore" | "delete" }) =>
      {
        if (!input || input.kind !== "issue" || !["archive", "restore", "delete"].includes(input.action)
          || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.id)) throw new Error("INVALID_DEVELOPMENT_RECORD");
        return input;
      },
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.userId, "issues");
    const table = "known_issues";
    if (data.action === "delete") {
      if (data.kind === "issue") {
        const { data: issue } = await db.from(table).select("*").eq("id", data.id).single();
        if (issue?.github_issue_number) {
          await syncGithub({
            ...issue,
            status: "resolved",
            title_en: `[Removed] ${issue.title_en}`,
            public: false,
          }, db, context.userId);
        }
      }
      const { error } = await db.from(table).delete().eq("id", data.id);
      if (error) throw error;
    } else {
      const archived_at = data.action === "archive" ? new Date().toISOString() : null;
      const { data: row, error } = await db
        .from(table)
        .update({ archived_at, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      if (data.kind === "issue" && row.github_issue_number)
        await syncGithub({ ...row, status: data.action === "archive" ? "resolved" : row.status }, db, context.userId);
    }
    await audit(db, context.userId, `${data.kind}.${data.action}`, data.kind, data.id, "success");
    return { ok: true };
  });
