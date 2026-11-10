import { useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, CheckCircle2, Clock3, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getPublicAgencyQuote, respondToAgencyQuote } from "@/lib/quote.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/quote/$token")({ component: QuotePage });

function QuotePage() {
  const { token } = Route.useParams();
  const { text } = useLocale();
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<"accepted" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const query = useQuery({ queryKey: ["public-agency-quote", token], queryFn: () => getPublicAgencyQuote({ data: { token } }), retry: false });
  const data = query.data;
  async function respond(response: "accept" | "reject", variantId?: string) {
    const message = response === "accept" ? text("Deze prijsvariant accepteren?", "Accept this price option?") : text("De volledige offerte afwijzen?", "Reject the complete quote?");
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const result = await respondToAgencyQuote({ data: { token, response, variantId, note } });
      if (result.status !== "accepted" && result.status !== "rejected") throw new Error(result.status);
      setAnswered(result.status);
      toast.success(result.status === "accepted" ? text("Offerte geaccepteerd.", "Quote accepted.") : text("Offerte afgewezen.", "Quote rejected."));
    } catch {
      toast.error(text("Je antwoord kon niet worden opgeslagen. Vernieuw de pagina en probeer opnieuw.", "Your response could not be saved. Refresh the page and try again."));
    } finally { setBusy(false); }
  }
  if (query.isLoading) return <Shell><p className="text-sm text-muted-foreground">{text("Offerte laden…", "Loading quote…")}</p></Shell>;
  const finalStatus = answered ?? (data?.status === "accepted" || data?.status === "rejected" ? data.status : null);
  if (finalStatus) return <Shell><div className="py-10 text-center">{finalStatus === "accepted" ? <CheckCircle2 className="mx-auto size-12 text-primary"/> : <X className="mx-auto size-12 text-muted-foreground"/>}<h1 className="mt-4 font-display text-2xl font-semibold">{finalStatus === "accepted" ? text("Offerte geaccepteerd", "Quote accepted") : text("Offerte afgewezen", "Quote rejected")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("De reisorganisatie heeft je antwoord ontvangen.", "The travel organisation has received your response.")}</p></div></Shell>;
  if (!data || data.status !== "available" || !data.quote) return <Shell><div className="py-10 text-center"><FileText className="mx-auto size-10 text-muted-foreground"/><h1 className="mt-4 font-display text-2xl font-semibold">{data?.status === "expired" ? text("Deze offerte is verlopen", "This quote has expired") : text("Offerte niet beschikbaar", "Quote unavailable")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Vraag de reisadviseur om een nieuwe link.", "Ask the travel adviser for a new link.")}</p></div></Shell>;
  const q = data.quote;
  return <div className="mx-auto max-w-4xl space-y-6 py-8" style={{ "--brand-hue": String(q.branding.accent) } as CSSProperties}>
    <header className="rounded-3xl border bg-card p-6 sm:p-9">
      {q.branding.logoUrl && <img src={q.branding.logoUrl} alt="" className="mb-5 max-h-14 max-w-48 object-contain"/>}
      <p className="text-sm font-medium text-primary">{q.branding.brandName}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-5xl">{q.title}</h1>
      {q.branding.tagline && <p className="mt-3 text-muted-foreground">{q.branding.tagline}</p>}
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>{text("Voor", "For")} {q.clientName}</span>{q.tripName && <span>· {q.tripName}</span>}
        {q.validUntil && <span className="inline-flex items-center gap-1"><CalendarDays className="size-4"/>{text("Geldig tot", "Valid until")} {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(`${q.validUntil}T12:00:00`))}</span>}
      </div>
      {q.introduction && <p className="mt-6 max-w-3xl whitespace-pre-wrap leading-7">{q.introduction}</p>}
    </header>
    <section className="grid gap-4 md:grid-cols-2">{q.variants.map((variant) => <Card key={variant.id} className="surface">
      <CardHeader><CardTitle className="flex items-start justify-between gap-3"><span>{variant.name}</span><span className="shrink-0 text-primary">{new Intl.NumberFormat(undefined, { style: "currency", currency: q.currency }).format(variant.amount)}</span></CardTitle></CardHeader>
      <CardContent>{variant.description && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{variant.description}</p>}<Button className="mt-5 w-full" disabled={busy} onClick={() => void respond("accept", variant.id)}><Check className="size-4"/>{text("Deze variant accepteren", "Accept this option")}</Button></CardContent>
    </Card>)}</section>
    <Card className="surface"><CardContent className="space-y-3 p-5"><label className="text-sm font-medium" htmlFor="quote-note">{text("Opmerking voor de reisadviseur (optioneel)", "Note for the travel adviser (optional)")}</label><Textarea id="quote-note" value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)}/><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{note.length}/500</span><Button variant="outline" disabled={busy} onClick={() => void respond("reject")}><X className="size-4"/>{text("Volledige offerte afwijzen", "Reject complete quote")}</Button></div></CardContent></Card>
    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4"/>{text("Je eerste antwoord is definitief en wordt veilig vastgelegd.", "Your first response is final and stored securely.")}</p>
  </div>;
}
function Shell({ children }: { children: ReactNode }) { return <div className="mx-auto max-w-xl py-10"><Card className="surface"><CardContent className="p-6">{children}<Button asChild variant="outline" className="mt-6 w-full"><Link to="/">GlobeTrotr</Link></Button></CardContent></Card></div>; }
