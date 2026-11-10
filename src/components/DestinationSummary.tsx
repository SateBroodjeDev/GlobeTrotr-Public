import type { Stop } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { routePlaceName } from "@/lib/route-map";
import { DestinationCountry } from "@/components/DestinationCountry";
import { Pencil } from "lucide-react";

/** Full-width name and a quiet, directly editable existing date. */
export function DestinationSummary({ stop, index, suggestedDate, bookingDays = [], onSelect, onEditDate }: {
  stop: Stop; index: number; suggestedDate?: string; bookingDays?: string[]; onSelect: () => void; onEditDate?: () => void;
}) {
  const { locale, text } = useLocale();
  const date = stop.arrive || suggestedDate;
  const parsed = date ? new Date(`${date}T12:00:00Z`) : undefined;
  const showBookingYear = new Set(bookingDays.map(day => day.slice(0, 4))).size > 1;
  const knownDays = bookingDays.slice(0, 3).map(day => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(showBookingYear ? { year: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))).join(" · ")
    + (bookingDays.length > 3 ? ` +${bookingDays.length - 3}` : "");
  const label = !stop.arrive && bookingDays.length > 1 ? knownDays : parsed && Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed)
    : date || text("Datum toevoegen", "Add date");
  return <>
    <button type="button" className="col-span-2 flex w-full min-w-0 items-start gap-2 rounded py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={event => { event.stopPropagation(); onSelect(); }}>
      <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
      <span className="min-w-0 flex-1 break-words leading-relaxed">{routePlaceName(stop)}</span>
      <DestinationCountry country={stop.country} locale={locale} />
    </button>
    {onEditDate ? <button type="button" className="inline-flex min-h-11 min-w-0 items-center justify-self-start gap-1 rounded px-1 text-left text-xs text-muted-foreground underline-offset-4 hover:bg-primary/10 hover:text-primary hover:underline active:bg-primary/15 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={!stop.arrive && bookingDays.length > 1 ? text("Bekende boekingsdagen; kies je aankomstdatum", "Known booking days; choose your arrival date") : !stop.arrive && suggestedDate ? text("Datum uit je boeking; klik om te bevestigen of wijzigen", "Date from your booking; click to confirm or change") : text("Datum en adres aanpassen", "Edit date and address")}
      aria-label={text(`Datum wijzigen voor ${stop.name}; ook locatie en adres`, `Change date for ${stop.name}; also location and address`)}
      onClick={event => { event.stopPropagation(); onEditDate(); }}><span>{label}
        {stop.arrive && bookingDays.length > 1 && <span className="block text-[10px]">{text("Boekingen", "Bookings")}: {knownDays}</span>}
      </span><Pencil className="size-3 shrink-0 opacity-60" aria-hidden="true" /></button>
      : date || bookingDays.length ? <span className="px-1 text-xs text-muted-foreground">{label}
        {stop.arrive && bookingDays.length > 1 && <span className="block text-[10px]">{text("Boekingen", "Bookings")}: {knownDays}</span>}
      </span> : null}
  </>;
}
