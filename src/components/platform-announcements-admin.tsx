import { translationDraftMessage } from "@/lib/translation-errors";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Megaphone, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TranslationDraftButtons, type TranslationDirection } from "@/components/TranslationDraftButtons";
import { getNotificationDeliveryOverview, listPlatformAnnouncements, publishPlatformAnnouncement } from "@/lib/issues.functions";
import { createTranslationDraft } from "@/lib/translation.functions";
import { loadPublicPlatformStatus } from "@/lib/platform-status-client";
import { announcementFollowUpText, announcementPublicationSaved, measuredIncidentCovered, type PlatformAnnouncementInput } from "@/lib/platform-incident";
import { useLocale } from "@/lib/locale";

type Form = PlatformAnnouncementInput;
const empty = (mode: "updates" | "incidents"): Form => ({ requestId:crypto.randomUUID(), expectedLatestId:null, type:mode==="incidents"?"status":"update", severity:mode==="incidents"?"warning":"info", titleNl:"", titleEn:"", bodyNl:"", bodyEn:"", publicStatus:mode==="incidents", componentKeys:[], phase:"investigating" });
type StatusSnapshot = { components: {key:string;nameNl:string;nameEn:string}[]; incidents: {id:string;key:string;nameNl:string;nameEn:string;startedAt?:string;resolvedAt:string|null}[] };

export function PlatformAnnouncementsAdmin({ mode }: { mode: "updates" | "incidents" }) {
  const createEmpty = () => empty(mode);
  const incidents = mode === "incidents";
  const { locale, text } = useLocale();
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<Form>(createEmpty);
  const messages = useQuery({ queryKey:["platform-announcements"], queryFn:()=>listPlatformAnnouncements() });
  const delivery = useQuery({ queryKey:["notification-delivery-overview"], enabled:!incidents, queryFn:()=>getNotificationDeliveryOverview() });
  const status = useQuery({ queryKey:["public-platform-status"], enabled:incidents, refetchInterval:30_000, queryFn:async()=>{
    const data=await loadPublicPlatformStatus();
    return data as StatusSnapshot;
  }});
  const active = (messages.data ?? []).filter((item:any)=>item.current && item.announcement_type==="status" && item.severity!=="resolved");
  function edit(item:any, resolved=false) {
    setForm({
      ...createEmpty(), expectedLatestId:item.id, publicStatus:item.public_status===true, componentKeys:item.component_keys??[], phase:resolved?"resolved":(item.incident_phase??"investigating"),
      type:"status",
      severity:resolved?"resolved":item.severity,
      ...announcementFollowUpText(item,resolved),
      statusKey:item.status_key,
    });
  }
  async function publish() {
    if(form.publicStatus && (!form.componentKeys.length || form.severity==="info")) {
      toast.error(text("Kies de betrokken diensten en verminderde werking of offline.","Choose affected services and degraded or offline availability.")); return;
    }
    if(form.publicStatus && active.some((item:any)=>item.public_status && item.status_key!==(form.statusKey??form.requestId) && item.component_keys?.some((key:string)=>form.componentKeys.includes(key)))) {
      toast.error(text("Voor deze dienst bestaat al een actuele status. Werk die melding bij.","This service already has a current status. Update that notice.")); return;
    }
    if (!confirm(text("Dit bericht nu naar alle ingelogde gebruikers sturen?","Send this message to all signed-in users now?"))) return;
    setBusy(true);
    try {
      await publishPlatformAnnouncement({data:form});
      setForm(createEmpty());
      await Promise.all([messages.refetch(),status.refetch()]);
      toast.success(text("Platformbericht gepubliceerd.","Platform message published."));
    } catch {
      const refreshed = await messages.refetch();
      if (!refreshed.isError && announcementPublicationSaved(form, refreshed.data ?? [])) {
        setForm(createEmpty());
        await status.refetch();
        toast.success(text("Platformbericht gepubliceerd.","Platform message published."));
      } else toast.error(text("Publiceren mislukt of de status is intussen gewijzigd. Controleer Actuele statussen en probeer opnieuw.","Publishing failed or the status changed. Check Current statuses and try again."));
    }
    finally { setBusy(false); }
  }
  async function translate(direction: TranslationDirection) {
    const source = direction === "nl-en" ? "nl" : "en";
    const target = direction === "nl-en" ? "en" : "nl";
    const titleValue = direction === "nl-en" ? form.titleNl : form.titleEn;
    const bodyValue = direction === "nl-en" ? form.bodyNl : form.bodyEn;
    if (!titleValue.trim() || !bodyValue.trim()) return;
    setBusy(true);
    try {
      const [title,body]=await Promise.all([
        createTranslationDraft({data:{text:titleValue,source,target}}),
        createTranslationDraft({data:{text:bodyValue,source,target}}),
      ]);
      setForm(current=>direction === "nl-en" ? {...current,titleEn:title.translated,bodyEn:body.translated} : {...current,titleNl:title.translated,bodyNl:body.translated});
      toast.success(text("Vertaalconcept gemaakt. Controleer het voor publicatie.","Translation draft created. Review it before publishing."));
    } catch(error) {
      toast.error(translationDraftMessage(error, text));
    } finally { setBusy(false); }
  }
  function publicStatusFields() {
    return form.type==="status" && <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.publicStatus}
        disabled={busy || Boolean(form.publicStatus && form.statusKey && form.phase==="resolved") || Boolean(form.statusKey && messages.data?.some((item:any)=>item.status_key===form.statusKey && item.public_status))}
        onChange={e=>setForm({...form,publicStatus:e.target.checked,severity:e.target.checked&&form.severity==="info"?"warning":form.severity})}/>
        {text("Ook op de openbare statuspagina","Also on the public status page")}</label>
      <p className="text-xs text-muted-foreground">{text("Deze status en vervolgupdates vormen een incident. Publiceer uitsluitend openbare informatie. Bestaande meldingen en e-mails blijven van toepassing.","This status and its updates form one incident. Publish public information only. Existing notifications and emails still apply.")}</p>
      {form.publicStatus && <><label className="block space-y-1 text-sm">{text("Incidentfase","Incident phase")}<select className="block h-10 w-full rounded-md border bg-background px-3" disabled={busy} value={form.phase}
        onChange={e=>setForm({...form,phase:e.target.value as Form["phase"],severity:e.target.value==="resolved"?"resolved":form.severity==="resolved"?"warning":form.severity})}>
        <option value="investigating">{text("In onderzoek","Investigating")}</option><option value="identified">{text("Oorzaak gevonden","Identified")}</option><option value="monitoring">{text("Herstel controleren","Monitoring")}</option><option value="resolved">{text("Opgelost","Resolved")}</option>
      </select></label>{form.phase==="resolved"&&<p className="text-xs text-muted-foreground">{text("Afsluiten beëindigt dit incident. De gemeten beschikbaarheid blijft zichtbaar; een volgende mislukte poll opent een nieuw incident.","Closing ends this incident. Measured availability stays visible; a subsequent failed poll opens a new incident.")}</p>}<div className="flex flex-wrap gap-x-4 gap-y-2">{status.data?.components.map(component=><label key={component.key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || Boolean(form.statusKey && form.phase==="resolved")} checked={form.componentKeys.includes(component.key)}
        onChange={e=>setForm({...form,componentKeys:e.target.checked?[...form.componentKeys,component.key]:form.componentKeys.filter(key=>key!==component.key)})}/>{text(component.nameNl,component.nameEn)}</label>)}</div>
        {status.isError && <p role="alert" className="text-sm text-destructive">{text("Diensten konden niet geladen worden. Vernieuw de pagina.","Services could not be loaded. Refresh the page.")}</p>}</>}
    </fieldset>;
  }
  // Publication reads are fresh; public measurements can still be in the edge cache.
  // Do not briefly show the same incident twice while that cache catches up.
  const measured = (status.data?.incidents??[]).filter(item=>!item.resolvedAt && !measuredIncidentCovered(item, messages.data??[]));
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-5"/>{incidents?text("Incident publiceren","Publish incident"):text("Platformbericht publiceren","Publish platform message")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{incidents?text("Een actuele status verschijnt ook als wegklikbare banner. Een oplossing sluit de banner en verschijnt als gewone melding rechtsboven.","A current status also appears as a dismissible banner. A resolution closes the banner and appears as a regular notification in the top right."):text("Publiceer een belangrijke update voor alle gebruikers. Incidenten beheer je onder Problemen.","Publish an important update for all users. Manage incidents under Issues.")}</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">{form.publicStatus?text("Beschikbaarheid","Availability"):text("Ernst","Severity")}<select className="block h-10 w-full rounded-md border bg-background px-3" disabled={busy} value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as Form["severity"],phase:e.target.value==="resolved"?"resolved":form.phase==="resolved"?"monitoring":form.phase})}><option value="info" disabled={form.publicStatus}>Info</option><option value="warning">{form.publicStatus?text("Verminderde werking","Degraded"):text("Waarschuwing","Warning")}</option><option value="critical">{form.publicStatus?text("Offline","Offline"):text("Kritiek","Critical")}</option>{form.type==="status"&&<option value="resolved">{text("Opgelost","Resolved")}</option>}</select></label><Input aria-label="Titel Nederlands" disabled={busy} value={form.titleNl} onChange={e=>setForm({...form,titleNl:e.target.value})} placeholder="Titel Nederlands" maxLength={120}/><Input aria-label="English title" disabled={busy} value={form.titleEn} onChange={e=>setForm({...form,titleEn:e.target.value})} placeholder="English title" maxLength={120}/><Textarea aria-label="Bericht Nederlands" disabled={busy} value={form.bodyNl} onChange={e=>setForm({...form,bodyNl:e.target.value})} placeholder="Bericht Nederlands" maxLength={1000}/><Textarea aria-label="English message" disabled={busy} value={form.bodyEn} onChange={e=>setForm({...form,bodyEn:e.target.value})} placeholder="English message" maxLength={1000}/></div>{publicStatusFields()}<TranslationDraftButtons translating={busy} canTranslateNl={Boolean(form.titleNl.trim()&&form.bodyNl.trim())} canTranslateEn={Boolean(form.titleEn.trim()&&form.bodyEn.trim())} onTranslate={(direction)=>void translate(direction)}/><Button disabled={busy||![form.titleNl,form.titleEn,form.bodyNl,form.bodyEn].every(value=>value.trim().length>=3)} onClick={()=>void publish()}><Send className="size-4"/>{busy?text("Publiceren…","Publishing…"):text("Naar alle gebruikers publiceren","Publish to all users")}</Button></CardContent></Card>
    <div className="space-y-6">{!incidents&&<Card><CardHeader><CardTitle>{text("Bezorgoverzicht","Delivery overview")}</CardTitle></CardHeader><CardContent><p className="mb-3 text-xs text-muted-foreground">{text(`Laatste ${delivery.data?.sample??0} in-appmeldingen. Open betekent dat de ontvanger de melding nog niet heeft weggeklikt.`,`Latest ${delivery.data?.sample??0} in-app notifications. Open means the recipient has not dismissed the notification yet.`)}</p><div className="grid gap-2 sm:grid-cols-2">{(delivery.data?.groups??[]).map((group:any)=><div key={group.kind} className="rounded-lg border p-3"><strong className="text-sm">{group.kind}</strong><div className="mt-2 flex gap-3 text-xs text-muted-foreground"><span>{group.sent} {text("verzonden","sent")}</span><span>{group.open} {text("open","open")}</span><span>{group.dismissed} {text("afgesloten","dismissed")}</span></div></div>)}</div></CardContent></Card>}{incidents&&<Card><CardHeader><CardTitle>{text("Actuele statussen","Current statuses")}</CardTitle></CardHeader><CardContent className="space-y-3">{active.length===0&&measured.length===0?<p className="text-sm text-muted-foreground">{text("Er zijn geen actieve platformstatussen.","There are no active platform statuses.")}</p>:active.map((item:any)=><article key={item.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><Badge variant={item.severity==="critical"?"destructive":"secondary"}>{item.severity}</Badge><span className="text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString(locale)}</span></div><h3 className="mt-2 font-semibold">{text(item.title_nl,item.title_en)}</h3><p className="mt-1 text-sm text-muted-foreground">{text(item.body_nl,item.body_en)}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>edit(item)}><Pencil className="size-4"/>{text("Bijwerken","Update")}</Button><Button size="sm" disabled={busy} onClick={()=>edit(item,true)}><CheckCircle2 className="size-4"/>{text("Opgelost melden","Mark resolved")}</Button></div></article>)}{measured.map(item=><article key={item.id} className="rounded-lg border p-3"><Badge variant="destructive">{text("Gemeten storing","Measured outage")}</Badge><h3 className="mt-2 font-semibold">{text(item.nameNl,item.nameEn)}</h3><p className="mt-1 text-xs text-muted-foreground">{text("Nog geen openbare toelichting. Voeg context toe aan ditzelfde incident.","No public context yet. Add context to this same incident.")}</p><Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>setForm({...createEmpty(),statusKey:item.id,publicStatus:true,severity:"warning",componentKeys:[item.key],titleNl:`Storing: ${item.nameNl}`,titleEn:`Disruption: ${item.nameEn}`})}><Pencil className="size-4"/>{text("Toelichting toevoegen","Add context")}</Button><Button className="ml-2 mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>setForm({...createEmpty(),statusKey:item.id,publicStatus:true,severity:"resolved",phase:"resolved",componentKeys:[item.key],titleNl:`Incident afgesloten: ${item.nameNl}`,titleEn:`Incident closed: ${item.nameEn}`,bodyNl:"Dit incident is afgesloten. Raadpleeg het dienstenoverzicht voor de actuele beschikbaarheid.",bodyEn:"This incident is closed. Please refer to the service overview for current availability."})}><CheckCircle2 className="size-4"/>{text("Incident afsluiten","Close incident")}</Button></article>)}</CardContent></Card>}<Card><CardHeader><CardTitle>{incidents?text("Incidentgeschiedenis","Incident history"):text("Berichtgeschiedenis","Message history")}</CardTitle></CardHeader><CardContent className="max-h-[32rem] space-y-2 overflow-y-auto">{messages.isLoading?<p className="text-sm text-muted-foreground">{text("Laden…","Loading…")}</p>:(messages.data??[]).filter((item:any)=>item.announcement_type===(incidents?"status":"update")).map((item:any)=><article key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.announcement_type==="status"?text("Status","Status"):text("Update","Update")}</Badge><Badge variant="secondary">{item.severity}</Badge><time className="ml-auto text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString(locale)}</time></div><p className="mt-2 text-sm font-medium">{text(item.title_nl,item.title_en)}</p></article>)}</CardContent></Card></div>
    <Dialog open={Boolean(form.statusKey)} onOpenChange={(open)=>{if(!open&&!busy)setForm(createEmpty());}}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form.severity==="resolved"?text("Status als opgelost melden","Mark status as resolved"):text("Platformstatus bijwerken","Update platform status")}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">{form.publicStatus?text("Beschikbaarheid","Availability"):text("Ernst","Severity")}<select className="block h-10 w-full rounded-md border bg-background px-3" disabled={busy} value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as Form["severity"],phase:e.target.value==="resolved"?"resolved":form.phase==="resolved"?"monitoring":form.phase})}><option value="info" disabled={form.publicStatus}>Info</option><option value="warning">{form.publicStatus?text("Verminderde werking","Degraded"):text("Waarschuwing","Warning")}</option><option value="critical">{form.publicStatus?text("Offline","Offline"):text("Kritiek","Critical")}</option><option value="resolved">{text("Opgelost","Resolved")}</option></select></label><span/><Input aria-label="Titel Nederlands" disabled={busy} value={form.titleNl} onChange={e=>setForm({...form,titleNl:e.target.value})} maxLength={120}/><Input aria-label="English title" disabled={busy} value={form.titleEn} onChange={e=>setForm({...form,titleEn:e.target.value})} maxLength={120}/><Textarea aria-label="Bericht Nederlands" disabled={busy} value={form.bodyNl} onChange={e=>setForm({...form,bodyNl:e.target.value})} maxLength={1000}/><Textarea aria-label="English message" disabled={busy} value={form.bodyEn} onChange={e=>setForm({...form,bodyEn:e.target.value})} maxLength={1000}/></div>{publicStatusFields()}<TranslationDraftButtons translating={busy} canTranslateNl={Boolean(form.titleNl.trim()&&form.bodyNl.trim())} canTranslateEn={Boolean(form.titleEn.trim()&&form.bodyEn.trim())} onTranslate={(direction)=>void translate(direction)}/><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setForm(createEmpty())}>{text("Annuleren","Cancel")}</Button><Button disabled={busy||![form.titleNl,form.titleEn,form.bodyNl,form.bodyEn].every(value=>value.trim().length>=3)} onClick={()=>void publish()}><Send className="size-4"/>{form.severity==="resolved"?text("Oplossing publiceren","Publish resolution"):text("Statusupdate publiceren","Publish status update")}</Button></div></DialogContent></Dialog>
  </div>;
}
