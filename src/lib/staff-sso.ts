import { safeInternalRedirect } from "./safe-redirect.ts";

export const STAFF_SSO_PROVIDER = "custom:globetrotr-staff" as const;
export const STAFF_SSO_ORIGIN = "https://portal.globetrotr.nl";
export const STAFF_LINK_STORAGE_KEY = "globetrotr.staff-link.v1";

export function managedStaffIdentityMatches(
  expected: { authentik_user_pk: number | null; status: string } | null,
  signedUserPk: unknown,
) {
  return (
    expected === null ||
    (Number.isSafeInteger(expected.authentik_user_pk) &&
      (expected.authentik_user_pk ?? 0) > 0 &&
      signedUserPk === expected.authentik_user_pk &&
      expected.status !== "disabled")
  );
}

export function staffLinkEligible(
  user: { app_metadata?: Record<string, unknown> } | null,
  admin: { active?: boolean; role?: string } | null,
) {
  return (
    user?.app_metadata?.corporate_admin === true &&
    admin?.active === true &&
    ["owner", "admin", "support"].includes(admin.role || "")
  );
}

export function staffLinkVerified(
  expectedId: string,
  user: { id?: string; identities?: { provider: string }[] } | null,
) {
  return Boolean(
    expectedId &&
    user?.id === expectedId &&
    user.identities?.some((identity) => identity.provider === STAFF_SSO_PROVIDER),
  );
}

export function staffLinkOptions() {
  const callback = new URL("/oauth-callback", STAFF_SSO_ORIGIN);
  callback.searchParams.set("next", "/account");
  callback.searchParams.set("linked", STAFF_SSO_PROVIDER);
  return {
    provider: STAFF_SSO_PROVIDER,
    options: { redirectTo: callback.toString(), scopes: "openid email profile" },
  };
}

export function staffLoginVisible(
  enabled: boolean,
  hostname: string,
  mode: string,
  maintenance: boolean,
) {
  return enabled && hostname === "portal.globetrotr.nl" && mode === "signin" && !maintenance;
}

export function staffLoginOptions(destination: unknown, language: string) {
  const callback = new URL("/oauth-callback", STAFF_SSO_ORIGIN);
  const next = safeInternalRedirect(destination);
  callback.searchParams.set("next", next ?? "/corporate-admin");
  callback.searchParams.set("language", language === "nl" ? "nl" : "en");
  callback.searchParams.set("staff", "1");
  return {
    provider: STAFF_SSO_PROVIDER,
    options: { redirectTo: callback.toString(), scopes: "openid email profile" },
  };
}
