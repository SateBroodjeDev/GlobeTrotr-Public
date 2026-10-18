import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Circle, ClipboardCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  getInfrastructureAdminData,
  updateReleaseChecklistItem,
} from "@/lib/platform-operations.functions";
import { useLocale } from "@/lib/locale";

const categoryEn: Record<string, string> = {
  Account: "Account",
  Reizen: "Trips",
  Reisplanning: "Trip planning",
  Uitgaven: "Expenses",
  Samenwerking: "Collaboration",
  "Openbaar delen": "Public sharing",
  Agency: "Agency",
  "Corporate Admin": "Corporate Admin",
  Publiek: "Public website",
  Communicatie: "Communication",
  Release: "Release",
  Gebruikservaring: "User experience",
  Beveiliging: "Security",
};
type Scope = "open" | "core" | "agency" | "archived" | "all";
type ChecklistItem = {
  item_key: string;
  category: string;
  label_nl: string;
  label_en: string;
  notes?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
};
const isAgencyItem = (item: ChecklistItem) =>
  item.category.toLowerCase().includes("agency") ||
  /^(agency|self-hosted)\./.test(item.item_key) ||
  item.item_key === "corporate.self-hosted-mail";

export const Route = createFileRoute("/_authenticated/corporate-admin/release-checklist")({
  component: Page,
});

function Page() {
  const { text, locale } = useLocale();
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("open");
  const [queryText, setQueryText] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const query = useQuery({
    queryKey: ["infrastructure-admin"],
    queryFn: () => getInfrastructureAdminData(),
  });
  const mutation = useMutation({
    mutationFn: (item: ChecklistItem) =>
      updateReleaseChecklistItem({
        data: { itemKey: item.item_key, completed: !item.completed_at, notes: item.notes ?? "" },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["infrastructure-admin"] });
    },
    onError: () =>
      toast.error(text("Checklist kon niet worden bijgewerkt.", "Checklist could not be updated.")),
  });
  const allItems = useMemo(
    () => (query.data?.checklist ?? []) as ChecklistItem[],
    [query.data?.checklist],
  );
  const items = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return allItems.filter((item) => {
      const agency = isAgencyItem(item);
      if (scope === "open" && (item.completed_at || item.archived_at)) return false;
      if (scope === "core" && (agency || item.archived_at)) return false;
      if (scope === "agency" && (!agency || item.archived_at)) return false;
      if (scope === "archived" && !item.archived_at) return false;
      if (scope !== "archived" && scope !== "all" && item.archived_at) return false;
      if (openOnly && item.completed_at) return false;
      return (
        !needle ||
        `${item.item_key} ${item.category} ${item.label_nl} ${item.label_en}`
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [allItems, openOnly, queryText, scope]);
  const done = items.filter((item) => item.completed_at).length;
  const groups = Array.from(new Set(items.map((item) => item.category)));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            {text("Releasecontrole", "Release checks")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {text(
              "Je ziet standaard alleen de huidige update. Agency staat apart en hoeft nu niet getest te worden.",
              "Only the current update is shown by default. Agency is separate and does not need testing now.",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["open", text("Openstaand", "Open")],
                ["core", text("Kernplatform", "Core platform")],
                ["agency", text("Agency — later", "Agency — later")],
                ["archived", text("Archief", "Archive")],
                ["all", text("Alles", "Everything")],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={scope === value ? "default" : "outline"}
                onClick={() => setScope(value)}
              >
                {label}
              </Button>
            ))}
            {scope !== "open" && scope !== "archived" && (
              <Button
                type="button"
                size="sm"
                variant={openOnly ? "secondary" : "ghost"}
                onClick={() => setOpenOnly((value) => !value)}
              >
                {text("Alleen open", "Open only")}
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={text("Zoek in deze selectie", "Search this selection")}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              {done}/{items.length}{" "}
              {text("afgerond in deze selectie", "completed in this selection")}
            </span>
            <strong>{items.length ? Math.round((done / items.length) * 100) : 0}%</strong>
          </div>
          <Progress value={items.length ? (done / items.length) * 100 : 0} />
        </CardContent>
      </Card>
      {query.isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {text("Checklist laden…", "Loading checklist…")}
          </CardContent>
        </Card>
      )}
      {!query.isLoading && items.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {scope === "open"
              ? text(
                  "Er staan geen actieve implementatiechecks open. Nieuwe checks verschijnen hier automatisch.",
                  "There are no active implementation checks. New checks will appear here automatically.",
                )
              : text("Geen controles binnen deze selectie.", "No checks in this selection.")}
          </CardContent>
        </Card>
      )}
      {groups.map((category, index) => {
        const rows = items.filter((item) => item.category === category),
          categoryDone = rows.filter((item) => item.completed_at).length;
        return (
          <details
            key={category}
            open={scope === "open" || index === 0}
            className="group rounded-2xl border bg-card"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
              <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-semibold">
                  {text(category, categoryEn[category] ?? category)}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryDone}/{rows.length} {text("afgerond", "completed")}
                </p>
              </div>
              {categoryDone === rows.length && rows.length > 0 && (
                <CheckCircle2 className="size-5 text-emerald-600" />
              )}
            </summary>
            <div className="space-y-2 border-t p-4">
              {rows.map((item) => (
                <div
                  key={item.item_key}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${item.completed_at ? "border-emerald-500/25 bg-emerald-500/5" : ""}`}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={mutation.isPending || Boolean(item.archived_at)}
                    onClick={() => mutation.mutate(item)}
                    aria-label={text("Status wijzigen", "Change status")}
                  >
                    {item.completed_at ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <Circle className="size-5" />
                    )}
                  </Button>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {locale === "en-GB" ? item.label_en : item.label_nl}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.item_key}</p>
                    {item.archive_reason && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {item.archive_reason}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                    )}
                    {item.completed_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {text("Vastgelegd op", "Recorded on")}{" "}
                        {new Intl.DateTimeFormat(locale === "en-GB" ? "en-GB" : "nl-NL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.completed_at))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
