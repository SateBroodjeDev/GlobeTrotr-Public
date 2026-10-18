const REDIRECT_ORIGIN = "https://globetrotr.invalid";

/** Returns an internal app path, or undefined for external/ambiguous input. */
export function safeInternalRedirect(value: unknown, maxLength = 500) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) return undefined;
  if (
    !value.startsWith("/") ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return character === "\\" || code <= 31 || code === 127;
    })
  ) return undefined;
  if (/%(?:2f|5c)/i.test(value)) return undefined;
  try {
    const parsed = new URL(value, REDIRECT_ORIGIN);
    if (parsed.origin !== REDIRECT_ORIGIN) return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}
