import { agencyHostLookup } from "./agency-domain.ts";

/** Carry Agency scope through the already permitted central Auth callback.
 * The mail hook verifies the saved hostname and membership before issuing mail.
 */
export function agencyAuthEmailRedirect(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || !agencyHostLookup(url.hostname)) return null;
  const callback = new URL("https://portal.globetrotr.nl/oauth-callback");
  callback.searchParams.set("agency_email_host", url.hostname.toLowerCase());
  return callback.toString();
}

export function isPrivateAgencyEmailRejection(error: { code?: string; message?: string } | null) {
  return Boolean(error && (["otp_disabled", "user_not_found", "user_banned"].includes(error.code || "")
    || /signups not allowed for otp/i.test(error.message || "")));
}

export function authEmailType(value: unknown) {
  return value === "recovery" ||
    value === "magiclink" ||
    value === "email_change" ||
    value === "invite"
    ? value
    : ("email" as const);
}

export function authEmailDestination(type: string, isStaff: boolean) {
  if (isStaff) return "/team-login";
  return type === "recovery" ? "/reset-password" : "/dashboard";
}

export function recoveryCallback(origin: string) {
  return new URL("/reset-password", origin).toString();
}

export function authEmailHasError(search: string, hash: string) {
  return [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ""))]
    .some(params => ["error", "error_code", "error_description"].some(key => params.has(key)));
}
