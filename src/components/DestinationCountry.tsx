import { countryCode, countryLabel } from "@/lib/countries";
import type { AppLocale } from "@/lib/locale";

/** Compact, font-independent country marker; retain the full name for assistive text. */
export function DestinationCountry({ country, locale }: { country: string; locale: AppLocale }) {
  if (!country.trim()) return null;
  const code = countryCode(country);
  const label = code ? countryLabel(code, locale) : country;
  return <span className="ml-2 inline-flex shrink-0 whitespace-nowrap rounded border border-border/70 bg-background/50 px-1.5 py-0.5 align-middle text-[10px] font-medium leading-none tracking-wide text-muted-foreground"
    title={label} aria-label={label}>{code ?? "?"}</span>;
}
