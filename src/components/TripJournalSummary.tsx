import { useEffect, useState } from "react";
import { BookOpenCheck, FileDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createJournalSummaryDraft } from "@/lib/journal-summary";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Source = { id: string; entry_date: string; title: string; body: string; location_name: string | null; photoItems?: { path: string; url: string }[]; photo_captions?: Record<string, string> | null };
type Visibility = "private" | "members" | "public";

export function TripJournalSummary({ tripId, tripName, entries, editable }: { tripId: string; tripName: string; entries: Source[]; editable: boolean }) {
  const { text, locale } = useLocale();
  const { user } = useAuth();
  const db = supabase as any;
  const [selected, setSelected] = useState<string[]>([]), [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("members"), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => { const { data } = await db.from("trip_journal_summaries").select("title,body,selected_entry_ids,visibility").eq("trip_uuid", tripId).maybeSingle(); if (data) { setTitle(data.title); setBody(data.body); setSelected(data.selected_entry_ids ?? []); setVisibility(data.visibility); setSaved(true); } })(); }, [db, tripId]);

  function generate() {
    const chosen = entries.filter((entry) => selected.includes(entry.id));
    if (!chosen.length) { toast.error(text("Kies eerst minimaal één herinnering.", "Select at least one memory first.")); return; }
    setBody(createJournalSummaryDraft(chosen.map((entry) => ({ id: entry.id, date: entry.entry_date, title: entry.title, body: entry.body, location: entry.location_name })), locale.startsWith("nl") ? "nl" : "en"));
    if (!title) setTitle(text(`Terugblik op ${tripName}`, `Looking back on ${tripName}`));
    setSaved(false);
    toast.info(text("Concept gemaakt. Controleer en bewerk het voordat je opslaat.", "Draft created. Review and edit it before saving."));
  }

  async function save() {
    if (!title.trim() || !body.trim()) { toast.error(text("Vul een titel en samenvatting in.", "Enter a title and summary.")); return; }
    setBusy(true);
    const { error } = await db.from("trip_journal_summaries").upsert({ trip_uuid: tripId, author_id: user?.id, title: title.trim(), body: body.trim(), selected_entry_ids: selected, visibility, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error(text("Samenvatting kon niet worden opgeslagen.", "Summary could not be saved.")); return; }
    setSaved(true);
    toast.success(text("Samenvatting opgeslagen.", "Summary saved."));
  }

  function pdf() {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.opener = null;
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    const articles = entries.filter((entry) => selected.includes(entry.id)).map((entry) => {
      const photos = (entry.photoItems ?? []).map((photo) => { const caption = entry.photo_captions?.[photo.path] ?? ""; return `<figure><img src="${escape(photo.url)}" alt="${escape(caption)}"><figcaption>${escape(caption)}</figcaption></figure>`; }).join("");
      return `<article><small>${escape(entry.entry_date)}${entry.location_name ? ` · ${escape(entry.location_name)}` : ""}</small><h2>${escape(entry.title)}</h2><p>${escape(entry.body).replaceAll("\n", "<br>")}</p><div class="photos">${photos}</div></article>`;
    }).join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title || tripName)}</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;color:#17333b}h1{font-size:32px}article{break-inside:avoid;border-top:1px solid #ccd;padding:18px 0}small,figcaption{color:#60777c}.photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;max-height:360px;object-fit:cover;border-radius:12px}figcaption{font-size:12px}@media print{button{display:none}body{margin:0}}</style></head><body><button onclick="print()">PDF opslaan / Save PDF</button><h1>${escape(title || tripName)}</h1><p>${escape(body).replaceAll("\n", "<br>")}</p>${articles}</body></html>`);
    popup.document.close();
  }

  return <Card className="surface"><CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-5 text-primary" />{text("Reissamenvatting", "Trip summary")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{text("Kies herinneringen, schrijf zelf of maak een controleerbaar concept. Er wordt nooit automatisch opgeslagen of gepubliceerd.", "Select memories, write your own summary or create a reviewable draft. Nothing is ever saved or published automatically.")}</p><div className="grid gap-2 sm:grid-cols-2">{entries.map((entry) => <label key={entry.id} className="flex gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={selected.includes(entry.id)} disabled={!editable} onChange={(event) => setSelected(event.target.checked ? [...selected, entry.id] : selected.filter((id) => id !== entry.id))} /><span><strong>{entry.title}</strong><span className="block text-xs text-muted-foreground">{entry.entry_date}{entry.location_name ? ` · ${entry.location_name}` : ""}</span></span></label>)}</div>{editable && <><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={generate}><Sparkles className="size-4" />{text("Maak samenvattingsconcept", "Create summary draft")}</Button><Button variant="outline" disabled={!body} onClick={pdf}><FileDown className="size-4" />{text("Eigen PDF", "Own PDF")}</Button></div><Input maxLength={160} value={title} placeholder={text("Titel van de terugblik", "Travel story title")} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} /><Textarea rows={8} maxLength={20000} value={body} placeholder={text("Schrijf je terugblik…", "Write your travel story…")} onChange={(event) => { setBody(event.target.value); setSaved(false); }} /><div className="flex flex-wrap items-center gap-3"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={visibility} onChange={(event) => { setVisibility(event.target.value as Visibility); setSaved(false); }}><option value="private">{text("Alleen ik", "Only me")}</option><option value="members">{text("Reisgenoten", "Travellers")}</option><option value="public">{text("Openbare reisterugblik", "Public travel story")}</option></select><Button disabled={busy || saved} onClick={() => void save()}>{saved ? text("Opgeslagen", "Saved") : text("Controleren en opslaan", "Review and save")}</Button></div></>}</CardContent></Card>;
}
