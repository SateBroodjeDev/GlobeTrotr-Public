import { createServerFn } from "@tanstack/react-start";
import { CURRENCIES, FALLBACK_RATES, type Rates } from "./services";

/**
 * Live ECB day rates, fetched server-side so the browser never hits a
 * cross-origin API. Falls back to bundled rates if the provider is down.
 */
export const getRates = createServerFn({ method: "GET" }).handler(async (): Promise<Rates> => {
  const symbols = CURRENCIES.map((c) => c.code)
    .filter((c) => c !== "EUR")
    .join(",");
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${symbols}`);
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { rates: Record<string, number> };
    return { ...FALLBACK_RATES, ...json.rates, EUR: 1 };
  } catch {
    return { ...FALLBACK_RATES };
  }
});
