import { canManageTripMembers, effectiveAgencyPermissions, type AgencyPermission } from "@/lib/agency-permissions";

type DatabaseClient = any;

export type TripManagementAccess = {
  ownerId: string;
  workspaceId: string;
  isAgency: boolean;
};

/** Controleer eigenaarschap of een expliciet recht binnen de actieve Agency-workspace. */
export async function requireTripManagementAccess(
  db: DatabaseClient,
  actorId: string,
  tripId: string,
  permission: AgencyPermission,
): Promise<TripManagementAccess> {
  const { data: trip, error: tripError } = await db.from("trips")
    .select("workspace_user_id, workspace_uuid")
    .eq("trip_uuid", tripId)
    .maybeSingle();
  if (tripError || !trip) throw new Error("TRIP_NOT_FOUND");

  const { data: workspace, error: workspaceError } = await db.from("workspaces")
    .select("plan")
    .eq("workspace_uuid", trip.workspace_uuid)
    .maybeSingle();
  if (workspaceError || !workspace) throw new Error("TRIP_NOT_FOUND");
  const result = {
    ownerId: String(trip.workspace_user_id),
    workspaceId: String(trip.workspace_uuid),
    isAgency: workspace.plan === "agency",
  };
  if (result.ownerId === actorId) return result;
  if (!result.isAgency) throw new Error("TRIP_OWNER_REQUIRED");

  const { data: member, error: memberError } = await db.from("workspace_members")
    .select("role, permission_overrides")
    .eq("workspace_uuid", result.workspaceId)
    .eq("user_id", actorId)
    .eq("status", "active")
    .in("role", ["advisor", "finance"])
    .maybeSingle();
  if (memberError || !member) throw new Error("AGENCY_PERMISSION_REQUIRED");
  const { data: defaults, error: defaultsError } = await db.from("agency_role_permissions")
    .select("permissions")
    .eq("workspace_uuid", result.workspaceId)
    .eq("role", member.role)
    .maybeSingle();
  const permissions = effectiveAgencyPermissions(member.role, defaults?.permissions, member.permission_overrides);
  const allowed = permission === "members_manage"
    ? canManageTripMembers(false, result.isAgency, member.role, permissions)
    : permissions[permission];
  if (defaultsError || !allowed) {
    throw new Error("AGENCY_PERMISSION_REQUIRED");
  }
  return result;
}

export async function recordTripManagementAudit(
  db: DatabaseClient,
  access: TripManagementAccess,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
) {
  if (!access.isAgency) return;
  const { error } = await db.from("agency_audit_log").insert({
    workspace_uuid: access.workspaceId,
    actor_user_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
  });
  if (error) throw new Error("AGENCY_AUDIT_FAILED");
}
