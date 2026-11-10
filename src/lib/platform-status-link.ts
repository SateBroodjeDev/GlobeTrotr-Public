export const PUBLIC_STATUS_URL = "https://status.globetrotr.nl/";

export function publicStatusUrl(locale: string) {
  return `${PUBLIC_STATUS_URL}?lang=${locale === "en-GB" ? "en" : "nl"}`;
}

/** Only documented public parameters survive redirects from retired status pages. */
export function legacyStatusUrl(searchStr: string, hash = "") {
  const source = new URLSearchParams(searchStr), target = new URL(PUBLIC_STATUS_URL);
  for (const [key, allowed] of [["lang", ["nl", "en"]], ["days", ["7", "30"]]] as const) {
    const value = source.get(key);
    if (value && (allowed as readonly string[]).includes(value)) target.searchParams.set(key, value);
  }
  target.hash = hash;
  return target.href;
}
