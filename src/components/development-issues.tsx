import { translationDraftMessage } from "@/lib/translation-errors";
import { developmentStats } from "@/lib/development";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TranslationDraftButtons, type TranslationDirection } from "@/components/TranslationDraftButtons";
import { Field, severityLabel, statusLabel } from "@/lib/corporate-admin-ui";
import { issueCategoryLabel, ISSUE_CATEGORIES } from "@/lib/issue-categories";
import {
  getDevelopmentData,
  manageDevelopmentRecord,
  saveDevelopmentIssue,
  syncDevelopmentIssues,
} from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";
import { createTranslationDraft } from "@/lib/translation.functions";
const empty = {
  titleNl: "",
  titleEn: "",
  descriptionNl: "",
  descriptionEn: "",
  category: "bug" as const,
  status: "investigating" as const,
  severity: "medium" as const,
};
export function DevelopmentIssues() {
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["development-data"],
    queryFn: () => getDevelopmentData(), retry: false, staleTime: 60_000, refetchOnWindowFocus: false,
  });
  const [form, setForm] = useState<typeof empty & { id?: string }>(empty);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  async function translate(direction: TranslationDirection) {
    const source = direction === "nl-en" ? "nl" : "en";
    const target = direction === "nl-en" ? "en" : "nl";
    const titleValue = direction === "nl-en" ? form.titleNl : form.titleEn;
    const descriptionValue = direction === "nl-en" ? form.descriptionNl : form.descriptionEn;
    if (!titleValue.trim() || !descriptionValue.trim()) return;
    setSaving(true);
    try {
      const [title,description]=await Promise.all([
        createTranslationDraft({data:{text:titleValue,source,target}}),
        createTranslationDraft({data:{text:descriptionValue,source,target}}),
      ]);
      setForm(current=>direction === "nl-en" ? {...current,titleEn:title.translated,descriptionEn:description.translated} : {...current,titleNl:title.translated,descriptionNl:description.translated});
      toast.success(text("Vertaalconcept gemaakt. Controleer het voor opslaan.","Translation draft created. Review it before saving."));
    } catch(error) {
      toast.error(translationDraftMessage(error, text));
    } finally { setSaving(false); }
  }
  async function save() {
    setSaving(true);
    try {
      const result = await saveDevelopmentIssue({ data: form });
      toast[result.github.synced ? "success" : "warning"](
        result.github.synced
          ? text("Opgeslagen en gesynchroniseerd.", "Saved and synced.")
          : text("Opgeslagen; GitHub-sync is mislukt.", "Saved; GitHub sync failed."),
      );
      setForm(empty);
      await query.refetch();
    } catch {
      toast.error(text("Opslaan mislukt.", "Saving failed."));
    } finally {
      setSaving(false);
    }
  }
  async function manage(id: string, action: "archive" | "restore" | "delete") {
    const question = action === "delete"
      ? text("Deze ontwikkeltaak definitief verwijderen?", "Permanently delete this development task?")
      : action === "archive"
        ? text("Deze ontwikkeltaak archiveren?", "Archive this development task?")
        : null;
    if (question && !confirm(question))
      return;
    try {
      await manageDevelopmentRecord({ data: { kind: "issue", id, action } });
      queryClient.setQueryData(["development-data"], (current: any) => current ? ({
        ...current,
        issues: action === "delete"
          ? current.issues.filter((issue: any) => issue.id !== id)
          : current.issues.map((issue: any) => issue.id === id
            ? { ...issue, archived_at: action === "archive" ? new Date().toISOString() : null }
            : issue),
      }) : current);
      await query.refetch();
      toast.success(action === "archive" ? text("Probleem gearchiveerd.", "Issue archived.") : action === "restore" ? text("Probleem hersteld.", "Issue restored.") : text("Probleem verwijderd.", "Issue deleted."));
    } catch {
      toast.error(text("De actie kon niet worden uitgevoerd.", "The action could not be completed."));
    }
  }
  async function syncMissingGithubIssues() {
    setSyncing(true);
    try {
      const result = await syncDevelopmentIssues();
      if (result.failed) {
        toast.warning(
          text(
            `${result.synced} gesynchroniseerd, ${result.failed} mislukt.`,
            `${result.synced} synced, ${result.failed} failed.`,
          ),
        );
      } else {
        toast.success(
          text(
            `${result.synced} ontwikkeltaken met GitHub gesynchroniseerd.`,
            `${result.synced} development tasks synced with GitHub.`,
          ),
        );
      }
      await query.refetch();
    } catch {
      toast.error(text("GitHub-synchronisatie is mislukt.", "GitHub synchronisation failed."));
    } finally {
      setSyncing(false);
    }
  }
  const loaded = query.data?.issues ?? [];
  const stats = developmentStats(loaded), unsyncedCount = stats.unlinked;
  const rows = (query.data?.issues ?? []).filter(
    (i: any) =>
      (archived || !i.archived_at) &&
      `${i.title_nl} ${i.title_en} ${i.description_nl}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <header className="space-y-2"><h2 className="font-display text-2xl font-semibold">Development</h2>
        <Button size="sm" variant="outline" disabled={query.isFetching || saving || syncing} onClick={() => void query.refetch()}>{text("Vernieuwen", "Refresh")}</Button>
        <p className="text-sm text-muted-foreground">{text("Ontwikkeltaken en de bestaande GitHub-koppeling. Dienststoringen en openbare updates beheer je bij Problemen > Incidenten.", "Development tasks and the existing GitHub integration. Manage service incidents and public updates under Issues > Incidents.")}</p>
        <p className="text-sm text-muted-foreground">{text("Synchroniseren deelt de titel en omschrijving met de ingestelde GitHub-repository. Voeg geen persoonsgegevens of geheimen toe; de repository kan openbaar zijn.", "Sync shares titles and descriptions with the configured GitHub repository. Do not include personal data or secrets; the repository may be public.")}</p>
        {query.data && <p className="text-sm">{query.data.syncConfigured ? text("GitHub-koppeling ingesteld", "GitHub integration configured") : text("GitHub-koppeling niet ingesteld", "GitHub integration not configured")}
          {query.data.repositoryUrl && <> {" \u00b7 "} <a className="underline" href={query.data.repositoryUrl+"/issues"} target="_blank" rel="noopener noreferrer">{text("Repository bekijken", "View repository")}</a></>}</p>}
      </header>
      {query.isPending ? <p role="status">{text("Laden...", "Loading...")}</p> : query.isError ? <p role="alert">{text("Ontwikkeltaken konden niet worden geladen.", "Development tasks could not be loaded.")}</p> : <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
          [text("Open", "Open"), stats.open],
          [text("Opgelost", "Resolved"), stats.resolved],
          [text("GitHub gekoppeld", "Linked to GitHub"), stats.linked],
          [text("Nog te koppelen", "Not linked yet"), unsyncedCount],
        ].map(([label,count])=><div key={String(label)} className="rounded-xl border p-3"><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{count}</strong></div>)}</div>
        <p className="text-xs text-muted-foreground">{text("Aantallen binnen de maximaal 500 geladen GlobeTrotr-taken. Dit zijn geen live GitHub-statistieken; gekoppeld bevestigt geen actuele synchronisatie.", "Counts cover up to 500 loaded GlobeTrotr tasks. These are not live GitHub statistics; a link does not confirm current synchronization.")}</p>
      </>}
      {!form.id && <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">{text("Ontwikkeltaak toevoegen", "Add development task")}</summary>
        <Card className="mt-4 border-0 shadow-none">
        <CardHeader>
          <CardTitle>
            {form.id
              ? text("Probleem bewerken", "Edit issue")
              : text("Ontwikkeltaak toevoegen", "Add development task")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel NL">
            <Input
              value={form.titleNl}
              onChange={(e) => setForm({ ...form, titleNl: e.target.value })}
            />
          </Field>
          <Field label="Title EN">
            <Input
              value={form.titleEn}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
            />
          </Field>
          <Field label="Omschrijving NL">
            <Textarea
              value={form.descriptionNl}
              onChange={(e) => setForm({ ...form, descriptionNl: e.target.value })}
            />
          </Field>
          <Field label="Description EN">
            <Textarea
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            />
          </Field>
          <Field label={text("Categorie", "Category")}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as any })}
            >
              {ISSUE_CATEGORIES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            >
              {["investigating", "planned", "monitoring", "resolved"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={text("Ernst", "Severity")}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
            >
              {["low", "medium", "high", "critical"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>

          <div className="space-y-3">
            <TranslationDraftButtons translating={saving} canTranslateNl={Boolean(form.titleNl.trim()&&form.descriptionNl.trim())} canTranslateEn={Boolean(form.titleEn.trim()&&form.descriptionEn.trim())} onTranslate={(direction)=>void translate(direction)}/>
            <Button
              disabled={
                saving ||
                !form.titleNl ||
                !form.titleEn ||
                !form.descriptionNl ||
                !form.descriptionEn
              }
              onClick={() => void save()}
            >
              {saving ? text("Opslaan…", "Saving…") : text("Opslaan", "Save")}
            </Button>
          </div>
        </CardContent>
      </Card></details>}
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input
            className="min-w-0 flex-1"
            aria-label={text("Ontwikkeltaken zoeken", "Search development tasks")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={text("Zoeken…", "Search…")}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            {text("Archief tonen", "Show archive")}
          </label>
          {unsyncedCount > 0 && (
            <Button
              variant="outline"
              disabled={syncing || saving || !query.data?.syncConfigured}
              onClick={() => void syncMissingGithubIssues()}
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {text(`GitHub synchroniseren (${unsyncedCount})`, `Sync GitHub (${unsyncedCount})`)}
            </Button>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(form.id)} onOpenChange={(open) => { if (!open) setForm(empty); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{text("Ontwikkeltaak bewerken", "Edit development task")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titel NL"><Input value={form.titleNl} onChange={(e)=>setForm({...form,titleNl:e.target.value})}/></Field>
            <Field label="Title EN"><Input value={form.titleEn} onChange={(e)=>setForm({...form,titleEn:e.target.value})}/></Field>
            <Field label="Omschrijving NL"><Textarea value={form.descriptionNl} onChange={(e)=>setForm({...form,descriptionNl:e.target.value})}/></Field>
            <Field label="Description EN"><Textarea value={form.descriptionEn} onChange={(e)=>setForm({...form,descriptionEn:e.target.value})}/></Field>
            <Field label={text("Categorie","Category")}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value as any})}>{ISSUE_CATEGORIES.map(v=><option key={v} value={v}>{issueCategoryLabel(v,text)}</option>)}</select></Field>
            <Field label="Status"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as any})}>{["investigating","planned","monitoring","resolved"].map(v=><option key={v} value={v}>{statusLabel(v,text)}</option>)}</select></Field>
            <Field label={text("Ernst","Severity")}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.severity} onChange={(e)=>setForm({...form,severity:e.target.value as any})}>{["low","medium","high","critical"].map(v=><option key={v} value={v}>{severityLabel(v,text)}</option>)}</select></Field>

          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setForm(empty)}>{text("Annuleren","Cancel")}</Button><Button disabled={saving||![form.titleNl,form.titleEn,form.descriptionNl,form.descriptionEn].every(Boolean)} onClick={()=>void save()}>{saving?text("Opslaan…","Saving…"):text("Wijzigingen opslaan","Save changes")}</Button></div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle>{text("Development", "Development")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!query.isPending && !query.isError && !rows.length && <p className="text-sm text-muted-foreground">{text("Geen ontwikkeltaken gevonden.", "No development tasks found.")}</p>}
          {rows.map((i: any) => (
            <div key={i.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{i.title_nl}</strong>
                <Badge>{issueCategoryLabel(i.category, text)}</Badge>
                <Badge variant="outline">{statusLabel(i.status, text)}</Badge>
                <Badge variant="outline">{severityLabel(i.severity, text)}</Badge>
                {i.github_issue_number && <Badge>{query.data?.repositoryUrl ? <a href={`${query.data.repositoryUrl}/issues/${i.github_issue_number}`} target="_blank" rel="noopener noreferrer">GitHub #{i.github_issue_number}</a> : <>GitHub #{i.github_issue_number}</>}</Badge>}
                <span className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: i.id,
                        titleNl: i.title_nl,
                        titleEn: i.title_en,
                        descriptionNl: i.description_nl,
                        descriptionEn: i.description_en,
                        category: i.category,
                        status: i.status,
                        severity: i.severity,
                      })
                    }
                  >
                    {text("Bewerken", "Edit")}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={i.archived_at ? text("Ontwikkeltaak herstellen", "Restore development task") : text("Ontwikkeltaak archiveren", "Archive development task")}
                    onClick={() => void manage(i.id, i.archived_at ? "restore" : "archive")}
                  >
                    {i.archived_at ? (
                      <RotateCcw className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    aria-label={text("Ontwikkeltaak verwijderen", "Delete development task")}
                    onClick={() => void manage(i.id, "delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{i.description_nl}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
