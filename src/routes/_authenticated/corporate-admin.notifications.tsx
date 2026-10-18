import { translationDraftMessage } from "@/lib/translation-errors";
import { createFileRoute } from "@tanstack/react-router";
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
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/notifications")({ component: PlatformNotifications });
type Form = { type:"status"|"update"; severity:"info"|"warning"|"critical"|"resolved"; titleNl:string; titleEn:string; bodyNl:string; bodyEn:string; statusKey?:string };
const empty: Form = { type:"status", severity:"info", titleNl:"", titleEn:"", bodyNl:"", bodyEn:"" };

function PlatformNotifications() {
  const { locale, text } = useLocale();
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<Form>(empty);
  const messages = useQuery({ queryKey:["platform-announcements"], queryFn:()=>listPlatformAnnouncements() });
  const delivery = useQuery({ queryKey:["notification-delivery-overview"], queryFn:()=>getNotificationDeliveryOverview() });
  const active = (messages.data ?? []).filter((item:any)=>item.current && item.announcement_type==="status" && item.severity!=="resolved");
  function edit(item:any, resolved=false) {
    setForm({
      type:"status",
      severity:resolved?"resolved":item.severity,
      titleNl:resolved?`Opgelost: ${item.title_nl}`:`Update: ${item.title_nl}`,
      titleEn:resolved?`Resolved: ${item.title_en}`:`Update: ${item.title_en}`,
      bodyNl:resolved?`De eerdere platformmelding is opgelost.\n\n${item.body_nl}`:item.body_nl,
      bodyEn:resolved?`The earlier platform notice has been resolved.\n\n${item.body_en}`:item.body_en,
      statusKey:item.status_key,
    });
  }
  async function publish() {
    if (!confirm(text("Dit bericht nu naar alle ingelogde gebruikers sturen?","Send this message to all signed-in users now?"))) return;
    setBusy(true);
    try {
      await publishPlatformAnnouncement({data:form});
      setForm(empty);
      await messages.refetch();
      toast.success(text("Platformbericht gepubliceerd.","Platform message published."));
    } catch { toast.error(text("Platformbericht kon niet worden gepubliceerd.","Platform message could not be published.")); }
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
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-5"/>{text("Platformbericht publiceren","Publish platform message")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{text("Een actuele status verschijnt ook als wegklikbare banner. Een oplossing sluit de banner en verschijnt als gewone melding rechtsboven.","A current status also appears as a dismissible banner. A resolution closes the banner and appears as a regular notification in the top right.")}</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">{text("Soort","Type")}<select className="block h-10 w-full rounded-md border bg-background px-3" value={form.type} onChange={e=>setForm({...form,type:e.target.value as Form["type"],severity:e.target.value==="update"&&form.severity==="resolved"?"info":form.severity})}><option value="status">{text("Actuele platformstatus","Current platform status")}</option><option value="update">{text("Belangrijke update","Important update")}</option></select></label><label className="space-y-1 text-sm">{text("Ernst","Severity")}<select className="block h-10 w-full rounded-md border bg-background px-3" value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as Form["severity"]})}><option value="info">Info</option><option value="warning">{text("Waarschuwing","Warning")}</option><option value="critical">{text("Kritiek","Critical")}</option>{form.type==="status"&&<option value="resolved">{text("Opgelost","Resolved")}</option>}</select></label><Input value={form.titleNl} onChange={e=>setForm({...form,titleNl:e.target.value})} placeholder="Titel Nederlands" maxLength={120}/><Input value={form.titleEn} onChange={e=>setForm({...form,titleEn:e.target.value})} placeholder="English title" maxLength={120}/><Textarea value={form.bodyNl} onChange={e=>setForm({...form,bodyNl:e.target.value})} placeholder="Bericht Nederlands" maxLength={1000}/><Textarea value={form.bodyEn} onChange={e=>setForm({...form,bodyEn:e.target.value})} placeholder="English message" maxLength={1000}/></div><TranslationDraftButtons translating={busy} canTranslateNl={Boolean(form.titleNl.trim()&&form.bodyNl.trim())} canTranslateEn={Boolean(form.titleEn.trim()&&form.bodyEn.trim())} onTranslate={(direction)=>void translate(direction)}/><Button disabled={busy||![form.titleNl,form.titleEn,form.bodyNl,form.bodyEn].every(value=>value.trim().length>=3)} onClick={()=>void publish()}><Send className="size-4"/>{busy?text("Publiceren…","Publishing…"):text("Naar alle gebruikers publiceren","Publish to all users")}</Button></CardContent></Card>
    <div className="space-y-6"><Card><CardHeader><CardTitle>{text("Bezorgoverzicht","Delivery overview")}</CardTitle></CardHeader><CardContent><p className="mb-3 text-xs text-muted-foreground">{text(`Laatste ${delivery.data?.sample??0} in-appmeldingen. Open betekent dat de ontvanger de melding nog niet heeft weggeklikt.`,`Latest ${delivery.data?.sample??0} in-app notifications. Open means the recipient has not dismissed the notification yet.`)}</p><div className="grid gap-2 sm:grid-cols-2">{(delivery.data?.groups??[]).map((group:any)=><div key={group.kind} className="rounded-lg border p-3"><strong className="text-sm">{group.kind}</strong><div className="mt-2 flex gap-3 text-xs text-muted-foreground"><span>{group.sent} {text("verzonden","sent")}</span><span>{group.open} {text("open","open")}</span><span>{group.dismissed} {text("afgesloten","dismissed")}</span></div></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>{text("Actuele statussen","Current statuses")}</CardTitle></CardHeader><CardContent className="space-y-3">{active.length===0?<p className="text-sm text-muted-foreground">{text("Er zijn geen actieve platformstatussen.","There are no active platform statuses.")}</p>:active.map((item:any)=><article key={item.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><Badge variant={item.severity==="critical"?"destructive":"secondary"}>{item.severity}</Badge><span className="text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString(locale)}</span></div><h3 className="mt-2 font-semibold">{text(item.title_nl,item.title_en)}</h3><p className="mt-1 text-sm text-muted-foreground">{text(item.body_nl,item.body_en)}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>edit(item)}><Pencil className="size-4"/>{text("Bijwerken","Update")}</Button><Button size="sm" onClick={()=>edit(item,true)}><CheckCircle2 className="size-4"/>{text("Opgelost melden","Mark resolved")}</Button></div></article>)}</CardContent></Card><Card><CardHeader><CardTitle>{text("Berichtgeschiedenis","Message history")}</CardTitle></CardHeader><CardContent className="max-h-[32rem] space-y-2 overflow-y-auto">{messages.isLoading?<p className="text-sm text-muted-foreground">{text("Laden…","Loading…")}</p>:(messages.data??[]).map((item:any)=><article key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.announcement_type==="status"?text("Status","Status"):text("Update","Update")}</Badge><Badge variant="secondary">{item.severity}</Badge><time className="ml-auto text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString(locale)}</time></div><p className="mt-2 text-sm font-medium">{text(item.title_nl,item.title_en)}</p></article>)}</CardContent></Card></div>
    <Dialog open={Boolean(form.statusKey)} onOpenChange={(open)=>{if(!open)setForm(empty);}}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form.severity==="resolved"?text("Status als opgelost melden","Mark status as resolved"):text("Platformstatus bijwerken","Update platform status")}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">{text("Ernst","Severity")}<select className="block h-10 w-full rounded-md border bg-background px-3" value={form.severity} onChange={e=>setForm({...form,severity:e.target.value as Form["severity"]})}><option value="info">Info</option><option value="warning">{text("Waarschuwing","Warning")}</option><option value="critical">{text("Kritiek","Critical")}</option><option value="resolved">{text("Opgelost","Resolved")}</option></select></label><span/><Input value={form.titleNl} onChange={e=>setForm({...form,titleNl:e.target.value})} maxLength={120}/><Input value={form.titleEn} onChange={e=>setForm({...form,titleEn:e.target.value})} maxLength={120}/><Textarea value={form.bodyNl} onChange={e=>setForm({...form,bodyNl:e.target.value})} maxLength={1000}/><Textarea value={form.bodyEn} onChange={e=>setForm({...form,bodyEn:e.target.value})} maxLength={1000}/></div><TranslationDraftButtons translating={busy} canTranslateNl={Boolean(form.titleNl.trim()&&form.bodyNl.trim())} canTranslateEn={Boolean(form.titleEn.trim()&&form.bodyEn.trim())} onTranslate={(direction)=>void translate(direction)}/><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setForm(empty)}>{text("Annuleren","Cancel")}</Button><Button disabled={busy||![form.titleNl,form.titleEn,form.bodyNl,form.bodyEn].every(value=>value.trim().length>=3)} onClick={()=>void publish()}><Send className="size-4"/>{form.severity==="resolved"?text("Oplossing publiceren","Publish resolution"):text("Statusupdate publiceren","Publish status update")}</Button></div></DialogContent></Dialog>
  </div>;
}
