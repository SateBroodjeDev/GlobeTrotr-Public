/** Match the application mail boundary: explicit Dutch, otherwise English. */
export function mailLocale(value) {
  return /^nl(?:-|$)/i.test(String(value ?? "").trim()) ? "nl" : "en";
}
