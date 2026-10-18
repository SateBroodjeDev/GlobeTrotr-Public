import { createServerFn } from "@tanstack/react-start";
import { queueInvitationEmail } from "@/lib/email-outbox.server";
import { mailLocale } from "@/lib/mail-locale";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AGENCY_PERMISSIONS,
  effectiveAgencyPermissions,
  type AgencyPermission,
  type AgencyPermissionMap,
  type AgencyPermissionOverrides,
} from "@/lib/agency-permissions";

export type AgencyRole = "owner" | "advisor" | "finance";
export type AgencyTeamMember = {
  userId: string;
  name: string;
  email: string;
  role: AgencyRole;
  status: "active" | "suspended";
  joinedAt: string | null;
};
export type AgencyInvitation = {
  id: string;
  email: string;
  role: Exclude<AgencyRole, "owner">;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "expired";
  emailStatus: "held" | "pending" | "processing" | "sent" | "failed" | "cancelled" | null;
  emailError: string | null;
};
export type AgencySettings = {
  workspaceId: string;
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
  onboardingCompletedAt: string | null;
};
export type AgencyPermissionSettings = {
  roles: Record<"advisor" | "finance", AgencyPermissionMap>;
  members: { userId: string; role: "advisor" | "finance"; overrides: AgencyPermissionOverrides }[];
};
export type MyAgencyAccess = {
  workspaceId: string;
  role: AgencyRole;
  permissions: AgencyPermissionMap;
  brandName?: string;
};
export type TripBrandingSettings = {
  enabled: boolean;
  brandName: string;
  domain: string;
  tagline: string;
  accent: number | null;
};
export type AgencyClient = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  locale: "nl" | "en";
  notes: string;
  status: "active" | "archived";
  tripIds: string[];
  accessTripIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type AgencyOperationItem = {
  id: string;
  tripId: string;
  tripName: string;
  title: string;
  date: string;
  detail: string;
};
export type AgencyOperations = {
  upcoming: AgencyOperationItem[];
  missingBookings: AgencyOperationItem[];
  billableExpenses: AgencyOperationItem[];
  expiringDocuments: AgencyOperationItem[];
  expiredInvitations: { id: string; email: string; expiresAt: string }[];
};
export type AgencyAuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  context: Record<string, unknown>;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
};
export type AgencyNotificationPreferences = {
  workspaceId: string;
  tripChanges: boolean;
  invitationResponses: boolean;
  clientUpdates: boolean;
};
export type AgencySupplier = {
  id: string;
  type: "accommodation" | "transport" | "activity";
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  bookingTerms: string;
  commissionPercent: number | null;
  notes: string;
  status: "active" | "archived";
  tripIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type AgencyUsage = {
  plan: "agency";
  teamMembers: number;
  pendingInvitations: number;
  activeClients: number;
  activeTrips: number;
  publicTrips: number;
  archivedTrips: number;
};
export type AgencyReport = {
  clients: number;
  activeTrips: number;
  quotes: {
    total: number;
    accepted: number;
    rejected: number;
    open: number;
    conversion: number;
    acceptedValue: number;
  };
  tasks: { open: number; overdue: number; completed: number };
  billable: { count: number; value: number; currency: string };
  automation: {
    taskRemindersEnabled: boolean;
    taskReminderDays: number;
    quoteExpiryEnabled: boolean;
    quoteExpiryDays: number;
    documentExpiryEnabled: boolean;
    documentExpiryDays: number;
  };
  canManage: boolean;
};
export type AgencyTask = {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  tripId: string;
  clientId: string;
  assigneeUserId: string;
  assigneeName: string;
  createdAt: string;
  updatedAt: string;
};
export type AgencyTaskBoard = {
  tasks: AgencyTask[];
  members: { userId: string; name: string }[];
  trips: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  canManage: boolean;
};
export type AgencyTemplate = {
  id: string;
  name: string;
  type: "itinerary" | "packing" | "message";
  items: string[];
  createdAt: string;
  updatedAt: string;
};
export type AgencyContentItem = {
  id: string;
  title: string;
  type: "destination" | "accommodation" | "activity" | "day_block" | "text" | "media";
  status: "draft" | "published";
  visibility: "organization" | "personal";
  locale: "nl" | "en";
  tags: string[];
  summary: string;
  body: string;
  sourceUrl: string;
  licenseLabel: string;
  version: number;
  ownerUserId: string;
  updatedAt: string;
};
export type AgencyContentTarget = {
  id: string;
  name: string;
  kind: "trip" | "quote";
  startDate: string;
  endDate: string;
};
export type AgencyQuoteVariant = { name: string; description: string; amount: number };
export type AgencyQuote = {
  id: string;
  clientId: string;
  clientName: string;
  tripId: string;
  tripName: string;
  title: string;
  introduction: string;
  currency: string;
  status: "draft" | "ready" | "accepted" | "rejected" | "expired" | "cancelled";
  validUntil: string;
  sharedAt: string;
  shareExpiresAt: string;
  variants: AgencyQuoteVariant[];
  createdAt: string;
  updatedAt: string;
};
export type AgencyQuoteBoard = {
  quotes: AgencyQuote[];
  clients: { id: string; name: string }[];
  trips: { id: string; name: string }[];
  canManage: boolean;
};
export type AgencyQuoteShare = { url: string; expiresAt: string };
export type AgencyQuoteConversion = {
  quoteId: string;
  title: string;
  introduction: string;
  clientName: string;
  tripId: string;
  tripName: string;
  convertedTripId: string;
  variantName: string;
  amount: number;
  currency: string;
};
export type AgencyFormField = {
  key: string;
  type: "text" | "textarea" | "email" | "phone" | "date" | "number" | "choice" | "checkbox";
  labelNl: string;
  labelEn: string;
  purpose: string;
  required: boolean;
  visibility: "client";
  options?: string[];
};
export type AgencyFormTemplate = {
  id: string;
  name: string;
  introduction: string;
  fields: AgencyFormField[];
  retentionDays: number;
  updatedAt: string;
};
export type AgencyFormAnswer = string | number | boolean | null;
export type AgencyFormRequest = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  tripId: string;
  tripName: string;
  locale: "nl" | "en";
  expiresAt: string;
  createdAt: string;
  revokedAt: string;
  submittedAt: string;
  responseId: string;
  responseStatus: string;
  answers: Record<string, AgencyFormAnswer>;
};
export type AgencyFormBoard = {
  templates: AgencyFormTemplate[];
  requests: AgencyFormRequest[];
  clients: { id: string; name: string; locale: "nl" | "en"; email: string }[];
  trips: { id: string; name: string }[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function agencyOrigin(db: any, workspaceId: string) {
  const { data } = await db
    .from("agency_domains")
    .select("subdomain,custom_domain,verification_status")
    .eq("workspace_uuid", workspaceId)
    .maybeSingle();
  if (data?.custom_domain && data.verification_status === "verified")
    return `https://${data.custom_domain}`;
  if (data?.subdomain) return `https://${data.subdomain}.globetrotr.nl`;
  return "https://portal.globetrotr.nl";
}

async function agencyAudit(
  db: any,
  workspaceId: string,
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  context: Record<string, unknown> = {},
) {
  const { error } = await db.from("agency_audit_log").insert({
    workspace_uuid: workspaceId,
    actor_user_id: actorId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    context,
  });
  if (error) throw new Error("AGENCY_AUDIT_FAILED");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function ownerWorkspace(db: any, userId: string) {
  const { data, error } = await db
    .from("workspaces")
    .select("workspace_uuid, plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.plan !== "agency") throw new Error("AGENCY_OWNER_REQUIRED");
  return data.workspace_uuid as string;
}

async function workspaceForPermission(db: any, userId: string, permission: AgencyPermission) {
  const { data: owned } = await db
    .from("workspaces")
    .select("workspace_uuid,user_id,plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (owned?.plan === "agency")
    return { workspaceId: owned.workspace_uuid, ownerId: owned.user_id, role: "owner" as const };
  const { data: member } = await db
    .from("workspace_members")
    .select("workspace_uuid,role,permission_overrides")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["advisor", "finance"])
    .maybeSingle();
  if (!member) throw new Error("AGENCY_ACCESS_REQUIRED");
  const [{ data: workspace }, { data: defaults }] = await Promise.all([
    db
      .from("workspaces")
      .select("user_id,plan")
      .eq("workspace_uuid", member.workspace_uuid)
      .maybeSingle(),
    db
      .from("agency_role_permissions")
      .select("permissions")
      .eq("workspace_uuid", member.workspace_uuid)
      .eq("role", member.role)
      .maybeSingle(),
  ]);
  if (
    workspace?.plan !== "agency" ||
    !effectiveAgencyPermissions(member.role, defaults?.permissions, member.permission_overrides)[
      permission
    ]
  )
    throw new Error("AGENCY_PERMISSION_REQUIRED");
  return {
    workspaceId: member.workspace_uuid,
    ownerId: workspace.user_id,
    role: member.role as "advisor" | "finance",
  };
}

export const getMyAgencyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const { data: owned } = await db
      .from("workspaces")
      .select("workspace_uuid, plan")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (owned?.plan === "agency" && owned.workspace_uuid) {
      const { data: settings } = await db
        .from("agency_settings")
        .select("system_name")
        .eq("workspace_uuid", owned.workspace_uuid)
        .maybeSingle();
      return {
        workspaceId: owned.workspace_uuid,
        role: "owner",
        brandName: settings?.system_name ?? undefined,
        permissions: Object.fromEntries(AGENCY_PERMISSIONS.map((permission) => [permission, true])),
      } as MyAgencyAccess;
    }
    const { data: membership, error: membershipError } = await db
      .from("workspace_members")
      .select("workspace_uuid, role, permission_overrides, workspaces!inner(plan)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .in("role", ["advisor", "finance"])
      .maybeSingle();
    if (
      membershipError ||
      !membership ||
      (Array.isArray(membership.workspaces)
        ? membership.workspaces[0]?.plan
        : membership.workspaces?.plan) !== "agency"
    )
      throw new Error("AGENCY_ACCESS_REQUIRED");
    const { data: defaults, error: defaultsError } = await db
      .from("agency_role_permissions")
      .select("permissions")
      .eq("workspace_uuid", membership.workspace_uuid)
      .eq("role", membership.role)
      .maybeSingle();
    if (defaultsError) throw new Error("AGENCY_PERMISSIONS_UNAVAILABLE");
    const { effectiveAgencyPermissions } = await import("@/lib/agency-permissions");
    const { data: settings } = await db
      .from("agency_settings")
      .select("system_name")
      .eq("workspace_uuid", membership.workspace_uuid)
      .maybeSingle();
    return {
      workspaceId: membership.workspace_uuid,
      role: membership.role,
      brandName: settings?.system_name ?? undefined,
      permissions: effectiveAgencyPermissions(
        membership.role,
        defaults?.permissions,
        membership.permission_overrides,
      ),
    } as MyAgencyAccess;
  });

export const getTripBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.tripId)) throw new Error("INVALID_TRIP");
    const db = await adminClient();
    const { data: result, error } = await db.rpc("get_trip_branding", {
      p_actor_id: context.userId,
      p_trip_uuid: data.tripId,
    });
    if (error || !result) throw new Error("TRIP_BRANDING_UNAVAILABLE");
    return {
      enabled: Boolean(result.enabled),
      brandName: result.brandName ?? "",
      domain: result.domain ?? "",
      tagline: result.tagline ?? "",
      accent: typeof result.accent === "number" ? result.accent : null,
    } as TripBrandingSettings;
  });

export const saveTripBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; branding: TripBrandingSettings }) => input)
  .handler(async ({ data, context }) => {
    const branding = {
      enabled: data.branding.enabled,
      brandName: clean(data.branding.brandName, 50),
      domain: clean(data.branding.domain, 120).toLowerCase(),
      tagline: clean(data.branding.tagline, 120),
      accent: data.branding.accent == null ? null : Math.round(data.branding.accent),
    };
    if (
      !UUID.test(data.tripId) ||
      (branding.accent != null && (branding.accent < 0 || branding.accent > 360))
    )
      throw new Error("INVALID_TRIP_BRANDING");
    const db = await adminClient();
    const { data: saved, error } = await db.rpc("save_trip_branding", {
      p_actor_id: context.userId,
      p_trip_uuid: data.tripId,
      p_branding: branding,
    });
    if (error || !saved) throw new Error("TRIP_BRANDING_SAVE_FAILED");
    const { data: trip } = await db
      .from("trips")
      .select("workspace_uuid")
      .eq("trip_uuid", data.tripId)
      .single();
    if (!trip?.workspace_uuid) throw new Error("AGENCY_AUDIT_FAILED");
    await agencyAudit(
      db,
      trip.workspace_uuid,
      context.userId,
      "trip_branding.update",
      "trip",
      data.tripId,
      { enabled: branding.enabled },
    );
    return { ok: true };
  });

const clean = (value: string, max: number) => value.trim().slice(0, max);

export const getAgencyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const { data: clients, error } = await db
      .from("agency_clients")
      .select("id,full_name,email,phone,locale,notes,status,created_at,updated_at")
      .eq("workspace_uuid", access.workspaceId)
      .order("full_name");
    if (error) throw error;
    const ids = (clients ?? []).map((client: any) => client.id);
    const [linkResult, memberResult] = ids.length
      ? await Promise.all([
          db.from("agency_client_trips").select("client_id,trip_uuid").in("client_id", ids),
          db.from("trip_members").select("agency_client_id,trip_uuid").in("agency_client_id", ids),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (linkResult.error || memberResult.error) throw new Error("AGENCY_CLIENTS_UNAVAILABLE");
    return (clients ?? []).map((client: any) => ({
      id: client.id,
      fullName: client.full_name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      locale: client.locale,
      notes: client.notes ?? "",
      status: client.status,
      tripIds: (linkResult.data ?? [])
        .filter((link: any) => link.client_id === client.id)
        .map((link: any) => link.trip_uuid),
      accessTripIds: (memberResult.data ?? [])
        .filter((member: any) => member.agency_client_id === client.id)
        .map((member: any) => member.trip_uuid),
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    })) as AgencyClient[];
  });
export const saveAgencyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      fullName: string;
      email: string;
      phone: string;
      locale: "nl" | "en";
      notes: string;
      tripIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const fullName = clean(data.fullName, 100),
      email = clean(data.email, 254).toLowerCase(),
      phone = clean(data.phone, 40),
      notes = clean(data.notes, 2000);
    if (
      !fullName ||
      (email && !EMAIL.test(email)) ||
      !["nl", "en"].includes(data.locale) ||
      data.tripIds.some((id) => !UUID.test(id))
    )
      throw new Error("INVALID_CLIENT");
    if (data.id && !UUID.test(data.id)) throw new Error("INVALID_CLIENT");
    const { data: clientId, error } = await db.rpc("save_agency_client", {
      p_actor_id: context.userId,
      p_workspace_uuid: access.workspaceId,
      p_client_id: data.id ?? null,
      p_client: { fullName, email, phone, locale: data.locale, notes },
      p_trip_ids: [...new Set(data.tripIds)],
    });
    if (error || !clientId) throw new Error("CLIENT_SAVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "client.update" : "client.create",
      "client",
      clientId as string,
      { tripCount: new Set(data.tripIds).size },
    );
    return { ok: true, id: clientId as string };
  });
export const setAgencyClientArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; archived: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_CLIENT");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const { data: ok, error } = await db.rpc("set_agency_client_archived", {
      p_actor_id: context.userId,
      p_workspace_uuid: access.workspaceId,
      p_client_id: data.id,
      p_archived: data.archived,
    });
    if (error || !ok) throw new Error("CLIENT_STATUS_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.archived ? "client.archive" : "client.restore",
      "client",
      data.id,
    );
    return { ok: true };
  });

const FORM_TYPES = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "date",
  "number",
  "choice",
  "checkbox",
]);
function cleanFormFields(fields: AgencyFormField[]) {
  const seen = new Set<string>();
  const result = fields.slice(0, 40).map((field) => ({
    key: clean(field.key, 40)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_"),
    type: field.type,
    labelNl: clean(field.labelNl, 120),
    labelEn: clean(field.labelEn, 120),
    purpose: clean(field.purpose, 240),
    required: Boolean(field.required),
    visibility: "client" as const,
    ...(field.type === "choice"
      ? {
          options: [
            ...new Set((field.options ?? []).map((x) => clean(x, 100)).filter(Boolean)),
          ].slice(0, 20),
        }
      : {}),
  }));
  for (const field of result) {
    if (
      !/^[a-z][a-z0-9_]{1,39}$/.test(field.key) ||
      seen.has(field.key) ||
      !FORM_TYPES.has(field.type) ||
      !field.labelNl ||
      !field.labelEn ||
      !field.purpose ||
      (field.type === "choice" && !field.options?.length)
    )
      throw new Error("INVALID_FORM_FIELDS");
    seen.add(field.key);
  }
  if (!result.length) throw new Error("INVALID_FORM_FIELDS");
  return result;
}
export const getAgencyFormBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const [templates, requests, clients, trips] = await Promise.all([
      db
        .from("agency_form_templates")
        .select("id,name,introduction,fields,retention_days,updated_at")
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .order("name"),
      db
        .from("agency_form_requests")
        .select(
          "id,title,client_id,trip_uuid,locale,expires_at,created_at,revoked_at,submitted_at,agency_clients(full_name),trips(name),agency_form_responses(id,status,answers)",
        )
        .eq("workspace_uuid", access.workspaceId)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("agency_clients")
        .select("id,full_name,email,locale")
        .eq("workspace_uuid", access.workspaceId)
        .eq("status", "active")
        .order("full_name"),
      db
        .from("trips")
        .select("trip_uuid,name")
        .eq("workspace_uuid", access.workspaceId)
        .eq("archived", false)
        .order("name"),
    ]);
    if ([templates, requests, clients, trips].some((x) => x.error))
      throw new Error("AGENCY_FORMS_UNAVAILABLE");
    return {
      templates: (templates.data ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        introduction: x.introduction ?? "",
        fields: x.fields,
        retentionDays: x.retention_days,
        updatedAt: x.updated_at,
      })),
      requests: (requests.data ?? []).map((x: any) => {
        const response = Array.isArray(x.agency_form_responses)
          ? x.agency_form_responses[0]
          : x.agency_form_responses;
        const client = Array.isArray(x.agency_clients) ? x.agency_clients[0] : x.agency_clients;
        const trip = Array.isArray(x.trips) ? x.trips[0] : x.trips;
        return {
          id: x.id,
          title: x.title,
          clientId: x.client_id,
          clientName: client?.full_name ?? "",
          tripId: x.trip_uuid ?? "",
          tripName: trip?.name ?? "",
          locale: x.locale,
          expiresAt: x.expires_at,
          createdAt: x.created_at,
          revokedAt: x.revoked_at ?? "",
          submittedAt: x.submitted_at ?? "",
          responseId: response?.id ?? "",
          responseStatus: response?.status ?? "",
          answers: response?.answers ?? {},
        };
      }),
      clients: (clients.data ?? []).map((x: any) => ({
        id: x.id,
        name: x.full_name,
        locale: x.locale,
        email: x.email ?? "",
      })),
      trips: (trips.data ?? []).map((x: any) => ({ id: x.trip_uuid, name: x.name })),
    } as AgencyFormBoard;
  });
export const saveAgencyFormTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      name: string;
      introduction: string;
      fields: AgencyFormField[];
      retentionDays: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const name = clean(data.name, 100),
      fields = cleanFormFields(data.fields),
      retentionDays = Math.round(data.retentionDays);
    if (!name || retentionDays < 1 || retentionDays > 730 || (data.id && !UUID.test(data.id)))
      throw new Error("INVALID_FORM_TEMPLATE");
    const values = {
      workspace_uuid: access.workspaceId,
      name,
      introduction: clean(data.introduction, 1000) || null,
      fields,
      retention_days: retentionDays,
      updated_by: context.userId,
    };
    let id = data.id;
    if (id) {
      const r = await db
        .from("agency_form_templates")
        .update(values)
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (r.error || !r.data) throw new Error("FORM_TEMPLATE_SAVE_FAILED");
    } else {
      const r = await db
        .from("agency_form_templates")
        .insert({ ...values, created_by: context.userId })
        .select("id")
        .single();
      if (r.error) throw new Error("FORM_TEMPLATE_SAVE_FAILED");
      id = r.data.id;
    }
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "client_form.template.update" : "client_form.template.create",
      "client_form_template",
      id,
      { fieldCount: fields.length, retentionDays },
    );
    return { ok: true, id };
  });
export const archiveAgencyFormTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { id: string }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_FORM_TEMPLATE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const r = await db
      .from("agency_form_templates")
      .update({ archived_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", data.id)
      .eq("workspace_uuid", access.workspaceId)
      .select("id")
      .maybeSingle();
    if (r.error || !r.data) throw new Error("FORM_TEMPLATE_ARCHIVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "client_form.template.archive",
      "client_form_template",
      data.id,
    );
    return { ok: true };
  });
export const createAgencyFormRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      templateId: string;
      clientId: string;
      tripId: string;
      title: string;
      expiresInDays: number;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    if (
      !UUID.test(data.templateId) ||
      !UUID.test(data.clientId) ||
      (data.tripId && !UUID.test(data.tripId))
    )
      throw new Error("INVALID_FORM_REQUEST");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const [template, client, settings] = await Promise.all([
      db
        .from("agency_form_templates")
        .select("id,name,introduction,fields,retention_days")
        .eq("id", data.templateId)
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .single(),
      db
        .from("agency_clients")
        .select("id,full_name,email,locale")
        .eq("id", data.clientId)
        .eq("workspace_uuid", access.workspaceId)
        .eq("status", "active")
        .single(),
      db
        .from("agency_settings")
        .select("system_name,accent,tagline,logo_path,contact_email")
        .eq("workspace_uuid", access.workspaceId)
        .maybeSingle(),
    ]);
    if (template.error || client.error || settings.error || !client.data.email)
      throw new Error("FORM_REQUEST_DATA_INVALID");
    const plain = token(),
      hash = await sha256(plain),
      days = Math.min(30, Math.max(1, Math.round(data.expiresInDays))),
      expires = new Date(Date.now() + days * 86400000),
      title = clean(data.title, 140) || template.data.name;
    const created = await db
      .from("agency_form_requests")
      .insert({
        workspace_uuid: access.workspaceId,
        template_id: data.templateId,
        client_id: data.clientId,
        trip_uuid: data.tripId || null,
        token_hash: hash,
        title,
        introduction: template.data.introduction,
        fields: template.data.fields,
        locale: client.data.locale,
        expires_at: expires.toISOString(),
        retention_until: new Date(
          expires.getTime() + template.data.retention_days * 86400000,
        ).toISOString(),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (created.error) throw new Error("FORM_REQUEST_CREATE_FAILED");
    const origin = await agencyOrigin(db, access.workspaceId),
      url = `${origin}/client-form/${plain}`;
    const delivery = await queueInvitationEmail(db, {
      recipient: client.data.email,
      locale: mailLocale(client.data.locale),
      title:
        mailLocale(client.data.locale) === "nl"
          ? `Informatie gevraagd: ${title}`
          : `Information requested: ${title}`,
      body:
        mailLocale(client.data.locale) === "nl"
          ? `Hallo ${client.data.full_name}, vul het beveiligde formulier in vóór ${expires.toLocaleDateString("nl-NL")}.`
          : `Hello ${client.data.full_name}, please complete the secure form before ${expires.toLocaleDateString("en-GB")}.`,
      actionUrl: url,
      invitationType: "client_form",
      invitationId: created.data.id,
      branding: {
        brandName: settings.data?.system_name || "GlobeTrotr",
        accentHue: Number(settings.data?.accent ?? 174),
        workspaceId: access.workspaceId,
        portalHost: new URL(origin).hostname,
        tagline: settings.data?.tagline ?? "",
        logoPath: settings.data?.logo_path ?? null,
        contactEmail: settings.data?.contact_email ?? undefined,
      },
    });
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "client_form.request.create",
      "client_form",
      created.data.id,
      { clientId: data.clientId, tripId: data.tripId || null, delivery },
    );
    return { ok: true, id: created.data.id, url, delivery };
  });
export const manageAgencyFormRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { id: string; action: "revoke" | "review" | "process" | "archive" }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_FORM_REQUEST");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const request = await db
      .from("agency_form_requests")
      .select("id,client_id,trip_uuid,revoked_at,agency_form_responses(id,status,answers)")
      .eq("id", data.id)
      .eq("workspace_uuid", access.workspaceId)
      .single();
    if (request.error) throw new Error("FORM_REQUEST_NOT_FOUND");
    const response = Array.isArray(request.data.agency_form_responses)
      ? request.data.agency_form_responses[0]
      : request.data.agency_form_responses;
    if (data.action === "revoke") {
      const update = await db
        .from("agency_form_requests")
        .update({ revoked_at: new Date().toISOString(), token_hash: await sha256(token()) })
        .eq("id", data.id)
        .eq("workspace_uuid", access.workspaceId)
        .select("id")
        .maybeSingle();
      if (update.error || !update.data) throw new Error("FORM_REQUEST_UPDATE_FAILED");
    } else {
      if (!response) throw new Error("FORM_RESPONSE_REQUIRED");
      const now = new Date().toISOString();
      if (data.action === "review") {
        const update = await db
          .from("agency_form_responses")
          .update({ status: "reviewed", reviewed_at: now, reviewed_by: context.userId })
          .eq("id", response.id)
          .select("id")
          .maybeSingle();
        if (update.error || !update.data) throw new Error("FORM_RESPONSE_UPDATE_FAILED");
      }
      if (data.action === "archive") {
        const update = await db
          .from("agency_form_responses")
          .update({ status: "archived", archived_at: now, reviewed_by: context.userId })
          .eq("id", response.id)
          .select("id")
          .maybeSingle();
        if (update.error || !update.data) throw new Error("FORM_RESPONSE_UPDATE_FAILED");
      }
      if (data.action === "process") {
        const client = await db
          .from("agency_clients")
          .select("preferences")
          .eq("id", request.data.client_id)
          .eq("workspace_uuid", access.workspaceId)
          .single();
        if (client.error) throw new Error("CLIENT_NOT_FOUND");
        const clientUpdate = await db
          .from("agency_clients")
          .update({
            preferences: { ...(client.data.preferences ?? {}), intake: response.answers },
            updated_at: now,
            updated_by: context.userId,
          })
          .eq("id", request.data.client_id)
          .eq("workspace_uuid", access.workspaceId)
          .select("id")
          .maybeSingle();
        if (clientUpdate.error || !clientUpdate.data) throw new Error("CLIENT_UPDATE_FAILED");
        const responseUpdate = await db
          .from("agency_form_responses")
          .update({
            status: "processed",
            processed_at: now,
            reviewed_at: now,
            reviewed_by: context.userId,
          })
          .eq("id", response.id)
          .select("id")
          .maybeSingle();
        if (responseUpdate.error || !responseUpdate.data)
          throw new Error("FORM_RESPONSE_UPDATE_FAILED");
      }
    }
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      `client_form.request.${data.action}`,
      "client_form",
      data.id,
      { clientId: request.data.client_id, tripId: request.data.trip_uuid },
    );
    return { ok: true };
  });
export const getPublicAgencyForm = createServerFn({ method: "GET" })
  .validator((x: { token: string }) => x)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{64}$/i.test(data.token)) return { status: "unavailable" };
    const db = await adminClient();
    const result = await db.rpc("get_public_agency_form", {
      p_token_hash: await sha256(data.token),
    });
    if (result.error) throw new Error("FORM_UNAVAILABLE");
    const value = result.data as any;
    if (value?.status === "available" && value.branding?.logoPath) {
      const signed = await db.storage
        .from("agency-logos")
        .createSignedUrl(value.branding.logoPath, 900);
      value.branding.logoUrl = signed.data?.signedUrl ?? null;
      delete value.branding.logoPath;
    }
    return value;
  });
export const submitPublicAgencyForm = createServerFn({ method: "POST" })
  .validator((x: { token: string; answers: Record<string, AgencyFormAnswer> }) => x)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{64}$/i.test(data.token)) return { status: "unavailable" };
    const db = await adminClient();
    const result = await db.rpc("submit_public_agency_form", {
      p_token_hash: await sha256(data.token),
      p_answers: data.answers,
    });
    if (result.error) throw new Error("FORM_SUBMIT_FAILED");
    return { status: result.data as string };
  });

export const getAgencyAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<any> => {
    const db = await adminClient();
    const workspaceId = await ownerWorkspace(db, context.userId);
    const { data, error } = await db
      .from("agency_audit_log")
      .select("id,actor_user_id,action,target_type,target_id,context,created_at")
      .eq("workspace_uuid", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("AGENCY_AUDIT_UNAVAILABLE");
    const actorIds = [
      ...new Set((data ?? []).map((row: any) => row.actor_user_id).filter(Boolean)),
    ] as string[];
    const { data: profiles } = actorIds.length
      ? await db.from("profiles").select("id,display_name,email").in("id", actorIds)
      : { data: [] };
    const names = new Map(
      (profiles ?? []).map((profile: any) => [profile.id, profile.display_name]),
    );
    const emails = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.email]));
    return (data ?? []).map((row: any) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type ?? "",
      targetId: row.target_id ?? "",
      context: row.context ?? {},
      createdAt: row.created_at,
      actorId: row.actor_user_id ?? "",
      actorName: names.get(row.actor_user_id) || "",
      actorEmail: emails.get(row.actor_user_id) || "",
    })) as AgencyAuditEntry[];
  });

export const getAgencyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const { data, error } = await db.rpc("get_agency_notification_preferences", {
      p_user_id: context.userId,
    });
    if (error || !data) throw new Error("AGENCY_NOTIFICATION_PREFERENCES_UNAVAILABLE");
    return data as AgencyNotificationPreferences;
  });

export const getAgencyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "billing_manage");
    const [members, invitations, clients, activeTrips, publicTrips, archivedTrips] =
      await Promise.all([
        db
          .from("workspace_members")
          .select("user_id", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .eq("status", "active"),
        db
          .from("workspace_invitations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .is("accepted_at", null)
          .is("declined_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString()),
        db
          .from("agency_clients")
          .select("id", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .eq("status", "active"),
        db
          .from("trips")
          .select("trip_uuid", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .eq("archived", false),
        db
          .from("trips")
          .select("trip_uuid", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .eq("archived", false)
          .eq("is_public", true),
        db
          .from("trips")
          .select("trip_uuid", { count: "exact", head: true })
          .eq("workspace_uuid", access.workspaceId)
          .eq("archived", true),
      ]);
    if (
      [members, invitations, clients, activeTrips, publicTrips, archivedTrips].some(
        (result) => result.error,
      )
    )
      throw new Error("AGENCY_USAGE_UNAVAILABLE");
    return {
      plan: "agency",
      teamMembers: members.count ?? 0,
      pendingInvitations: invitations.count ?? 0,
      activeClients: clients.count ?? 0,
      activeTrips: activeTrips.count ?? 0,
      publicTrips: publicTrips.count ?? 0,
      archivedTrips: archivedTrips.count ?? 0,
    } as AgencyUsage;
  });
export const getAgencyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "analytics_view");
    const today = new Date().toISOString().slice(0, 10);
    const [clients, trips, quotes, tasks, expenses, settings] = await Promise.all([
      db
        .from("agency_clients")
        .select("id", { count: "exact", head: true })
        .eq("workspace_uuid", access.workspaceId)
        .eq("status", "active"),
      db
        .from("trips")
        .select("trip_uuid")
        .eq("workspace_uuid", access.workspaceId)
        .eq("archived", false),
      db
        .from("agency_quotes")
        .select("status,accepted_variant_id,agency_quote_variants(id,amount)")
        .eq("workspace_uuid", access.workspaceId),
      db.from("agency_tasks").select("status,due_date").eq("workspace_uuid", access.workspaceId),
      db.from("trip_expenses").select("amount,currency,trip_uuid,billable").eq("billable", true),
      db
        .from("agency_automation_settings")
        .select("*")
        .eq("workspace_uuid", access.workspaceId)
        .maybeSingle(),
    ]);
    if ([clients, trips, quotes, tasks, expenses, settings].some((x) => x.error))
      throw new Error("AGENCY_REPORT_UNAVAILABLE");
    const tripIds = new Set((trips.data ?? []).map((x: any) => x.trip_uuid));
    const relevantExpenses = (expenses.data ?? []).filter((x: any) => tripIds.has(x.trip_uuid));
    const accepted = (quotes.data ?? []).filter((x: any) => x.status === "accepted");
    const acceptedValue = accepted.reduce(
      (sum: number, q: any) =>
        sum +
        Number(
          (q.agency_quote_variants ?? []).find((v: any) => v.id === q.accepted_variant_id)
            ?.amount ?? 0,
        ),
      0,
    );
    let canManage = true;
    try {
      await workspaceForPermission(db, context.userId, "trips_plan");
    } catch {
      canManage = false;
    }
    const s = settings.data ?? {};
    return {
      clients: clients.count ?? 0,
      activeTrips: tripIds.size,
      quotes: {
        total: (quotes.data ?? []).length,
        accepted: accepted.length,
        rejected: (quotes.data ?? []).filter((q: any) => q.status === "rejected").length,
        open: (quotes.data ?? []).filter((q: any) => ["draft", "ready"].includes(q.status)).length,
        conversion: (quotes.data ?? []).length
          ? Math.round((accepted.length / (quotes.data ?? []).length) * 100)
          : 0,
        acceptedValue,
      },
      tasks: {
        open: (tasks.data ?? []).filter((t: any) => ["open", "in_progress"].includes(t.status))
          .length,
        overdue: (tasks.data ?? []).filter(
          (t: any) =>
            ["open", "in_progress"].includes(t.status) && t.due_date && t.due_date < today,
        ).length,
        completed: (tasks.data ?? []).filter((t: any) => t.status === "done").length,
      },
      billable: {
        count: relevantExpenses.length,
        value: relevantExpenses.reduce((n: number, x: any) => n + Number(x.amount), 0),
        currency: relevantExpenses[0]?.currency ?? "EUR",
      },
      automation: {
        taskRemindersEnabled: s.task_reminders_enabled ?? true,
        taskReminderDays: s.task_reminder_days ?? 3,
        quoteExpiryEnabled: s.quote_expiry_enabled ?? true,
        quoteExpiryDays: s.quote_expiry_days ?? 3,
        documentExpiryEnabled: s.document_expiry_enabled ?? true,
        documentExpiryDays: s.document_expiry_days ?? 30,
      },
      canManage,
    } as AgencyReport;
  });
export const saveAgencyAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: AgencyReport["automation"]) => x)
  .handler(async ({ data, context }) => {
    if (
      data.taskReminderDays < 1 ||
      data.taskReminderDays > 30 ||
      data.quoteExpiryDays < 1 ||
      data.quoteExpiryDays > 30 ||
      data.documentExpiryDays < 1 ||
      data.documentExpiryDays > 180
    )
      throw new Error("INVALID_AUTOMATION");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const { error } = await db.from("agency_automation_settings").upsert({
      workspace_uuid: access.workspaceId,
      task_reminders_enabled: data.taskRemindersEnabled,
      task_reminder_days: data.taskReminderDays,
      quote_expiry_enabled: data.quoteExpiryEnabled,
      quote_expiry_days: data.quoteExpiryDays,
      document_expiry_enabled: data.documentExpiryEnabled,
      document_expiry_days: data.documentExpiryDays,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("AUTOMATION_SAVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "automation.settings.update",
      "workspace",
      access.workspaceId,
      data,
    );
    return { ok: true };
  });
export const saveAgencyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Omit<AgencyNotificationPreferences, "workspaceId">) => input)
  .handler(async ({ data, context }) => {
    if (
      [data.tripChanges, data.invitationResponses, data.clientUpdates].some(
        (value) => typeof value !== "boolean",
      )
    )
      throw new Error("INVALID_NOTIFICATION_PREFERENCES");
    const db = await adminClient();
    const { data: ok, error } = await db.rpc("save_agency_notification_preferences", {
      p_user_id: context.userId,
      p_preferences: data,
    });
    if (error || !ok) throw new Error("AGENCY_NOTIFICATION_PREFERENCES_SAVE_FAILED");
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "notifications.preferences.update",
      "member",
      context.userId,
    );
    return { ok: true };
  });

export const getAgencySuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    const { data, error } = await db
      .from("agency_suppliers")
      .select(
        "id,supplier_type,name,contact_name,email,phone,website,booking_terms,commission_percent,notes,status,created_at,updated_at,agency_supplier_trips(trip_uuid)",
      )
      .eq("workspace_uuid", access.workspaceId)
      .order("name");
    if (error) throw new Error("AGENCY_SUPPLIERS_UNAVAILABLE");
    return (data ?? []).map((s: any) => ({
      id: s.id,
      type: s.supplier_type,
      name: s.name,
      contactName: s.contact_name ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      website: s.website ?? "",
      bookingTerms: s.booking_terms ?? "",
      commissionPercent: s.commission_percent == null ? null : Number(s.commission_percent),
      notes: s.notes ?? "",
      status: s.status,
      tripIds: (s.agency_supplier_trips ?? []).map((x: any) => x.trip_uuid),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })) as AgencySupplier[];
  });
export const saveAgencySupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      type: AgencySupplier["type"];
      name: string;
      contactName: string;
      email: string;
      phone: string;
      website: string;
      bookingTerms: string;
      commissionPercent: number | null;
      notes: string;
      tripIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const payload = {
      type: data.type,
      name: clean(data.name, 120),
      contactName: clean(data.contactName, 100),
      email: clean(data.email, 254).toLowerCase(),
      phone: clean(data.phone, 40),
      website: clean(data.website, 300),
      bookingTerms: clean(data.bookingTerms, 2000),
      commissionPercent: data.commissionPercent,
      notes: clean(data.notes, 2000),
    };
    if (
      !payload.name ||
      !(["accommodation", "transport", "activity"] as string[]).includes(payload.type) ||
      (data.id && !UUID.test(data.id)) ||
      data.tripIds.some((id) => !UUID.test(id)) ||
      (payload.commissionPercent != null &&
        (payload.commissionPercent < 0 || payload.commissionPercent > 100))
    )
      throw new Error("INVALID_SUPPLIER");
    const { data: id, error } = await db.rpc("save_agency_supplier", {
      p_actor_id: context.userId,
      p_workspace_uuid: access.workspaceId,
      p_supplier_id: data.id ?? null,
      p_supplier: payload,
      p_trip_ids: data.tripIds,
    });
    if (error || !id) throw new Error("AGENCY_SUPPLIER_SAVE_FAILED");
    await agencyAudit(db, access.workspaceId, context.userId, "supplier.save", "supplier", id);
    return { id: String(id) };
  });
export const setAgencySupplierArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; archived: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_SUPPLIER");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const { data: ok, error } = await db.rpc("set_agency_supplier_archived", {
      p_actor_id: context.userId,
      p_workspace_uuid: access.workspaceId,
      p_supplier_id: data.id,
      p_archived: data.archived,
    });
    if (error || !ok) throw new Error("AGENCY_SUPPLIER_STATUS_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.archived ? "supplier.archive" : "supplier.restore",
      "supplier",
      data.id,
    );
    return { ok: true };
  });

export const getAgencyOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "analytics_view");
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: trips, error: tripError }, { data: expired, error: inviteError }] =
      await Promise.all([
        db
          .from("trips")
          .select("trip_uuid,name,start_date,end_date,archived")
          .eq("workspace_uuid", access.workspaceId)
          .order("start_date"),
        db
          .from("workspace_invitations")
          .select("id,email,expires_at")
          .eq("workspace_uuid", access.workspaceId)
          .is("accepted_at", null)
          .is("declined_at", null)
          .is("revoked_at", null)
          .lt("expires_at", new Date().toISOString())
          .order("expires_at"),
      ]);
    if (tripError || inviteError) throw new Error("AGENCY_OPERATIONS_UNAVAILABLE");
    const tripIds = (trips ?? []).map((trip: any) => trip.trip_uuid);
    const [
      { data: travelItems, error: travelError },
      { data: expenses, error: expenseError },
      { data: documents },
    ] = tripIds.length
      ? await Promise.all([
          db
            .from("trip_travel_items")
            .select("id,trip_uuid,item_type,title,start_date,provider,booking_reference")
            .in("trip_uuid", tripIds),
          db
            .from("trip_expenses")
            .select("id,trip_uuid,title,expense_date,amount,currency,billable")
            .in("trip_uuid", tripIds)
            .eq("billable", true),
          db
            .from("trip_documents")
            .select("id,trip_uuid,file_name,document_type,expires_on")
            .in("trip_uuid", tripIds)
            .not("expires_on", "is", null)
            .lte("expires_on", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
            .order("expires_on"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [] }];
    if (travelError || expenseError) throw new Error("AGENCY_OPERATIONS_UNAVAILABLE");
    const travelByTrip = new Map<string, any[]>(),
      expensesByTrip = new Map<string, any[]>();
    for (const item of travelItems ?? []) {
      const list = travelByTrip.get(item.trip_uuid) ?? [];
      list.push(item);
      travelByTrip.set(item.trip_uuid, list);
    }
    for (const expense of expenses ?? []) {
      const list = expensesByTrip.get(expense.trip_uuid) ?? [];
      list.push(expense);
      expensesByTrip.set(expense.trip_uuid, list);
    }
    const upcoming: AgencyOperationItem[] = [],
      missingBookings: AgencyOperationItem[] = [],
      billableExpenses: AgencyOperationItem[] = [];
    for (const trip of trips ?? []) {
      const tripId = String(trip.trip_uuid),
        tripName = String(trip.name);
      if (!trip.archived && trip.end_date >= today)
        upcoming.push({
          id: tripId,
          tripId,
          tripName,
          title: tripName,
          date: trip.start_date ?? "",
          detail: trip.end_date ?? "",
        });
      for (const item of travelByTrip.get(tripId) ?? []) {
        if (
          item.start_date >= today &&
          item.item_type !== "activity" &&
          (!item.provider || !item.booking_reference)
        )
          missingBookings.push({
            id: String(item.id),
            tripId,
            tripName,
            title: String(item.title),
            date: item.start_date ?? "",
            detail: [!item.provider ? "provider" : "", !item.booking_reference ? "reference" : ""]
              .filter(Boolean)
              .join(","),
          });
      }
      for (const expense of expensesByTrip.get(tripId) ?? [])
        billableExpenses.push({
          id: String(expense.id),
          tripId,
          tripName,
          title: String(expense.title),
          date: expense.expense_date ?? "",
          detail: `${expense.currency} ${expense.amount}`,
        });
    }
    const tripNames = new Map(
      (trips ?? []).map((trip: any) => [String(trip.trip_uuid), String(trip.name)]),
    );
    const expiringDocuments: AgencyOperationItem[] = (documents ?? [])
      .slice(0, 30)
      .map((item: any) => ({
        id: String(item.id),
        tripId: String(item.trip_uuid),
        tripName: tripNames.get(String(item.trip_uuid)) ?? "",
        title: String(item.file_name),
        date: String(item.expires_on),
        detail: String(item.document_type),
      }));
    return {
      upcoming: upcoming.slice(0, 30),
      missingBookings: missingBookings.slice(0, 30),
      billableExpenses: billableExpenses.slice(0, 30),
      expiringDocuments,
      expiredInvitations: (expired ?? [])
        .slice(0, 30)
        .map((item: any) => ({ id: item.id, email: item.email, expiresAt: item.expires_at })),
    } as AgencyOperations;
  });

export const getAgencyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    const [{ data: tasks, error }, { data: members }, { data: trips }, { data: clients }] =
      await Promise.all([
        db
          .from("agency_tasks")
          .select(
            "id,title,notes,due_date,priority,status,trip_uuid,client_id,assignee_user_id,created_at,updated_at",
          )
          .eq("workspace_uuid", access.workspaceId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_uuid", access.workspaceId)
          .eq("status", "active")
          .in("role", ["owner", "advisor", "finance"]),
        db
          .from("trips")
          .select("trip_uuid,name")
          .eq("workspace_uuid", access.workspaceId)
          .eq("archived", false)
          .order("start_date"),
        db
          .from("agency_clients")
          .select("id,full_name")
          .eq("workspace_uuid", access.workspaceId)
          .eq("status", "active")
          .order("full_name"),
      ]);
    if (error) throw new Error("AGENCY_TASKS_UNAVAILABLE");
    const memberIds = (members ?? []).map((member: any) => member.user_id);
    const { data: profiles } = memberIds.length
      ? await db.from("profiles").select("id,display_name").in("id", memberIds)
      : { data: [] };
    const profileNames = new Map(
      (profiles ?? []).map((profile: any) => [profile.id, profile.display_name]),
    );
    const memberOptions = (members ?? []).map((member: any) => ({
      userId: String(member.user_id),
      name: String(
        profileNames.get(member.user_id) ||
          (member.user_id === context.userId ? "Jij" : member.user_id),
      ),
    }));
    let canManage = true;
    try {
      await workspaceForPermission(db, context.userId, "trips_plan");
    } catch {
      canManage = false;
    }
    return {
      tasks: (tasks ?? []).map((task: any) => ({
        id: task.id,
        title: task.title,
        notes: task.notes ?? "",
        dueDate: task.due_date ?? "",
        priority: task.priority,
        status: task.status,
        tripId: task.trip_uuid ?? "",
        clientId: task.client_id ?? "",
        assigneeUserId: task.assignee_user_id ?? "",
        assigneeName: profileNames.get(task.assignee_user_id) ?? "",
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      })),
      members: memberOptions,
      trips: (trips ?? []).map((trip: any) => ({ id: trip.trip_uuid, name: trip.name })),
      clients: (clients ?? []).map((client: any) => ({ id: client.id, name: client.full_name })),
      canManage,
    } as AgencyTaskBoard;
  });

export const saveAgencyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      title: string;
      notes: string;
      dueDate: string;
      priority: AgencyTask["priority"];
      status: AgencyTask["status"];
      tripId: string;
      clientId: string;
      assigneeUserId: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const title = clean(data.title, 120),
      notes = clean(data.notes, 1000);
    if (
      !title ||
      !(["low", "normal", "high", "urgent"] as string[]).includes(data.priority) ||
      !(["open", "in_progress", "done", "cancelled"] as string[]).includes(data.status) ||
      (data.id && !UUID.test(data.id)) ||
      (data.tripId && !UUID.test(data.tripId)) ||
      (data.clientId && !UUID.test(data.clientId)) ||
      (data.assigneeUserId && !UUID.test(data.assigneeUserId))
    )
      throw new Error("INVALID_TASK");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    let id = data.id;
    if (id) {
      const { data: existing } = await db
        .from("agency_tasks")
        .select("assignee_user_id")
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId)
        .maybeSingle();
      if (!existing) throw new Error("TASK_NOT_FOUND");
      const { error } = await db
        .from("agency_tasks")
        .update({
          title,
          notes: notes || null,
          due_date: data.dueDate || null,
          priority: data.priority,
          status: data.status,
          trip_uuid: data.tripId || null,
          client_id: data.clientId || null,
          assignee_user_id: data.assigneeUserId || null,
          updated_by: context.userId,
        })
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId);
      if (error) throw new Error("TASK_SAVE_FAILED");
    } else {
      const { data: created, error } = await db
        .from("agency_tasks")
        .insert({
          workspace_uuid: access.workspaceId,
          title,
          notes: notes || null,
          due_date: data.dueDate || null,
          priority: data.priority,
          status: data.status,
          trip_uuid: data.tripId || null,
          client_id: data.clientId || null,
          assignee_user_id: data.assigneeUserId || null,
          created_by: context.userId,
          updated_by: context.userId,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error("TASK_SAVE_FAILED");
      id = created.id;
    }
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "task.update" : "task.create",
      "task",
      id,
      { status: data.status, priority: data.priority, assigned: Boolean(data.assigneeUserId) },
    );
    return { ok: true, id };
  });

export const getAgencyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    const { data, error } = await db
      .from("agency_templates")
      .select("id,name,template_type,content,created_at,updated_at")
      .eq("workspace_uuid", access.workspaceId)
      .is("archived_at", null)
      .order("template_type")
      .order("name");
    if (error) throw new Error("AGENCY_TEMPLATES_UNAVAILABLE");
    return (data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.template_type,
      items: Array.isArray(item.content) ? item.content : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) as AgencyTemplate[];
  });
export const saveAgencyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { id?: string; name: string; type: AgencyTemplate["type"]; items: string[] }) => input,
  )
  .handler(async ({ data, context }) => {
    const name = clean(data.name, 80),
      items = [...new Set(data.items.map((item) => clean(item, 1000)).filter(Boolean))].slice(
        0,
        100,
      );
    if (
      !name ||
      !(["itinerary", "packing", "message"] as string[]).includes(data.type) ||
      !items.length ||
      (data.id && !UUID.test(data.id))
    )
      throw new Error("INVALID_TEMPLATE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    let id = data.id;
    if (id) {
      const { data: updated, error } = await db
        .from("agency_templates")
        .update({ name, template_type: data.type, content: items, updated_by: context.userId })
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (error || !updated) throw new Error("TEMPLATE_SAVE_FAILED");
    } else {
      const { data: created, error } = await db
        .from("agency_templates")
        .insert({
          workspace_uuid: access.workspaceId,
          name,
          template_type: data.type,
          content: items,
          created_by: context.userId,
          updated_by: context.userId,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error("TEMPLATE_SAVE_FAILED");
      id = created.id;
    }
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "template.update" : "template.create",
      "template",
      id,
      { type: data.type, itemCount: items.length },
    );
    return { ok: true, id };
  });
export const archiveAgencyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_TEMPLATE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const { data: updated, error } = await db
      .from("agency_templates")
      .update({ archived_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", data.id)
      .eq("workspace_uuid", access.workspaceId)
      .select("id")
      .maybeSingle();
    if (error || !updated) throw new Error("TEMPLATE_ARCHIVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "template.archive",
      "template",
      data.id,
    );
    return { ok: true };
  });

export const getAgencyContentLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    let canManage = true;
    try {
      await workspaceForPermission(db, context.userId, "trips_plan");
    } catch {
      canManage = false;
    }
    const [result, trips, quotes] = await Promise.all([
      db
        .from("agency_content_library")
        .select(
          "id,title,content_type,status,visibility,locale,tags,content,source_url,license_label,version,owner_user_id,updated_at",
        )
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
      db
        .from("trips")
        .select("trip_uuid,name,start_date,end_date")
        .eq("workspace_uuid", access.workspaceId)
        .eq("archived", false)
        .order("start_date", { ascending: false }),
      db
        .from("agency_quotes")
        .select("id,title,status")
        .eq("workspace_uuid", access.workspaceId)
        .in("status", ["draft", "ready"])
        .order("updated_at", { ascending: false }),
    ]);
    if (result.error || trips.error || quotes.error)
      throw new Error("AGENCY_CONTENT_LIBRARY_UNAVAILABLE");
    return {
      canManage,
      items: (result.data ?? [])
        .filter((x: any) => x.visibility === "organization" || x.owner_user_id === context.userId)
        .map((x: any) => ({
          id: x.id,
          title: x.title,
          type: x.content_type,
          status: x.status,
          visibility: x.visibility,
          locale: x.locale,
          tags: x.tags ?? [],
          summary: String(x.content?.summary ?? ""),
          body: String(x.content?.body ?? ""),
          sourceUrl: x.source_url ?? "",
          licenseLabel: x.license_label ?? "",
          version: x.version,
          ownerUserId: x.owner_user_id,
          updatedAt: x.updated_at,
        })) as AgencyContentItem[],
      targets: [
        ...(trips.data ?? []).map((x: any) => ({
          id: x.trip_uuid,
          name: x.name,
          kind: "trip",
          startDate: x.start_date ?? "",
          endDate: x.end_date ?? "",
        })),
        ...(quotes.data ?? []).map((x: any) => ({
          id: x.id,
          name: x.title,
          kind: "quote",
          startDate: "",
          endDate: "",
        })),
      ] as AgencyContentTarget[],
    };
  });
export const saveAgencyContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      id?: string;
      title: string;
      type: AgencyContentItem["type"];
      status: AgencyContentItem["status"];
      visibility: AgencyContentItem["visibility"];
      locale: AgencyContentItem["locale"];
      tags: string[];
      summary: string;
      body: string;
      sourceUrl: string;
      licenseLabel: string;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    const title = clean(data.title, 120),
      summary = clean(data.summary, 500),
      body = clean(data.body, 20000),
      tags = [...new Set(data.tags.map((x) => clean(x.toLowerCase(), 40)).filter(Boolean))].slice(
        0,
        20,
      ),
      sourceUrl = data.sourceUrl.trim(),
      licenseLabel = clean(data.licenseLabel, 200);
    if (
      !title ||
      !body ||
      !(
        ["destination", "accommodation", "activity", "day_block", "text", "media"] as string[]
      ).includes(data.type) ||
      (data.id && !UUID.test(data.id)) ||
      (sourceUrl && !/^https:\/\//.test(sourceUrl))
    )
      throw new Error("INVALID_CONTENT_LIBRARY_ITEM");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const values = {
      title,
      content_type: data.type,
      status: data.status,
      visibility: data.visibility,
      locale: data.locale,
      tags,
      content: { summary, body },
      source_url: sourceUrl || null,
      license_label: licenseLabel || null,
      updated_by: context.userId,
      reviewed_at: data.status === "published" ? new Date().toISOString() : null,
    };
    let id = data.id;
    if (id) {
      const existing = await db
        .from("agency_content_library")
        .select("owner_user_id,visibility")
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .maybeSingle();
      if (
        !existing.data ||
        (existing.data.visibility === "personal" && existing.data.owner_user_id !== context.userId)
      )
        throw new Error("CONTENT_LIBRARY_SAVE_FAILED");
      const result = await db
        .from("agency_content_library")
        .update(values)
        .eq("id", id)
        .eq("workspace_uuid", access.workspaceId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (result.error || !result.data) throw new Error("CONTENT_LIBRARY_SAVE_FAILED");
    } else {
      const result = await db
        .from("agency_content_library")
        .insert({
          ...values,
          workspace_uuid: access.workspaceId,
          owner_user_id: context.userId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (result.error) throw new Error("CONTENT_LIBRARY_SAVE_FAILED");
      id = result.data.id;
    }
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "content_library.update" : "content_library.create",
      "content_library",
      id,
      { type: data.type, status: data.status, visibility: data.visibility },
    );
    return { ok: true, id };
  });
export const archiveAgencyContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { id: string }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_CONTENT_LIBRARY_ITEM");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const existing = await db
      .from("agency_content_library")
      .select("owner_user_id,visibility")
      .eq("id", data.id)
      .eq("workspace_uuid", access.workspaceId)
      .is("archived_at", null)
      .maybeSingle();
    if (
      !existing.data ||
      (existing.data.visibility === "personal" && existing.data.owner_user_id !== context.userId)
    )
      throw new Error("CONTENT_LIBRARY_ARCHIVE_FAILED");
    const result = await db
      .from("agency_content_library")
      .update({ archived_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", data.id)
      .eq("workspace_uuid", access.workspaceId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("CONTENT_LIBRARY_ARCHIVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "content_library.archive",
      "content_library",
      data.id,
    );
    return { ok: true };
  });
export const applyAgencyContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: { itemId: string; targetType: "trip" | "quote"; targetId: string; targetDate?: string }) =>
      x,
  )
  .handler(async ({ data, context }) => {
    if (
      !UUID.test(data.itemId) ||
      !UUID.test(data.targetId) ||
      !(["trip", "quote"] as string[]).includes(data.targetType) ||
      (data.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate))
    )
      throw new Error("INVALID_CONTENT_APPLICATION");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const result = await db.rpc("apply_agency_content_item", {
      p_workspace_uuid: access.workspaceId,
      p_actor: context.userId,
      p_content_item_id: data.itemId,
      p_target_type: data.targetType,
      p_target_id: data.targetId,
      p_target_date: data.targetDate || null,
    });
    if (result.error)
      throw new Error(
        result.error.message.includes("QUOTE_TOO_LONG")
          ? "CONTENT_APPLICATION_QUOTE_TOO_LONG"
          : result.error.message.includes("DATE_OUTSIDE")
            ? "CONTENT_APPLICATION_DATE_OUTSIDE_TRIP"
            : "CONTENT_APPLICATION_FAILED",
      );
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "content_library.apply",
      data.targetType,
      data.targetId,
      { contentItemId: data.itemId, result: result.data },
    );
    return { ok: true, result: result.data as "applied" | "duplicate" };
  });

export const getAgencySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "branding_manage");
    const workspaceId = access.workspaceId;
    const [{ data, error }, { data: onboarding }] = await Promise.all([
      db.rpc("get_agency_settings", { p_owner_id: access.ownerId }),
      db.from("agency_settings").select("onboarding_completed_at").eq("workspace_uuid", workspaceId).maybeSingle(),
    ]);
    if (error || !data) throw new Error("AGENCY_SETTINGS_UNAVAILABLE");
    return {
      workspaceId,
      systemName: data.systemName,
      senderName: data.senderName,
      contactEmail: data.contactEmail,
      defaultLocale: data.defaultLocale,
      timezone: data.timezone,
      currency: data.currency,
      domain: data.domain,
      tagline: data.tagline,
      accent: data.accent,
      logoPath: data.logoPath,
      onboardingCompletedAt: onboarding?.onboarding_completed_at ?? null,
    } as AgencySettings;
  });

export const saveAgencySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Omit<AgencySettings, "workspaceId" | "onboardingCompletedAt">) => input)
  .handler(async ({ data, context }) => {
    const values = {
      systemName: clean(data.systemName, 50),
      senderName: clean(data.senderName, 60),
      contactEmail: data.contactEmail.trim().toLowerCase(),
      defaultLocale: data.defaultLocale,
      timezone: clean(data.timezone, 50),
      currency: data.currency.trim().toUpperCase(),
      domain: clean(data.domain, 120).toLowerCase(),
      tagline: clean(data.tagline, 120),
      accent: Math.round(data.accent),
      logoPath: data.logoPath,
    };
    if (
      !values.systemName ||
      !values.senderName ||
      !EMAIL.test(values.contactEmail) ||
      !["nl", "en"].includes(values.defaultLocale) ||
      !/^[A-Z]{3}$/.test(values.currency) ||
      !values.timezone ||
      values.accent < 0 ||
      values.accent > 360
    )
      throw new Error("INVALID_AGENCY_SETTINGS");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "branding_manage");
    const { data: result, error } = await db.rpc("save_agency_settings", {
      p_owner_id: access.ownerId,
      p_settings: values,
    });
    if (error || !result?.ok) throw new Error("AGENCY_SETTINGS_SAVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "settings.update",
      "workspace",
      access.workspaceId,
      { restored: result.restored ?? [] },
    );
    return result as { ok: true; restored: string[] };
  });

export const completeAgencyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "branding_manage");
    if (access.ownerId !== context.userId) throw new Error("AGENCY_OWNER_REQUIRED");
    const { error } = await db.from("agency_settings").update({
      onboarding_completed_at: new Date().toISOString(),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }).eq("workspace_uuid", access.workspaceId);
    if (error) throw new Error("AGENCY_ONBOARDING_SAVE_FAILED");
    await agencyAudit(db, access.workspaceId, context.userId, "onboarding.complete", "workspace", access.workspaceId);
    return { ok: true };
  });

function validPermissions(value: AgencyPermissionOverrides, complete = false) {
  const keys = Object.keys(value);
  return (
    (!complete || keys.length === AGENCY_PERMISSIONS.length) &&
    keys.every(
      (key) =>
        (AGENCY_PERMISSIONS as readonly string[]).includes(key) &&
        typeof value[key as AgencyPermission] === "boolean",
    )
  );
}

export const getAgencyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const { data, error } = await db.rpc("get_agency_permissions", { p_owner_id: context.userId });
    if (error || !data) throw new Error("AGENCY_PERMISSIONS_UNAVAILABLE");
    return { roles: data.roles, members: data.members ?? [] } as AgencyPermissionSettings;
  });
export const saveAgencyRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { role: "advisor" | "finance"; permissions: AgencyPermissionMap }) => input)
  .handler(async ({ data, context }) => {
    if (!["advisor", "finance"].includes(data.role) || !validPermissions(data.permissions, true))
      throw new Error("INVALID_PERMISSIONS");
    const db = await adminClient();
    const { data: ok, error } = await db.rpc("save_agency_role_permissions", {
      p_owner_id: context.userId,
      p_role: data.role,
      p_permissions: data.permissions,
    });
    if (error || !ok) throw new Error("PERMISSIONS_SAVE_FAILED");
    const workspaceId = await ownerWorkspace(db, context.userId);
    await agencyAudit(
      db,
      workspaceId,
      context.userId,
      "permissions.role.update",
      "role",
      data.role,
    );
    return { ok: true };
  });
export const saveAgencyMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; overrides: AgencyPermissionOverrides }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.userId) || !validPermissions(data.overrides))
      throw new Error("INVALID_PERMISSIONS");
    const db = await adminClient();
    const { data: ok, error } = await db.rpc("save_agency_member_permissions", {
      p_owner_id: context.userId,
      p_member_user_id: data.userId,
      p_overrides: data.overrides,
    });
    if (error || !ok) throw new Error("PERMISSIONS_SAVE_FAILED");
    const workspaceId = await ownerWorkspace(db, context.userId);
    await agencyAudit(
      db,
      workspaceId,
      context.userId,
      "permissions.member.update",
      "member",
      data.userId,
      { overrides: Object.keys(data.overrides) },
    );
    return { ok: true };
  });

export const getAgencyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const workspaceId = (await workspaceForPermission(db, context.userId, "members_manage"))
      .workspaceId;
    const [{ data: members, error: memberError }, { data: invitations, error: invitationError }] =
      await Promise.all([
        db
          .from("workspace_members")
          .select("user_id, role, status, joined_at")
          .eq("workspace_uuid", workspaceId)
          .order("role"),
        db
          .from("workspace_invitations")
          .select("id, email, role, created_at, expires_at")
          .eq("workspace_uuid", workspaceId)
          .is("accepted_at", null)
          .is("declined_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false }),
      ]);
    if (memberError || invitationError) throw memberError ?? invitationError;
    const invitationIds = (invitations ?? []).map((item: any) => item.id);
    const deliveryResult = invitationIds.length
      ? await db
          .from("email_outbox")
          .select("invitation_id,status,last_error_code,created_at")
          .eq("invitation_type", "agency")
          .in("invitation_id", invitationIds)
          .order("created_at", { ascending: false })
      : { data: [] };
    if (deliveryResult.error) throw deliveryResult.error;
    const latestDelivery = new Map<string, any>();
    for (const delivery of deliveryResult.data ?? [])
      if (!latestDelivery.has(delivery.invitation_id))
        latestDelivery.set(delivery.invitation_id, delivery);
    const detailed = await Promise.all(
      (members ?? []).map(async (member: any) => {
        const [{ data: profile }, authResult] = await Promise.all([
          db.from("profiles").select("display_name").eq("id", member.user_id).maybeSingle(),
          db.auth.admin.getUserById(member.user_id),
        ]);
        const email = String(authResult.data?.user?.email ?? "");
        return {
          userId: member.user_id,
          name: profile?.display_name || email || "Team member",
          email,
          role: member.role,
          status: member.status,
          joinedAt: member.joined_at,
        } as AgencyTeamMember;
      }),
    );
    const now = Date.now();
    return {
      members: detailed,
      invitations: (invitations ?? []).map((item: any) => ({
        id: item.id,
        email: item.email,
        role: item.role,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
        status: Date.parse(item.expires_at) <= now ? "expired" : "pending",
        emailStatus: latestDelivery.get(item.id)?.status ?? null,
        emailError: latestDelivery.get(item.id)?.last_error_code ?? null,
      })) as AgencyInvitation[],
    };
  });

export const createAgencyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string; role: "advisor" | "finance" }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!EMAIL.test(email) || !["advisor", "finance"].includes(data.role))
      throw new Error("INVALID_INPUT");
    const db = await adminClient();
    const workspaceId = (await workspaceForPermission(db, context.userId, "members_manage"))
      .workspaceId;
    const rawToken = token();
    const { data: invitation, error } = await db
      .from("workspace_invitations")
      .insert({
        workspace_uuid: workspaceId,
        email,
        role: data.role,
        token_hash: await sha256(rawToken),
        invited_by: context.userId,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select("id, expires_at")
      .single();
    if (error)
      throw new Error(error.code === "23505" ? "INVITATION_EXISTS" : "INVITATION_CREATE_FAILED");
    await agencyAudit(
      db,
      workspaceId,
      context.userId,
      "invitation.create",
      "invitation",
      invitation.id,
      { role: data.role },
    );
    const [{ data: settings }, { data: recipient }] = await Promise.all([
      db
        .from("agency_settings")
        .select("system_name,accent,tagline,logo_path,contact_email")
        .eq("workspace_uuid", workspaceId)
        .maybeSingle(),
      db.from("profiles").select("id,locale").ilike("email", email).maybeSingle(),
    ]);
    const agencyName = settings?.system_name ?? "GlobeTrotr Agency";
    const origin = await agencyOrigin(db, workspaceId);
    const mailDelivery = await queueInvitationEmail(db, {
      recipient: email,
      preferenceUserId: recipient?.id,
      locale: mailLocale(recipient?.locale),
      title: `Uitnodiging voor ${agencyName} / Invitation to ${agencyName}`,
      body: `Je bent als ${data.role} uitgenodigd voor het team van ${agencyName}. Bekijk je rol en accepteer de persoonlijke uitnodiging binnen zeven dagen. / You have been invited to the ${agencyName} team as ${data.role}. Review your role and accept this personal invitation within seven days.`,
      actionUrl: `${origin}/agency-invite/${rawToken}`,
      invitationType: "agency",
      invitationId: invitation.id,
      branding: {
        brandName: agencyName,
        accentHue: Number(settings?.accent ?? 174),
        workspaceId,
        portalHost: new URL(origin).hostname,
        tagline: settings?.tagline ?? "",
        logoPath: settings?.logo_path ?? null,
        contactEmail: settings?.contact_email ?? undefined,
      },
    });
    return {
      id: invitation.id as string,
      token: rawToken,
      expiresAt: invitation.expires_at as string,
      mailDelivery,
    };
  });

export const manageAgencyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { invitationId: string; action: "renew" | "revoke" }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.invitationId)) throw new Error("INVALID_INPUT");
    const rawToken = data.action === "renew" ? token() : "";
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const { data: result, error } = await db.rpc("manage_workspace_invitation", {
      p_invitation_id: data.invitationId,
      p_owner_id: access.ownerId,
      p_action: data.action,
      p_token_hash: rawToken ? await sha256(rawToken) : null,
    });
    if (error || !result || result.status !== (data.action === "renew" ? "renewed" : "revoked"))
      throw new Error("AGENCY_INVITATION_MANAGEMENT_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      `invitation.${data.action}`,
      "invitation",
      data.invitationId,
    );
    let mailDelivery: "queued" | "skipped" | "failed" | undefined;
    if (data.action === "renew") {
      const [{ data: invitation }, { data: settings }] = await Promise.all([
        db.from("workspace_invitations").select("email").eq("id", data.invitationId).single(),
        db
          .from("agency_settings")
          .select("system_name,accent,tagline,logo_path,contact_email")
          .eq("workspace_uuid", access.workspaceId)
          .maybeSingle(),
      ]);
      const { data: recipient } = await db
        .from("profiles")
        .select("id,locale")
        .ilike("email", invitation?.email ?? "")
        .maybeSingle();
      const agencyName = settings?.system_name ?? "GlobeTrotr Agency";
      const origin = await agencyOrigin(db, access.workspaceId);
      if (invitation?.email)
        mailDelivery = await queueInvitationEmail(db, {
          recipient: invitation.email,
          preferenceUserId: recipient?.id,
          locale: mailLocale(recipient?.locale),
          title: `Uitnodiging voor ${agencyName} / Invitation to ${agencyName}`,
          body: `Je vernieuwde uitnodiging voor ${agencyName} staat klaar. / Your renewed invitation to ${agencyName} is ready.`,
          actionUrl: `${origin}/agency-invite/${rawToken}`,
          invitationType: "agency",
          invitationId: data.invitationId,
          branding: {
            brandName: agencyName,
            accentHue: Number(settings?.accent ?? 174),
            workspaceId: access.workspaceId,
            portalHost: new URL(origin).hostname,
            tagline: settings?.tagline ?? "",
            logoPath: settings?.logo_path ?? null,
            contactEmail: settings?.contact_email ?? undefined,
          },
        });
    }
    return { ...result, token: rawToken || undefined, mailDelivery } as {
      status: "renewed" | "revoked";
      token?: string;
      expiresAt?: string;
      mailDelivery?: "queued" | "skipped" | "failed";
    };
  });

export const manageAgencyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      userId: string;
      action: "role" | "suspend" | "restore" | "remove";
      role?: "advisor" | "finance";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.userId) || (data.action === "role" && !data.role))
      throw new Error("INVALID_INPUT");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "members_manage");
    const { data: result, error } = await db.rpc("manage_workspace_member", {
      p_member_user_id: data.userId,
      p_owner_id: access.ownerId,
      p_action: data.action,
      p_role: data.role ?? null,
    });
    if (error || !result?.ok) throw new Error("AGENCY_MEMBER_MANAGEMENT_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      `member.${data.action}`,
      "member",
      data.userId,
      data.role ? { role: data.role } : {},
    );
    return result as { ok: true };
  });

export const getAgencyInvitation = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{64}$/i.test(data.token)) return { status: "invalid" as const };
    const db = await adminClient();
    const { data: row } = await db
      .from("workspace_invitations")
      .select("id, role, expires_at, accepted_at, declined_at, revoked_at, workspaces(data)")
      .eq("token_hash", await sha256(data.token))
      .maybeSingle();
    if (!row) return { status: "invalid" as const };
    const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    const status = row.revoked_at
      ? "revoked"
      : row.accepted_at
        ? "accepted"
        : row.declined_at
          ? "declined"
          : Date.parse(row.expires_at) <= Date.now()
            ? "expired"
            : "pending";
    return {
      status,
      invitationId: row.id as string,
      role: row.role as "advisor" | "finance",
      expiresAt: row.expires_at as string,
      workspaceName: String(workspace?.data?.branding?.brandName ?? "GlobeTrotr Agency"),
    };
  });

export const respondToAgencyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { response: "accept" | "decline"; token?: string; invitationId?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    let tokenHash =
      data.token && /^[0-9a-f]{64}$/i.test(data.token) ? await sha256(data.token) : "";
    if (!tokenHash && data.invitationId && UUID.test(data.invitationId)) {
      const { data: invitation } = await db
        .from("workspace_invitations")
        .select("token_hash")
        .eq("id", data.invitationId)
        .maybeSingle();
      tokenHash = invitation?.token_hash ?? "";
    }
    if (!tokenHash) throw new Error("INVALID_INVITATION");
    const { data: invitation } = await db
      .from("workspace_invitations")
      .select("id,workspace_uuid")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const { data: result, error } = await db.rpc("respond_workspace_invitation", {
      p_token_hash: tokenHash,
      p_user_id: context.userId,
      p_response: data.response,
    });
    if (error || !result) throw new Error("AGENCY_INVITATION_RESPONSE_FAILED");
    if (["accepted", "declined"].includes(result.status) && invitation?.workspace_uuid)
      await agencyAudit(
        db,
        invitation.workspace_uuid,
        context.userId,
        `invitation.${data.response}`,
        "invitation",
        invitation.id,
      );
    return result as {
      status: "accepted" | "declined" | "expired" | "revoked" | "forbidden";
      workspaceId?: string;
    };
  });

export const getAgencyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_view");
    const [{ data: quotes, error }, { data: variants }, { data: clients }, { data: trips }] =
      await Promise.all([
        db
          .from("agency_quotes")
          .select(
            "id,client_id,trip_uuid,title,introduction,currency,status,valid_until,shared_at,share_expires_at,created_at,updated_at",
          )
          .eq("workspace_uuid", access.workspaceId)
          .order("updated_at", { ascending: false }),
        db
          .from("agency_quote_variants")
          .select("quote_id,name,description,amount,position")
          .order("position"),
        db
          .from("agency_clients")
          .select("id,full_name")
          .eq("workspace_uuid", access.workspaceId)
          .eq("status", "active")
          .order("full_name"),
        db
          .from("trips")
          .select("trip_uuid,name")
          .eq("workspace_uuid", access.workspaceId)
          .eq("archived", false)
          .order("start_date"),
      ]);
    if (error) throw new Error("AGENCY_QUOTES_UNAVAILABLE");
    let canManage = true;
    try {
      await workspaceForPermission(db, context.userId, "trips_plan");
    } catch {
      canManage = false;
    }
    const clientNames = new Map((clients ?? []).map((x: any) => [x.id, x.full_name])),
      tripNames = new Map((trips ?? []).map((x: any) => [x.trip_uuid, x.name]));
    return {
      quotes: (quotes ?? []).map((q: any) => ({
        id: q.id,
        clientId: q.client_id,
        clientName: clientNames.get(q.client_id) ?? "",
        tripId: q.trip_uuid ?? "",
        tripName: tripNames.get(q.trip_uuid) ?? "",
        title: q.title,
        introduction: q.introduction ?? "",
        currency: q.currency,
        status: q.status,
        validUntil: q.valid_until ?? "",
        sharedAt: q.shared_at ?? "",
        shareExpiresAt: q.share_expires_at ?? "",
        variants: (variants ?? [])
          .filter((v: any) => v.quote_id === q.id)
          .map((v: any) => ({
            name: v.name,
            description: v.description ?? "",
            amount: Number(v.amount),
          })),
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
      clients: (clients ?? []).map((x: any) => ({ id: x.id, name: x.full_name })),
      trips: (trips ?? []).map((x: any) => ({ id: x.trip_uuid, name: x.name })),
      canManage,
    } as AgencyQuoteBoard;
  });

export const saveAgencyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      clientId: string;
      tripId: string;
      title: string;
      introduction: string;
      currency: string;
      status: AgencyQuote["status"];
      validUntil: string;
      variants: AgencyQuoteVariant[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const title = clean(data.title, 120),
      introduction = clean(data.introduction, 3000),
      currency = data.currency.trim().toUpperCase(),
      variants = data.variants.slice(0, 10).map((v) => ({
        name: clean(v.name, 80),
        description: clean(v.description, 2000),
        amount: Number(v.amount),
      }));
    if (
      (data.id && !UUID.test(data.id)) ||
      !UUID.test(data.clientId) ||
      (data.tripId && !UUID.test(data.tripId)) ||
      !title ||
      !/^[A-Z]{3}$/.test(currency) ||
      !(["draft", "ready", "cancelled"] as string[]).includes(data.status) ||
      !variants.length ||
      variants.some((v) => !v.name || !Number.isFinite(v.amount) || v.amount < 0)
    )
      throw new Error("INVALID_QUOTE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const { data: id, error } = await db.rpc("save_agency_quote", {
      p_workspace_uuid: access.workspaceId,
      p_quote_id: data.id ?? null,
      p_payload: {
        clientId: data.clientId,
        tripId: data.tripId,
        title,
        introduction,
        currency,
        status: data.status,
        validUntil: data.validUntil,
      },
      p_variants: variants,
      p_actor_id: context.userId,
    });
    if (error || !id) throw new Error("QUOTE_SAVE_FAILED");
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      data.id ? "quote.update" : "quote.create",
      "quote",
      String(id),
      { status: data.status, variantCount: variants.length },
    );
    return { ok: true, id: String(id) };
  });

export const createAgencyQuoteShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.quoteId)) throw new Error("INVALID_QUOTE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const rawToken = token(),
      expiresAt = new Date(Date.now() + 14 * 86400000).toISOString();
    const { error } = await db.rpc("prepare_agency_quote_share", {
      p_workspace_uuid: access.workspaceId,
      p_quote_id: data.quoteId,
      p_token_hash: await sha256(rawToken),
      p_expires_at: expiresAt,
      p_actor_id: context.userId,
    });
    if (error)
      throw new Error(
        error.code === "PGRST202" ? "QUOTE_SHARING_UNAVAILABLE" : "QUOTE_SHARE_FAILED",
      );
    await agencyAudit(
      db,
      access.workspaceId,
      context.userId,
      "quote.share",
      "quote",
      data.quoteId,
      { expiresAt },
    );
    return { url: `/quote/${rawToken}`, expiresAt } as AgencyQuoteShare;
  });

export const getAgencyQuoteConversion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.quoteId)) throw new Error("INVALID_QUOTE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_create");
    const { data: q, error } = await db
      .from("agency_quotes")
      .select(
        "id,title,introduction,currency,status,trip_uuid,converted_trip_uuid,accepted_variant_id,agency_clients(full_name)",
      )
      .eq("workspace_uuid", access.workspaceId)
      .eq("id", data.quoteId)
      .maybeSingle();
    if (error || !q || q.status !== "accepted" || !q.accepted_variant_id)
      throw new Error("QUOTE_NOT_ACCEPTED");
    const { data: v } = await db
      .from("agency_quote_variants")
      .select("name,amount")
      .eq("quote_id", q.id)
      .eq("id", q.accepted_variant_id)
      .maybeSingle();
    if (!v) throw new Error("QUOTE_VARIANT_MISSING");
    let tripName = "";
    if (q.trip_uuid) {
      const { data: t } = await db
        .from("trips")
        .select("name")
        .eq("workspace_uuid", access.workspaceId)
        .eq("trip_uuid", q.trip_uuid)
        .maybeSingle();
      if (!t) throw new Error("LINKED_TRIP_UNAVAILABLE");
      tripName = t.name;
    }
    const client = Array.isArray(q.agency_clients) ? q.agency_clients[0] : q.agency_clients;
    return {
      quoteId: q.id,
      title: q.title,
      introduction: q.introduction ?? "",
      clientName: client?.full_name ?? "",
      tripId: q.trip_uuid ?? "",
      tripName,
      convertedTripId: q.converted_trip_uuid ?? "",
      variantName: v.name,
      amount: Number(v.amount),
      currency: q.currency,
    } as AgencyQuoteConversion;
  });

export const convertAgencyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { quoteId: string; name: string; start: string; end: string; template: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const name = clean(data.name, 30);
    if (
      !UUID.test(data.quoteId) ||
      !name ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.end) ||
      data.end < data.start ||
      ![
        "citytrip",
        "roadtrip",
        "backpacking",
        "beach",
        "winter",
        "business",
        "safari",
        "cruise",
      ].includes(data.template)
    )
      throw new Error("INVALID_TRIP");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_create");
    const { data: tripId, error } = await db.rpc("convert_agency_quote", {
      p_workspace_uuid: access.workspaceId,
      p_quote_id: data.quoteId,
      p_actor_id: context.userId,
      p_trip: { name, start: data.start, end: data.end, template: data.template },
    });
    if (error || !tripId) throw new Error(error?.message ?? "QUOTE_CONVERSION_FAILED");
    return { ok: true, tripId: String(tripId) };
  });

export const revokeAgencyQuoteShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.quoteId)) throw new Error("INVALID_QUOTE");
    const db = await adminClient();
    const access = await workspaceForPermission(db, context.userId, "trips_plan");
    const { data: revoked, error } = await db.rpc("revoke_agency_quote_share", {
      p_workspace_uuid: access.workspaceId,
      p_quote_id: data.quoteId,
      p_actor_id: context.userId,
    });
    if (error)
      throw new Error(
        error.code === "PGRST202"
          ? "QUOTE_SHARE_MANAGEMENT_UNAVAILABLE"
          : "QUOTE_SHARE_REVOKE_FAILED",
      );
    return { ok: true, revoked: Boolean(revoked) };
  });
