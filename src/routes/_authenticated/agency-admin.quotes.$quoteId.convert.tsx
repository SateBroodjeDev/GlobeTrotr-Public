import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, PlaneTakeoff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { convertAgencyQuote, getAgencyQuoteConversion } from "@/lib/agency.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/agency-admin/quotes/$quoteId/convert")({ component: QuoteConversionPage });

function QuoteConversionPage() {
  const { quoteId } = Route.useParams();
  const { text } = useLocale();
  const navigate = useNavigate();
  const quote = useQuery({ queryKey: ["agency-quote-conversion", quoteId], queryFn: () => getAgencyQuoteConversion({ data: { quoteId } }), retry: false });
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [template, setTemplate] = useState("citytrip");
  const [busy, setBusy] = useState(false);
  const data = quote.data;
  const linked = Boolean(data?.tripId);
  const tripName = name || data?.title || "";

  async function convert() {
    if (!data || (!linked && (!tripName.trim() || !start || !end))) return;
    setBusy(true);
    try {
      const result = await convertAgencyQuote({ data: { quoteId, name: linked ? data.tripName : tripName, start: linked ? "2000-01-01" : start, end: linked ? "2000-01-01" : end, template } });
      toast.success(text("Offerte is aan de reis gekoppeld.", "Quote linked to the trip."));
      await navigate({ to: "/trips/$tripId", params: { tripId: result.tripId } });
    } catch {
      toast.error(text("De offerte kon niet worden omgezet.", "The quote could not be converted."));
    } finally { setBusy(false); }
  }

  if (quote.isLoading) return <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin" /></div>;
  if (!data) return <Card><CardContent className="p-6 text-sm text-muted-foreground">{text("Deze geaccepteerde offerte is niet beschikbaar.", "This accepted quote is unavailable.")}</CardContent></Card>;
  if (data.convertedTripId) return <Card className="surface max-w-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" />{text("Offerte al omgezet", "Quote already converted")}</CardTitle></CardHeader><CardContent><Button asChild><Link to="/trips/$tripId" params={{ tripId: data.convertedTripId }}>{text("Reis openen", "Open trip")}</Link></Button></CardContent></Card>;

  return <div className="mx-auto max-w-3xl space-y-5">
    <Button asChild variant="ghost"><Link to="/agency-admin/quotes"><ArrowLeft className="size-4" />{text("Terug naar offertes", "Back to quotes")}</Link></Button>
    <header><h1 className="font-display text-3xl font-semibold">{text("Offerte omzetten", "Convert quote")}</h1><p className="mt-2 text-muted-foreground">{data.title} · {data.clientName}</p></header>
    <Card className="surface"><CardHeader><CardTitle>{data.variantName}</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-2xl font-semibold">{new Intl.NumberFormat(undefined,{style:"currency",currency:data.currency}).format(data.amount)}</p>{data.introduction&&<p className="text-sm text-muted-foreground">{data.introduction}</p>}</CardContent></Card>
    <Card className="surface"><CardHeader><CardTitle>{linked?text("Bestaande reis koppelen", "Link existing trip"):text("Nieuwe reis maken", "Create new trip")}</CardTitle></CardHeader><CardContent className="space-y-4">
      {linked?<p className="rounded-xl border bg-muted/40 p-4 text-sm">{text(`De offerte wordt gekoppeld aan ${data.tripName}. De bestaande planning, boekingen en uitgaven worden niet gewijzigd.`, `The quote will be linked to ${data.tripName}. Existing planning, bookings and expenses will not be changed.`)}</p>:<>
        <label className="block space-y-1 text-sm"><span>{text("Reisnaam", "Trip name")}</span><Input maxLength={30} value={tripName} onChange={e=>setName(e.target.value)} /><span className="block text-right text-xs text-muted-foreground">{tripName.length}/30</span></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>{text("Startdatum", "Start date")}</span><Input type="date" value={start} onChange={e=>setStart(e.target.value)} /></label><label className="space-y-1 text-sm"><span>{text("Einddatum", "End date")}</span><Input type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} /></label></div>
        <label className="block space-y-1 text-sm"><span>{text("Reistype", "Trip type")}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={template} onChange={e=>setTemplate(e.target.value)}><option value="citytrip">Citytrip</option><option value="roadtrip">Roadtrip</option><option value="backpacking">Backpacking</option><option value="beach">{text("Strand", "Beach")}</option><option value="winter">Winter</option><option value="business">{text("Zakelijk", "Business")}</option><option value="safari">Safari</option><option value="cruise">Cruise</option></select></label>
      </>}
      <Button disabled={busy||(!linked&&(!tripName.trim()||!start||!end||end<start))} onClick={()=>void convert()}><PlaneTakeoff className="size-4" />{busy?text("Omzetten…", "Converting…"):text("Offerte definitief omzetten", "Convert quote")}</Button>
    </CardContent></Card>
  </div>;
}
