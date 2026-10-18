export type StaffAccountStatus = { isStaff: boolean; enforced: boolean; verifiedSession: boolean };
export function staffLoginRequired(status: StaffAccountStatus) {
  return status.isStaff && status.enforced && !status.verifiedSession;
}

// Used only as a cache discriminator. Authorization always comes from the server.
export function authSessionCacheId(token?: string) {
  try {
    if (!token) return "none";
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.session_id === "string" ? claims.session_id : "unknown";
  } catch {
    return "unknown";
  }
}
