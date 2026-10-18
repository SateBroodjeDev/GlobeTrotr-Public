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
