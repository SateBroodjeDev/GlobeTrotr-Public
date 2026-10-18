import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Flag } from "lucide-react";
import { ContactCaptcha } from "@/components/ContactCaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/locale";
import { submitContentReport } from "@/lib/content-reports.functions";
import { toast } from "sonner";

export function ContentReportSection() {
  const { text } = useLocale();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  return <section id="illegale-inhoud" className="scroll-mt-24 space-y-5 border-t border-border/60 pt-4">
    <div className="flex justify-end">
      <Button type="button" variant="ghost" className="h-auto max-w-full gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm" aria-expanded={open} aria-controls="content-report-form" onClick={() => { setHasOpened(true); setOpen(value => !value); }}>
        <Flag className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-normal text-left">{open ? text("Meldformulier sluiten", "Close report form") : text("Illegale content melden", "Report illegal content")}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </Button>
    </div>
    <div id="content-report-form" hidden={!open} style={!open ? { display: "none" } : undefined}>{hasOpened && <ContentReportForm />}</div>
  </section>;
}
function ContentReportForm() {
  const { text, locale } = useLocale();
  const [form, setForm] = useState({ name: "", email: "", url: "", location: "", explanation: "", childSafetyException: false, goodFaith: false, website: "" });
  const [captcha, setCaptcha] = useState(""), [reset, setReset] = useState(0), [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; emailQueued: boolean } | null>(null);
  async function submit() {
    setBusy(true);
    try { setReceipt(await submitContentReport({ data: { ...form, locale, captchaToken: captcha } })); }
    catch { toast.error(text("Melding niet opgeslagen. Controleer de velden en spamcontrole; je kunt ook mailen naar info@globetrotr.nl.", "Notice not saved. Check the fields and spam protection; you can also email info@globetrotr.nl.")); }
    finally { setBusy(false); setCaptcha(""); setReset(value => value + 1); }
  }
  return <article className="mx-auto max-w-3xl space-y-6 px-1 pb-12">
    <header className="space-y-3"><h2 className="font-display text-xl font-semibold">{text("Inhoud melden", "Report content")}</h2>
      <p>{text("Meld specifieke openbare inhoud op GlobeTrotr die volgens jou in strijd is met de wet. Een account is niet nodig. Beschrijf de vindplaats en waarom de inhoud illegaal zou zijn; je hoeft geen wetsartikel te kennen.", "Report specific public content on GlobeTrotr that you believe violates the law. No account is needed. Describe its location and why it may be illegal; you do not need to know a legal provision.")}</p>
      <p className="text-sm text-muted-foreground">{text("Stuur geen illegale afbeeldingen, documenten, wachtwoorden of onnodige persoonsgegevens mee. Bij direct gevaar: bel de hulpdiensten. Urgente meldingen kun je ook sturen naar info@globetrotr.nl.", "Do not submit illegal images, documents, passwords or unnecessary personal data. For immediate danger, contact emergency services. Urgent notices can also be emailed to info@globetrotr.nl.")}</p>
    </header>
    {receipt ? <section role="status" className="space-y-3 rounded-xl border p-6"><h2 className="font-semibold">{text("Melding ontvangen", "Notice received")}</h2><p className="break-all">{text("Dossiernummer: ", "Case number: ")}{receipt.id}</p>
      <p>{receipt.emailQueued ? text("Een ontvangstbevestiging staat klaar voor verzending naar je e-mailadres. Bewaar dit dossiernummer; een beheerder beoordeelt de melding en informeert je over het besluit en mogelijkheden voor herbeoordeling.", "An acknowledgement is queued for delivery to your email address. Keep this case number; a human will review the notice and inform you of the decision and reconsideration options.") : text("Zonder e-mailadres kunnen we geen ontvangstbevestiging of besluit mailen. Bewaar dit nummer en neem met dit nummer contact op via info@globetrotr.nl als je informatie wilt toevoegen of naar het besluit wilt vragen.", "Without an email address we cannot email the acknowledgement or decision. Keep this number and contact info@globetrotr.nl quoting it to provide additional information or ask about the decision.")}</p>
    </section> : <form onSubmit={event => { event.preventDefault(); if (!busy) void submit(); }} className="space-y-4 rounded-xl border p-5 sm:p-7">
      <label className="block space-y-1 text-sm"><span>{text("Exacte URL van de inhoud", "Exact content URL")}</span><Input type="url" required maxLength={2000} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://globetrotr.nl/…" /></label>
      <label className="block space-y-1 text-sm"><span>{text("Vindplaats op de pagina (bijvoorbeeld datum, foto of reactie)", "Location on the page (for example date, photo or comment)")}</span><Input maxLength={500} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
      <label className="block space-y-1 text-sm"><span>{text("Waarom is deze inhoud volgens jou illegaal?", "Why do you believe this content is illegal?")}</span><Textarea required minLength={20} maxLength={3000} rows={6} value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} /></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={form.childSafetyException} onChange={e => setForm({ ...form, childSafetyException: e.target.checked })} /><span>{text("Deze melding betreft seksueel misbruik of seksuele uitbuiting van kinderen (artikelen 3–7 van Richtlijn 2011/93/EU). Alleen daarvoor mag ik naam en e-mail weglaten.", "This notice concerns sexual abuse or sexual exploitation of children (Articles 3–7 of Directive 2011/93/EU). Only for this exception may I omit my name and email.")}</span></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>{text("Naam of organisatie", "Name or organisation")}</span><Input required={!form.childSafetyException} minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="space-y-1 text-sm"><span>E-mail</span><Input type="email" required={!form.childSafetyException} maxLength={254} autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></div>
      <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={form.goodFaith} onChange={e => setForm({ ...form, goodFaith: e.target.checked })} /><span>{text("Ik verklaar te goeder trouw dat de informatie en beschuldigingen naar mijn beste weten juist en volledig zijn.", "I confirm my good-faith belief that the information and allegations are accurate and complete to the best of my knowledge.")}</span></label>
      <input className="hidden" aria-hidden tabIndex={-1} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
      <p className="text-xs text-muted-foreground">{text("We gebruiken je gegevens voor beoordeling, terugkoppeling en eventuele herbeoordeling. De naam en contactgegevens van de melder worden niet standaard aan de maker verstrekt. Dit dossier volgt de bewaartermijn voor contactdossiers, met een bewaarpauze waar noodzakelijk.", "We use your data for assessment, feedback and any reconsideration. The reporter's name and contact details are not routinely disclosed to the creator. This case follows contact-case retention, with a hold where necessary.")} <Link to="/privacy" className="underline">{text("Privacybeleid", "Privacy policy")}</Link></p>
      <ContactCaptcha token={setCaptcha} reset={reset} /><Button type="submit" disabled={busy || !captcha || !form.goodFaith}>{busy ? text("Versturen…", "Submitting…") : text("Melding versturen", "Submit notice")}</Button>
    </form>}
    <section className="space-y-2 text-sm"><h2 className="font-semibold">{text("Wat gebeurt er daarna?", "What happens next?")}</h2><p>{text("Een melding leidt niet automatisch tot verwijdering. We beoordelen haar zorgvuldig en zonder onnodige vertraging. Je ontvangt het besluit met uitleg en mogelijkheden voor herbeoordeling. Als we inhoud beperken, informeren we ook de betrokken maker wanneer diens elektronische contactgegevens bekend zijn. Vraag herbeoordeling via info@globetrotr.nl met het dossiernummer en je redenen; de gang naar de rechter blijft open.", "A notice does not automatically remove content. We assess it carefully and without undue delay. You receive a reasoned decision and reconsideration options. If we restrict content, we also inform the affected creator where their electronic contact details are known. Request reconsideration via info@globetrotr.nl with the case number and your reasons; judicial remedies remain available.")}</p><p>{text("Voor een technisch probleem of gewone klacht: ", "For a technical issue or ordinary complaint: ")}<Link to="/contact" className="underline">{text("Contact", "Contact")}</Link>.</p></section>
  </article>;
}
