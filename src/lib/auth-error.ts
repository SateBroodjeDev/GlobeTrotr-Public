export function localizedAuthError(message: string, language: "nl" | "en") {
  const nl = language === "nl";
  if (
    /error sending confirmation mail|confirmation (?:email|mail).*(?:send|failed)|smtp|gomail|email.*(?:delivery|send).*(?:failed|error)|unexpected_failure|context deadline exceeded|request_timeout/i.test(
      message,
    )
  ) {
    return nl
      ? "De bevestigingsmail kon niet worden verzonden. Je account is daarom nog niet aangemaakt. Probeer het later opnieuw of neem contact op met GlobeTrotr."
      : "The confirmation email could not be sent, so your account has not been created yet. Try again later or contact GlobeTrotr.";
  }
  if (/user already registered|already been registered|already exists/i.test(message)) {
    return nl
      ? "Er bestaat al een account met dit e-mailadres. Log in of vraag een nieuwe inloglink aan."
      : "An account already exists for this email address. Sign in or request a new sign-in link.";
  }
  if (/email rate limit|rate limit.*email|too many requests/i.test(message)) {
    return nl
      ? "Er zijn te veel e-mails aangevraagd. Wacht enkele minuten en probeer het daarna opnieuw."
      : "Too many emails have been requested. Wait a few minutes and try again.";
  }
  if (/invalid login credentials/i.test(message)) {
    return nl ? "E-mailadres of wachtwoord is onjuist." : "The email address or password is incorrect.";
  }
  return message;
}

/** Credential verification is not proof that an account lacks Agency membership. */
export function localizedPasskeyError(error: unknown, language: "nl" | "en", agencyHost = false) {
  const nl = language === "nl";
  const value = error && typeof error === "object" ? error as { code?: unknown; name?: unknown; message?: unknown } : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (code === "AGENCY_ACCESS_REQUIRED" || message === "AGENCY_ACCESS_REQUIRED") return nl
    ? "Dit account heeft geen toegang tot deze Agency. Gebruik een ander account of vraag de organisatie om een uitnodiging."
    : "This account does not have access to this Agency. Use another account or ask the organisation for an invitation.";
  if (value.name === "NotAllowedError" || /cancelled|canceled|timed out/i.test(message)) return nl
    ? "Inloggen met passkey is afgebroken of duurde te lang. Probeer opnieuw of kies een andere inlogmethode."
    : "Passkey sign-in was cancelled or timed out. Try again or choose another sign-in method.";
  if (/credential verification failed/i.test(message) || code === "webauthn_verification_failed") return agencyHost
    ? nl
      ? "Deze passkey kon hier niet worden gebruikt. Probeer een andere inlogmethode met een account dat toegang heeft tot deze Agency."
      : "This passkey could not be used here. Try another sign-in method with an account that has access to this Agency."
    : nl
      ? "Deze passkey kon niet worden gecontroleerd. Probeer opnieuw of log in met een andere methode."
      : "This passkey could not be verified. Try again or use another sign-in method.";
  return nl
    ? "Inloggen met passkey is niet gelukt. Probeer opnieuw of kies een andere inlogmethode."
    : "Passkey sign-in failed. Try again or choose another sign-in method.";
}
