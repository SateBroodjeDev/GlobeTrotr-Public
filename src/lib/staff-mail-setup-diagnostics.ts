export const MAIL_SETUP_PHASES = [
  "begin", "configuration", "state", "challenge", "token", "identity",
  "mail_session", "mail_credential", "save",
] as const;
export type MailSetupPhase = (typeof MAIL_SETUP_PHASES)[number];

export function mailSetupPhase(value: unknown): MailSetupPhase | undefined {
  return MAIL_SETUP_PHASES.find((phase) => phase === value);
}

const codes = new Set([
  "DISABLED", "INVALID_ORIGIN", "MISSING_STATE", "INVALID_STATE", "INVALID_CODE",
  "STALE_CHALLENGE", "SAVE_FAILED", "STAFF_MAIL_IDENTITY_INVALID",
  "STAFF_MAIL_PROVIDER_FAILED", "STAFF_MAIL_RESPONSE_INVALID", "STAFF_MAIL_RESPONSE_TOO_LARGE",
  "STAFF_MAIL_SESSION_REDIRECT_REJECTED",
  "STAFF_MAIL_ACCOUNT_MISMATCH", "STAFF_MAIL_CREDENTIAL_FAILED",
  "STAFF_MAIL_CREDENTIAL_REVOKE_FAILED", "MAILBOX_CREDENTIALS_KEY_MISSING",
  "MAILBOX_CREDENTIALS_KEY_INVALID", "ENCRYPTED_SECRET_INVALID",
]);

export function mailSetupDiagnostic(phase: MailSetupPhase, error: unknown) {
  const value = error as { message?: unknown; providerStatus?: unknown } | null;
  return {
    phase: mailSetupPhase(phase) || "configuration",
    code: typeof value?.message === "string" && codes.has(value.message)
      ? value.message : "UNEXPECTED",
    ...(typeof value?.providerStatus === "number" && Number.isInteger(value.providerStatus) &&
      value.providerStatus >= 100 && value.providerStatus <= 599
      ? { providerStatus: value.providerStatus } : {}),
  };
}
