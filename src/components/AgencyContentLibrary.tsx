import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Copy, Library, Plus, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { applyAgencyContentItem, archiveAgencyContentItem, getAgencyContentLibrary, saveAgencyContentItem, type AgencyContentItem } from "@/lib/agency.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Text = (nl: string, en: string) => string;
type Draft = { id?: string; title: string; type: AgencyContentItem["type"]; status: AgencyContentItem["status"]; visibility: AgencyContentItem["visibility"]; locale: AgencyContentItem["locale"]; tags: string; summary: string; body: string; sourceUrl: string; licenseLabel: string };
const empty: Draft = { title: "", type: "destination", status: "draft", visibility: "organization", locale: "nl", tags: "", summary: "", body: "", sourceUrl: "", licenseLabel: "" };

export function AgencyContentLibrary({ text }: { text: Text }) {
  const query = useQuery({ queryKey: ["agency-content-library"], queryFn: () => getAgencyContentLibrary(), retry: false });
  const [draft, setDraft] = useState<Draft>(empty);
  const [open, setOpen] = useState(false);
  const [applyItem, setApplyItem] = useState<AgencyContentItem | null>(null);
  const [targetId, setTargetId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const target = query.data?.targets.find((item) => item.id === targetId);

  function edit(item?: AgencyContentItem) {
    setDraft(item ? { id: item.id, title: item.title, type: item.type, status: item.status, visibility: item.visibility, locale: item.locale, tags: item.tags.join(", "), summary: item.summary, body: item.body, sourceUrl: item.sourceUrl, licenseLabel: item.licenseLabel } : empty);
    setOpen(true);
  }
  function beginApply(item: AgencyContentItem) { setApplyItem(item); setTargetId(""); setTargetDate(""); }
  async function save() {
    setBusy(true);
    try { await saveAgencyContentItem({ data: { ...draft, tags: draft.tags.split(",") } }); await query.refetch(); setOpen(false); toast.success(text("Bibliotheekitem opgeslagen.", "Library item saved.")); }
    catch { toast.error(text("Bibliotheekitem kon niet worden opgeslagen.", "Library item could not be saved.")); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!applyItem || !target) return;
    setBusy(true);
    try {
      const result = await applyAgencyContentItem({ data: { itemId: applyItem.id, targetType: target.kind, targetId: target.id, targetDate: target.kind === "trip" ? targetDate || undefined : undefined } });
      setApplyItem(null);
      toast.success(result.result === "duplicate" ? text("Deze versie stond al op dit doel.", "This version was already added to this target.") : text("Item toegevoegd.", "Item added."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message.includes("QUOTE_TOO_LONG") ? text("De offertetekst zou langer dan 3.000 tekens worden.", "The quote copy would exceed 3,000 characters.") : message.includes("DATE_OUTSIDE") ? text("Kies een datum binnen de reis.", "Choose a date within the trip.") : text("Item kon niet worden toegevoegd.", "Item could not be added."));
    } finally { setBusy(false); }
  }
  async function archive(id: string) {
    if (!confirm(text("Dit item archiveren?", "Archive this item?"))) return;
    try { await archiveAgencyContentItem({ data: { id } }); await query.refetch(); toast.success(text("Item gearchiveerd.", "Item archived.")); }
    catch { toast.error(text("Item kon niet worden gearchiveerd.", "Item could not be archived.")); }
  }

  return <section className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Library className="size-5 text-primary" />{text("Contentbibliotheek", "Content library")}</h2><p className="mt-1 text-sm text-muted-foreground">{text("Bewaar gecontroleerde inhoud en voeg een vaste versie gericht toe aan een reis of offerte.", "Save reviewed content and add a fixed version to a trip or quote.")}</p></div>{query.data?.canManage && <Button onClick={() => edit()}><Plus className="size-4" />{text("Nieuw item", "New item")}</Button>}</header>
    {query.isError ? <p className="rounded-xl border border-destructive/30 p-4 text-sm">{text("De bibliotheek wordt beschikbaar na migraties 1590 en 1600.", "The library becomes available after migrations 1590 and 1600.")}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data?.items.map((item) => <Card key={item.id}><CardHeader><div className="flex justify-between gap-2"><CardTitle className="text-base">{item.title}</CardTitle><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.type}</span></div></CardHeader><CardContent className="space-y-3"><p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{item.summary || item.body}</p><div className="flex flex-wrap gap-1 text-xs"><span className="rounded bg-muted px-2 py-1">{item.locale.toUpperCase()}</span><span className="rounded bg-muted px-2 py-1">{item.status}</span><span className="rounded bg-muted px-2 py-1">v{item.version}</span>{item.tags.map((tag) => <span key={tag} className="rounded bg-primary/10 px-2 py-1">{tag}</span>)}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(item.body); toast.success(text("Tekst gekopieerd.", "Text copied.")); }}><Copy className="size-4" />{text("Kopieren", "Copy")}</Button>{query.data?.canManage && <><Button size="sm" onClick={() => beginApply(item)}><Send className="size-4" />{text("Toepassen", "Apply")}</Button><Button size="sm" variant="outline" onClick={() => edit(item)}>{text("Bewerken", "Edit")}</Button><Button size="icon" variant="ghost" aria-label={text("Archiveren", "Archive")} onClick={() => archive(item.id)}><Archive className="size-4" /></Button></>}</div></CardContent></Card>)}{query.data && !query.data.items.length && <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">{text("Nog geen bibliotheekitems.", "No library items yet.")}</p>}</div>}
    <EditDialog open={open} setOpen={setOpen} draft={draft} setDraft={setDraft} busy={busy} save={save} text={text} />
    <Dialog open={Boolean(applyItem)} onOpenChange={(value) => { if (!value) setApplyItem(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{text("Voorbeeld en toepassen", "Preview and apply")}</DialogTitle></DialogHeader>{applyItem && <div className="space-y-4"><div className="rounded-lg border bg-muted/30 p-4"><p className="font-semibold">{applyItem.title} <span className="text-xs font-normal text-muted-foreground">v{applyItem.version}</span></p><p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{applyItem.summary && `${applyItem.summary}\n\n`}{applyItem.body}</p></div><Field label={text("Doel", "Target")}><select className="h-10 w-full rounded-md border bg-background px-3" value={targetId} onChange={(e) => { const next = query.data?.targets.find((item) => item.id === e.target.value); setTargetId(e.target.value); setTargetDate(next?.kind === "trip" ? next.startDate : ""); }}><option value="">{text("Kies een reis of offerte", "Choose a trip or quote")}</option><optgroup label={text("Reizen", "Trips")}>{query.data?.targets.filter((item) => item.kind === "trip").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup><optgroup label={text("Offertes", "Quotes")}>{query.data?.targets.filter((item) => item.kind === "quote").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup></select></Field>{target?.kind === "trip" && <Field label={text("Datum in de reis", "Date within the trip")}><Input type="date" min={target.startDate || undefined} max={target.endDate || undefined} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>}<p className="text-xs text-muted-foreground">{target?.kind === "quote" ? text("De inhoud wordt onderaan de introductie gezet. De bestaande tekst blijft staan.", "The content is appended to the introduction. Existing copy remains intact.") : text("Accommodaties en activiteiten worden reisonderdelen; andere typen worden planningitems.", "Accommodation and activities become travel items; other types become itinerary items.")}</p><Button className="w-full" disabled={busy || !target || (target.kind === "trip" && !targetDate)} onClick={apply}><Send className="size-4" />{text("Deze versie toevoegen", "Add this version")}</Button></div>}</DialogContent></Dialog>
  </section>;
}

function EditDialog({ open, setOpen, draft, setDraft, busy, save, text }: { open: boolean; setOpen: (value: boolean) => void; draft: Draft; setDraft: (draft: Draft) => void; busy: boolean; save: () => void; text: Text }) {
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{draft.id ? text("Item bewerken", "Edit item") : text("Nieuw bibliotheekitem", "New library item")}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label={text("Titel", "Title")}><Input maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label={text("Soort", "Type")}><Select value={draft.type} set={(type) => setDraft({ ...draft, type: type as Draft["type"] })} options={["destination", "accommodation", "activity", "day_block", "text", "media"]} /></Field><Field label={text("Status", "Status")}><Select value={draft.status} set={(status) => setDraft({ ...draft, status: status as Draft["status"] })} options={["draft", "published"]} /></Field><Field label={text("Zichtbaarheid", "Visibility")}><Select value={draft.visibility} set={(visibility) => setDraft({ ...draft, visibility: visibility as Draft["visibility"] })} options={["organization", "personal"]} /></Field><Field label={text("Taal", "Language")}><Select value={draft.locale} set={(locale) => setDraft({ ...draft, locale: locale as Draft["locale"] })} options={["nl", "en"]} /></Field><Field label={text("Tags, gescheiden door komma's", "Tags, comma-separated")}><Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field><div className="sm:col-span-2"><Field label={text("Korte samenvatting", "Short summary")}><Textarea rows={3} maxLength={500} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></Field></div><div className="sm:col-span-2"><Field label={text("Inhoud", "Content")}><Textarea rows={10} maxLength={20000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field></div><Field label={text("Bron-URL (https)", "Source URL (https)")}><Input value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} /></Field><Field label={text("Licentie of gebruiksrecht", "Licence or usage right")}><Input maxLength={200} value={draft.licenseLabel} onChange={(e) => setDraft({ ...draft, licenseLabel: e.target.value })} /></Field><Button className="sm:col-span-2" disabled={busy || !draft.title.trim() || !draft.body.trim()} onClick={save}><Save className="size-4" />{text("Opslaan", "Save")}</Button></div></DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-sm"><span>{label}</span>{children}</label>; }
function Select({ value, set, options }: { value: string; set: (value: string) => void; options: string[] }) { return <select className="h-10 w-full rounded-md border bg-background px-3" value={value} onChange={(e) => set(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select>; }
