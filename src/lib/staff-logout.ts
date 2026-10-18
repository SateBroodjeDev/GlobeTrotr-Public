import { STAFF_SSO_PROVIDER, STAFF_LINK_STORAGE_KEY } from "./staff-sso.ts";

export function staffLogoutDestination(user: {
  identities?: { provider: string }[];
  app_metadata?: Record<string, unknown>;
} | null) {
  if (!user?.identities?.some((identity) => identity.provider === STAFF_SSO_PROVIDER) &&
      user?.app_metadata?.corporate_admin !== true) return null;
  // The User Logout stage ends the central Authentik session. An OAuth
  // end-session endpoint alone can leave that session active.
  const url = new URL("https://sso.globetrotr.nl/if/flow/globetrotr-logout/");
  url.searchParams.set("next", "https://portal.globetrotr.nl/auth");
  return url.toString();
}

export async function logoutGbt(options: {
  prepare: () => Promise<{ redirect: string | null }>;
  signOut: () => Promise<{ error: unknown }>;
  clear: () => void;
  redirect: (url: string) => void;
}) {
  // Revoke the server proof while the GBT bearer session is still available.
  const result = await options.prepare();
  const session = await options.signOut();
  if (session.error) throw new Error("SIGN_OUT_FAILED");
  options.clear();
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(STAFF_LINK_STORAGE_KEY);
  } catch { /* Storage restrictions must not prevent central logout. */ }
  options.redirect(result.redirect || "/auth");
}
