import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/locale";
import { decideContentReport } from "@/lib/content-reports.functions";
import { toast } from "sonner";

export function ContentReportReview({ message, onUpdated }: { message: any; onUpdated: () => Promise<unknown> }) {
  const { text } = useLocale();
  const [form, setForm] = useState({ action: "no_action" as "no_action" | "restriction", facts: "", basis: "", scope: "", duration: "", affectedUserId: "", contactUnavailableReason: "", implemented: false });
  const [busy, setBusy] = useState(false);
  const report = message.content_reports;
  if (!report) return null;
  async function submit() {
    if (!window.confirm(text("Dit besluit definitief vastleggen en de berichten klaarzetten? Controleer feiten, grondslag, maatregel en ontvanger; vermeld geen identiteit van de melder in de redenen.", "Record this decision and queue notices? Check facts, basis, measure and recipient; do not disclose the reporter's identity in the reasons."))) return;
    setBusy(true);
    try { await decideContentReport({ data: { ...form, id: message.id } }); await onUpdated(); toast.success(text("Besluit opgeslagen; berichten klaar voor verzending.", "Decision saved; notices queued for delivery.")); }
    catch { toast.error(text("Besluit niet opgeslagen. Controleer alle velden, rechten, dossierstatus en het account van de maker.", "Decision not saved. Check all fields, permissions, case status and the creator's account.")); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border p-4">
    <h3 className="font-semibold">{text("Inhoudsmelding", "Content report")}</h3>
    <p className="text-xs text-muted-foreground">{text("Door melder opgegeven URL; controleer het domein voordat je opent.", "Reporter-supplied URL; check the domain before opening.")}</p>
    <p className="break-all text-sm"><a href={report.url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="underline">{report.url}</a></p>
    <p className="whitespace-pre-wrap text-sm">{report.location}</p>
    <p className="text-xs text-muted-foreground">{text("Verklaring te goeder trouw ontvangen. Uitzondering kindveiligheid: ", "Good-faith declaration received. Child-safety exception: ")}{report.child_safety_exception ? text("ja", "yes") : text("nee", "no")}</p>
    <p className="text-xs">{text("Ontvangstmail: ", "Acknowledgement email: ")}{report.receipt?.status ?? text("geen e-mailadres / verwijderd", "no email / removed")}</p>
    {report.content_report_decisions?.map((decision: any) => <div key={decision.id} className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs"><p>{decision.created_at} · {decision.decision.action}</p><p className="whitespace-pre-wrap">{decision.decision.facts}</p><p>{decision.decision.basis}</p><p>{decision.decision.scope} · {decision.decision.duration}</p><p>{text("Besluitmail melder / maker: ", "Decision email reporter / creator: ")}{decision.reporter_mail?.status ?? "—"} / {decision.affected_mail?.status ?? "—"}</p></div>)}
    {message.status !== "closed" && message.can_decide_content_report && <form onSubmit={event => { event.preventDefault(); if (!busy) void submit(); }} className="space-y-3">
      <p className="text-xs text-muted-foreground">{text("Menselijke beoordeling. Pas een noodzakelijke maatregel eerst via het bestaande inhoudsbeheer toe en verstuur het besluit direct. Dit formulier verwijdert zelf geen inhoud. Bij een geloofwaardig strafbaar feit dat leven of veiligheid bedreigt: beoordeel onverwijld melding aan bevoegde autoriteiten (DSA art. 18).", "Human review. First apply any necessary measure through existing content management and send the decision immediately. This form does not remove content. For credible criminal threats to life or safety, promptly assess notification to competent authorities (DSA Art. 18).")}</p>
      <label className="block text-sm">{text("Besluit", "Decision")}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={form.action} onChange={e => setForm({ ...form, action: e.target.value as typeof form.action })}><option value="no_action">{text("Geen beperking", "No restriction")}</option><option value="restriction">{text("Beperking toegepast", "Restriction applied")}</option></select></label>
      {([["facts", "Feiten en omstandigheden", "Facts and circumstances", 20, 600], ["basis", "Wetsartikel of bepaling uit voorwaarden, met uitleg", "Legal or contractual provision, with explanation", 10, 400], ["scope", "Maatregel en geografisch bereik (of geen beperking)", "Measure and geographical scope (or no restriction)", 2, 100], ["duration", "Duur (of niet van toepassing)", "Duration (or not applicable)", 2, 100]] as const).map(([key, nl, en, min, max]) => <label key={key} className="block space-y-1 text-sm"><span>{text(nl, en)}</span><Textarea required minLength={min} maxLength={max} rows={2} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      {form.action === "restriction" && <><label className="block space-y-1 text-sm"><span>{text("Account-ID van betrokken maker (controleer in gebruikersbeheer)", "Affected creator's account ID (verify in user management)")}</span><Input value={form.affectedUserId} onChange={e => setForm({ ...form, affectedUserId: e.target.value })} /></label><label className="block space-y-1 text-sm"><span>{text("Alleen als elektronische contactgegevens onbekend zijn: waarom?", "Only if electronic contact details are unknown: why?")}</span><Input maxLength={300} value={form.contactUnavailableReason} onChange={e => setForm({ ...form, contactUnavailableReason: e.target.value })} /></label><label className="flex items-start gap-2 text-sm"><input required type="checkbox" checked={form.implemented} onChange={e => setForm({ ...form, implemented: e.target.checked })} /><span>{text("Ik heb de hierboven beschreven maatregel daadwerkelijk toegepast en de maker/ontvanger gecontroleerd.", "I have actually applied the measure described above and verified the creator/recipient.")}</span></label></>}
      <Button type="submit" size="sm" disabled={busy}>{text("Besluit vastleggen en berichten klaarzetten", "Record decision and queue notices")}</Button>
    </form>}
    {!message.can_decide_content_report && <p className="text-xs">{text("Besluiten worden door een actieve platform-owner afgehandeld.", "Decisions are handled by an active platform owner.")}</p>}
  </section>;
}
