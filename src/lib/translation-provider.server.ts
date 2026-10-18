export type TranslationFailure =
  | "TRANSLATION_NOT_CONFIGURED"
  | "INVALID_TRANSLATION_REQUEST"
  | "TRANSLATION_TIMEOUT"
  | "TRANSLATION_UNAVAILABLE"
  | "TRANSLATION_ACCESS_DENIED"
  | "TRANSLATION_RATE_LIMITED"
  | "TRANSLATION_PROVIDER_FAILED"
  | "TRANSLATION_PROVIDER_INVALID";
export type TranslationDraftResult =
  { translated: string; errorCode?: undefined } | { translated: ""; errorCode: TranslationFailure };
export async function fetchTranslationDraft(
  input: {
    endpoint?: string;
    apiKey?: string;
    text: string;
    source: "nl" | "en";
    target: "nl" | "en";
  },
  fetcher: typeof fetch = fetch,
): Promise<TranslationDraftResult> {
  const fail = (errorCode: TranslationFailure): TranslationDraftResult => ({
    translated: "",
    errorCode,
  });
  if (!input.endpoint?.trim()) return fail("TRANSLATION_NOT_CONFIGURED");
  const value = input.text.trim();
  if (
    value.length < 2 ||
    value.length > 5000 ||
    !["nl", "en"].includes(input.source) ||
    !["nl", "en"].includes(input.target) ||
    input.source === input.target
  )
    return fail("INVALID_TRANSLATION_REQUEST");
  try {
    const apiKey = input.apiKey?.trim();
    const response = await fetcher(input.endpoint.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        q: value,
        source: input.source,
        target: input.target,
        format: "text",
        api_key: apiKey || undefined,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 401 || response.status === 403)
      return fail("TRANSLATION_ACCESS_DENIED");
    if (response.status === 429) return fail("TRANSLATION_RATE_LIMITED");
    if (!response.ok) return fail("TRANSLATION_PROVIDER_FAILED");
    const result = await response.json().catch(() => null);
    const raw = result?.translatedText ?? result?.translation;
    if (typeof raw !== "string" || !raw.trim() || raw.trim().length > 7000)
      return fail("TRANSLATION_PROVIDER_INVALID");
    return { translated: raw.trim() };
  } catch (error) {
    return fail(
      error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
        ? "TRANSLATION_TIMEOUT"
        : "TRANSLATION_UNAVAILABLE",
    );
  }
}
