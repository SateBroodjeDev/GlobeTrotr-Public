import { translationDraftMessage } from "@/lib/translation-errors";
import { createFileRoute } from "@tanstack/react-router";
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
  getCorporateAdminData,
  manageAdminRecord,
  saveKnownIssue,
  syncUnsyncedKnownIssues,
} from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";
import { createTranslationDraft } from "@/lib/translation.functions";
export const Route = createFileRoute("/_authenticated/corporate-admin/issues")({
  component: IssuesPage,
});
const empty = {
  titleNl: "",
  titleEn: "",
  descriptionNl: "",
  descriptionEn: "",
  category: "bug" as const,
  status: "investigating" as const,
  severity: "medium" as const,
  public: true,
};
function IssuesPage() {
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["corporate-admin-data"],
    queryFn: () => getCorporateAdminData(),
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
      const result = await saveKnownIssue({ data: form });
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
      ? text("Dit bekende probleem definitief verwijderen?", "Permanently delete this known issue?")
      : action === "archive"
        ? text("Dit bekende probleem archiveren?", "Archive this known issue?")
        : null;
    if (question && !confirm(question))
      return;
    try {
      await manageAdminRecord({ data: { kind: "issue", id, action } });
      queryClient.setQueryData(["corporate-admin-data"], (current: any) => current ? ({
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
      const result = await syncUnsyncedKnownIssues();
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
            `${result.synced} bekende problemen met GitHub gesynchroniseerd.`,
            `${result.synced} known issues synced with GitHub.`,
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
  const unsyncedCount = (query.data?.issues ?? []).filter(
    (issue: any) => !issue.archived_at && !issue.github_issue_number,
  ).length;
  const rows = (query.data?.issues ?? []).filter(
    (i: any) =>
      (archived || !i.archived_at) &&
      `${i.title_nl} ${i.title_en} ${i.description_nl}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      {!form.id && <Card>
        <CardHeader>
          <CardTitle>
            {form.id
              ? text("Probleem bewerken", "Edit issue")
              : text("Bekend probleem toevoegen", "Add known issue")}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.public}
              onChange={(e) => setForm({ ...form, public: e.target.checked })}
            />
            {text("Openbaar", "Public")}
          </label>
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
      </Card>}
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input
            className="min-w-60 flex-1"
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
              disabled={syncing}
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
          <DialogHeader><DialogTitle>{text("Bekend probleem bewerken", "Edit known issue")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titel NL"><Input value={form.titleNl} onChange={(e)=>setForm({...form,titleNl:e.target.value})}/></Field>
            <Field label="Title EN"><Input value={form.titleEn} onChange={(e)=>setForm({...form,titleEn:e.target.value})}/></Field>
            <Field label="Omschrijving NL"><Textarea value={form.descriptionNl} onChange={(e)=>setForm({...form,descriptionNl:e.target.value})}/></Field>
            <Field label="Description EN"><Textarea value={form.descriptionEn} onChange={(e)=>setForm({...form,descriptionEn:e.target.value})}/></Field>
            <Field label={text("Categorie","Category")}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value as any})}>{ISSUE_CATEGORIES.map(v=><option key={v} value={v}>{issueCategoryLabel(v,text)}</option>)}</select></Field>
            <Field label="Status"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as any})}>{["investigating","planned","monitoring","resolved"].map(v=><option key={v} value={v}>{statusLabel(v,text)}</option>)}</select></Field>
            <Field label={text("Ernst","Severity")}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.severity} onChange={(e)=>setForm({...form,severity:e.target.value as any})}>{["low","medium","high","critical"].map(v=><option key={v} value={v}>{severityLabel(v,text)}</option>)}</select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.public} onChange={(e)=>setForm({...form,public:e.target.checked})}/>{text("Openbaar","Public")}</label>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setForm(empty)}>{text("Annuleren","Cancel")}</Button><Button disabled={saving||![form.titleNl,form.titleEn,form.descriptionNl,form.descriptionEn].every(Boolean)} onClick={()=>void save()}>{saving?text("Opslaan…","Saving…"):text("Wijzigingen opslaan","Save changes")}</Button></div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle>{text("Bekende problemen", "Known issues")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((i: any) => (
            <div key={i.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{i.title_nl}</strong>
                <Badge>{issueCategoryLabel(i.category, text)}</Badge>
                <Badge variant="outline">{statusLabel(i.status, text)}</Badge>
                <Badge variant="outline">{severityLabel(i.severity, text)}</Badge>
                {i.github_issue_number && <Badge>GitHub #{i.github_issue_number}</Badge>}
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
                        public: i.public,
                      })
                    }
                  >
                    {text("Bewerken", "Edit")}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
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
