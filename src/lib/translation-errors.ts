export function translationDraftMessage(error: unknown, text: (nl: string, en: string) => string) {
  const message = error instanceof Error ? error.message : String(error);
  const messages = {
    TRANSLATION_NOT_CONFIGURED: [
      "De vertaalservice is nog niet ingesteld.",
      "The translation service is not configured yet.",
    ],
    TRANSLATION_TIMEOUT: [
      "De vertaalservice reageerde niet op tijd. Probeer het opnieuw.",
      "The translation service did not respond in time. Try again.",
    ],
    TRANSLATION_UNAVAILABLE: [
      "De vertaalservice is niet bereikbaar. Controleer de service op Node-02.",
      "The translation service is unreachable. Check the service on Node-02.",
    ],
    TRANSLATION_ACCESS_DENIED: [
      "De vertaalservice weigert toegang. Controleer de serverconfiguratie.",
      "The translation service denied access. Check the server configuration.",
    ],
    TRANSLATION_RATE_LIMITED: [
      "Er zijn te veel vertaalverzoeken. Wacht even en probeer opnieuw.",
      "There are too many translation requests. Wait briefly and try again.",
    ],
    INVALID_TRANSLATION_REQUEST: [
      "Gebruik 2 tot 5.000 tekens en kies verschillende bron- en doeltalen.",
      "Use 2 to 5,000 characters and choose different source and target languages.",
    ],
    FORBIDDEN: [
      "Je hebt geen toegang tot deze vertaalfunctie.",
      "You do not have access to this translation feature.",
    ],
  } as const;
  const code = Object.keys(messages).find((code) => message.includes(code)) as
    keyof typeof messages | undefined;
  return code
    ? text(messages[code][0], messages[code][1])
    : text(
        "De vertaalservice kon geen bruikbaar concept maken. Probeer het later opnieuw.",
        "The translation service could not create a usable draft. Try again later.",
      );
}
