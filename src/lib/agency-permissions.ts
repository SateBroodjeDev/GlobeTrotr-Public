import type { Trip } from "./types";
import type { TripMemberRole } from "./types";

export const AGENCY_PERMISSIONS = [
  "trips_view", "trips_create", "trips_plan", "expenses_manage",
  "trip_settings_manage", "members_manage", "analytics_view",
  "branding_manage", "billing_manage",
] as const;
export type AgencyPermission = typeof AGENCY_PERMISSIONS[number];
export type AgencyPermissionMap = Record<AgencyPermission, boolean>;
export type AgencyPermissionOverrides = Partial<AgencyPermissionMap>;

export const AGENCY_ROLE_DEFAULTS: Record<"advisor"|"finance",AgencyPermissionMap> = {
  advisor: { trips_view:true,trips_create:true,trips_plan:true,expenses_manage:true,trip_settings_manage:false,members_manage:false,analytics_view:true,branding_manage:false,billing_manage:false },
  finance: { trips_view:true,trips_create:false,trips_plan:false,expenses_manage:true,trip_settings_manage:false,members_manage:false,analytics_view:true,branding_manage:false,billing_manage:false },
};
export const OWNER_PERMISSIONS: AgencyPermissionMap = Object.fromEntries(AGENCY_PERMISSIONS.map(key=>[key,true])) as AgencyPermissionMap;

export type EffectiveTripAccess = {
  role: TripMemberRole;
  agencyPermissions?: AgencyPermissionMap;
};

/** Een actief Agency-lidmaatschap met kijkrecht gaat voor een oude per-reisrol. */
export function resolveEffectiveTripAccess(
  tripRole: TripMemberRole | null,
  agencyRole: "advisor" | "finance" | null,
  agencyPermissions?: AgencyPermissionMap,
): EffectiveTripAccess | null {
  if (agencyRole && agencyPermissions?.trips_view) {
    return { role: agencyRole, agencyPermissions };
  }
  return tripRole ? { role: tripRole } : null;
}

export function canManageTripMembers(
  isOwner: boolean,
  isAgency: boolean,
  agencyRole: "advisor" | "finance" | null,
  permissions?: AgencyPermissionMap,
) {
  return isOwner || Boolean(isAgency && agencyRole && permissions?.members_manage);
}

/** Gebruik persoonlijke Agency-rechten zodra die geladen zijn en voorkom dat
 * rolstandaarden tijdens het laden kortstondig onbevoegde knoppen tonen. */
export function resolveTripCapability(
  agencyAccessPending: boolean,
  permissions: AgencyPermissionMap | undefined,
  permission: AgencyPermission,
  roleFallback: boolean,
) {
  if (permissions) return permissions[permission];
  return agencyAccessPending ? false : roleFallback;
}

export function effectiveAgencyPermissions(role:"owner"|"advisor"|"finance",defaults?:AgencyPermissionOverrides|null,overrides?:AgencyPermissionOverrides|null):AgencyPermissionMap{
  if(role==="owner")return OWNER_PERMISSIONS;
  return {...AGENCY_ROLE_DEFAULTS[role],...defaults,...overrides};
}

/** Houd elk reisveld waarvoor geen effectief Agency-recht bestaat gelijk aan de databaseversie. */
export function protectAgencyTripUpdate(current:Trip,submitted:Trip,permissions:AgencyPermissionMap):Trip{
  let next:Trip={...current,revision:submitted.revision};
  if(permissions.trips_plan) next={...submitted,members:current.members,expenses:current.expenses,archived:current.archived,public:current.public,shareFinancials:current.shareFinancials,sharePinHash:current.sharePinHash};
  if(permissions.expenses_manage) next={...next,expenses:submitted.expenses};
  if(permissions.members_manage) next={...next,members:submitted.members};
  if(permissions.trip_settings_manage) next={...next,name:submitted.name,description:submitted.description,start:submitted.start,end:submitted.end,budget:submitted.budget,archived:submitted.archived,public:submitted.public,shareFinancials:submitted.shareFinancials,sharePinHash:submitted.sharePinHash};
  return next;
}
