export type MaintenanceWindow = {
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export function maintenanceIsActive(state: MaintenanceWindow, now = Date.now()) {
  const starts = state.startsAt ? Date.parse(state.startsAt) : null;
  const ends = state.endsAt ? Date.parse(state.endsAt) : null;
  return Boolean(state.active) && (!starts || starts <= now) && (!ends || ends > now);
}

export function maintenanceShouldAutoClose(state: MaintenanceWindow, now = Date.now()) {
  const ends = state.endsAt ? Date.parse(state.endsAt) : Number.NaN;
  return Boolean(state.active) && Number.isFinite(ends) && ends <= now;
}

export function maintenanceAllowsPath(pathname: string, corporateAdmin: boolean) {
  if (pathname === "/auth" || pathname === "/oauth-callback") return true;
  return corporateAdmin && (pathname === "/corporate-admin" || pathname.startsWith("/corporate-admin/"));
}
