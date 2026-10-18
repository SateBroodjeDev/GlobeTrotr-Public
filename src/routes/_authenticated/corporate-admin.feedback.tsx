import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, Languages, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { issueCategoryLabel, ISSUE_CATEGORIES } from "@/lib/issue-categories";
import { getCorporateAdminData, manageAdminRecord, replyToFeedback, updateFeedbackStatus } from "@/lib/issues.functions";
import { statusLabel } from "@/lib/corporate-admin-ui";
import { useLocale } from "@/lib/locale";
import { createTranslationDraft } from "@/lib/translation.functions";
import { translationDraftMessage } from "@/lib/translation-errors";

export const Route = createFileRoute("/_authenticated/corporate-admin/feedback")({ component: FeedbackPage });

type Translation = { language: "nl" | "en"; title: string; description: string };

function FeedbackPage() {
  const { text, locale } = useLocale();
  const query = useQuery({ queryKey: ["corporate-admin-data"], queryFn: () => getCorporateAdminData() });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [archived, setArchived] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [translating, setTranslating] = useState("");

  async function answer(id: string) {
    const body = (reply[id] ?? "").trim();
    if (!body) return;
    try {
      await replyToFeedback({ data: { id, body } });
      setReply((current) => ({ ...current, [id]: "" }));
      await query.refetch();
      toast.success(text("Reactie opgeslagen en gebruiker geïnformeerd.", "Reply saved and user notified."));
    } catch {
      toast.error(text("Reactie kon niet worden opgeslagen.", "Reply could not be saved."));
    }
  }

  async function translateFeedback(item: any, target: "nl" | "en") {
    const key = `${item.id}:feedback:${target}`;
    setTranslating(key);
    try {
      const source = target === "nl" ? "en" : "nl";
      const [title, description] = await Promise.all([
        createTranslationDraft({ data: { text: item.title, source, target } }),
        createTranslationDraft({ data: { text: item.description, source, target } }),
      ]);
      setTranslations((current) => ({ ...current, [item.id]: { language: target, title: title.translated, description: description.translated } }));
      toast.success(text("Vertaalde leesweergave gemaakt.", "Translated reading view created."));
    } catch (error) {
      translationError(error, text);
    } finally {
      setTranslating("");
    }
  }

  async function translateReply(id: string, direction: "nl-en" | "en-nl") {
    const value = (reply[id] ?? "").trim();
    if (!value) return;
    const key = `${id}:reply:${direction}`;
    setTranslating(key);
    try {
      const result = await createTranslationDraft({ data: {
        text: value,
        source: direction === "nl-en" ? "nl" : "en",
        target: direction === "nl-en" ? "en" : "nl",
      } });
      setReply((current) => ({ ...current, [id]: result.translated }));
      toast.success(text("Antwoordconcept vertaald. Controleer het vóór verzenden.", "Reply draft translated. Review it before sending."));
    } catch (error) {
      translationError(error, text);
    } finally {
      setTranslating("");
    }
  }

  async function manage(id: string, action: "archive" | "restore" | "delete") {
    if (action === "delete" && !confirm(text("Definitief verwijderen?", "Permanently delete?"))) return;
    try {
      await manageAdminRecord({ data: { kind: "feedback", id, action } });
      await query.refetch();
    } catch {
      toast.error(text("Actie mislukt.", "Action failed."));
    }
  }

  const rows = (query.data?.feedback ?? []).filter((item: any) =>
    (archived || !item.archived_at) &&
    (category === "all" || item.category === category) &&
    `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
  );

  return <div className="space-y-4">
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_14rem_auto]">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Zoeken…", "Search…")} />
      <select className="h-10 rounded-md border bg-background px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="all">{text("Alle categorieën", "All categories")}</option>
        {ISSUE_CATEGORIES.map((value) => <option key={value} value={value}>{issueCategoryLabel(value, text)}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />{text("Archief tonen", "Show archive")}</label>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{text("Ontvangen feedback", "Received feedback")}</CardTitle></CardHeader><CardContent className="space-y-3">
      {rows.map((item: any) => {
        const translated = translations[item.id];
        return <article key={item.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{item.title}</strong><Badge>{issueCategoryLabel(item.category, text)}</Badge>
            <select className="rounded-md border bg-background px-2 py-1 text-xs" value={item.status} onChange={async(event) => { await updateFeedbackStatus({ data: { id: item.id, status: event.target.value as any } }); await query.refetch(); }}>
              {["new", "reviewing", "planned", "resolved", "closed"].map((value) => <option key={value} value={value}>{statusLabel(value, text)}</option>)}
            </select>
            {item.archived_at && <Badge>{text("Gearchiveerd", "Archived")}</Badge>}
            <span className="ml-auto flex gap-1">
              <Button size="icon" variant="outline" aria-label={item.archived_at ? text("Herstellen", "Restore") : text("Archiveren", "Archive")} onClick={() => void manage(item.id, item.archived_at ? "restore" : "archive")}>{item.archived_at ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}</Button>
              <Button size="icon" variant="destructive" aria-label={text("Verwijderen", "Delete")} onClick={() => void manage(item.id, "delete")}><Trash2 className="size-4" /></Button>
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
          <p className="mt-2 break-all text-xs text-muted-foreground">{item.page_url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={Boolean(translating)} onClick={() => void translateFeedback(item, "nl")}><TranslationIcon active={translating === `${item.id}:feedback:nl`} />{text("Lees in Nederlands", "Read in Dutch")}</Button>
            <Button size="sm" variant="outline" disabled={Boolean(translating)} onClick={() => void translateFeedback(item, "en")}><TranslationIcon active={translating === `${item.id}:feedback:en`} />{text("Lees in Engels", "Read in English")}</Button>
          </div>
          {translated && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2"><Badge variant="secondary">{translated.language.toUpperCase()} {text("concept", "draft")}</Badge><Button size="sm" variant="ghost" onClick={() => setTranslations((current) => { const next = { ...current }; delete next[item.id]; return next; })}>{text("Sluiten", "Close")}</Button></div>
            <strong className="mt-2 block">{translated.title}</strong><p className="mt-1 whitespace-pre-wrap text-sm">{translated.description}</p>
          </div>}
          <div className="mt-4 space-y-2 border-t pt-3">
            {(query.data?.feedbackReplies ?? []).filter((row: any) => row.feedback_id === item.id).map((row: any) => <div key={row.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="whitespace-pre-wrap">{row.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</p></div>)}
            <Textarea value={reply[item.id] ?? ""} maxLength={2000} placeholder={text("Schrijf een reactie of aanvullende vraag…", "Write a reply or follow-up question…")} onChange={(event) => setReply((current) => ({ ...current, [item.id]: event.target.value }))} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={Boolean(translating) || (reply[item.id] ?? "").trim().length < 2} onClick={() => void translateReply(item.id, "nl-en")}><TranslationIcon active={translating === `${item.id}:reply:nl-en`} />NL → EN</Button>
              <Button size="sm" variant="outline" disabled={Boolean(translating) || (reply[item.id] ?? "").trim().length < 2} onClick={() => void translateReply(item.id, "en-nl")}><TranslationIcon active={translating === `${item.id}:reply:en-nl`} />EN → NL</Button>
              <Button size="sm" disabled={(reply[item.id] ?? "").trim().length < 2 || Boolean(translating)} onClick={() => void answer(item.id)}>{text("Reactie versturen", "Send reply")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{text("Vertaling maakt alleen een concept en verzendt nooit automatisch.", "Translation only creates a draft and never sends automatically.")}</p>
          </div>
        </article>;
      })}
      {!query.isLoading && !rows.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text("Geen feedback gevonden.", "No feedback found.")}</p>}
    </CardContent></Card>
  </div>;
}

function TranslationIcon({ active }: { active: boolean }) {
  return active ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />;
}

function translationError(error: unknown, text: (nl: string, en: string) => string) {
  toast.error(translationDraftMessage(error, text));
}
