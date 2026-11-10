export type SupportedLocale = "nl-NL" | "en-GB";

export function supportedLocale(value: unknown): SupportedLocale | undefined {
  return value === "nl-NL" || value === "en-GB" ? value : undefined;
}

/** A manual choice wins while saving; a verified account wins over a public URL. */
export function resolveLocale({ choice, account, url, stored }: {
  choice?: SupportedLocale;
  account?: SupportedLocale;
  url?: SupportedLocale;
  stored: SupportedLocale;
}): SupportedLocale {
  return choice ?? account ?? url ?? stored;
}

export function profileLocale(profile: unknown, metadataLanguage: unknown): SupportedLocale | undefined {
  return supportedLocale(profile) ?? (metadataLanguage === "en" ? "en-GB" : metadataLanguage === "nl" ? "nl-NL" : undefined);
}
