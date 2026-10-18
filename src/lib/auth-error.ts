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
