import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { csvCell } from "@/lib/exporters";
import { getCorporateAdminData } from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/audit")({
  component: AuditPage,
});

function download(entries: any[]) {
  const rows = [
    [
      "timestamp",
      "actor",
      "email",
      "action",
      "target_type",
      "target_id",
      "target_user",
      "target_email",
      "result",
      "reason",
      "details",
    ],
    ...entries.map((e) => [
      e.created_at,
      e.actorName,
      e.actorEmail,
      e.action,
      e.target_type,
      e.target_id,
      e.targetName,
      e.targetEmail,
      e.result,
      e.details?.reason ?? "",
      JSON.stringify(e.details ?? {}),
    ]),
  ];
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `globetrotr-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AuditPage() {
  const { text } = useLocale();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const query = useQuery({
    queryKey: ["corporate-admin-data"],
    queryFn: () => getCorporateAdminData(),
  });
  const entries = useMemo(
    () =>
      (query.data?.auditLog ?? []).filter((entry: any) => {
        const haystack = [
          entry.actorName,
          entry.actorEmail,
          entry.action,
          entry.target_type,
          entry.target_id,
          JSON.stringify(entry.details),
          auditAction(entry.action, text),
          auditSummary(entry, text),
        ]
          .join(" ")
          .toLowerCase();
        return (
          (result === "all" ||
            (result === "failure"
              ? ["failure", "failed"].includes(entry.result)
              : entry.result === result)) &&
          haystack.includes(search.trim().toLowerCase())
        );
      }),
    [query.data, result, search],
  );
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Auditlog</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(
              "Zoek wie welke beheeractie uitvoerde en exporteer het huidige resultaat.",
              "Find who performed each administrative action and export the current result.",
            )}
          </p>
        </div>
        <Button variant="outline" disabled={!entries.length} onClick={() => download(entries)}>
          <Download className="size-4" />
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={text(
                "Zoek beheerder, actie of doel",
                "Search administrator, action or target",
              )}
            />
          </label>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={result}
            onChange={(e) => setResult(e.target.value)}
          >
            <option value="all">{text("Alle resultaten", "All results")}</option>
            <option value="success">{text("Geslaagd", "Success")}</option>
            <option value="failure">{text("Mislukt", "Failed")}</option>
          </select>
        </div>
        {entries.slice(0, all ? entries.length : 20).map((entry: any) => (
          <div
            key={entry.id}
            className="grid gap-2 rounded-lg border px-3 py-2 text-xs sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_auto_auto] sm:items-center"
          >
            <div className="min-w-0">
              <strong className="block truncate">
                {entry.actorName || text("Onbekende beheerder", "Unknown administrator")}
              </strong>
              <span className="block truncate text-muted-foreground">
                {entry.actorEmail || entry.actor_user_id}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={entry.result === "success" ? "secondary" : "destructive"}>
                {entry.details?.phase === "queued"
                  ? text("In wachtrij", "Queued")
                  : entry.details?.phase === "requested"
                    ? text("Aangevraagd", "Requested")
                    : entry.result === "success"
                      ? text("Geslaagd", "Success")
                      : text("Mislukt", "Failed")}
              </Badge>
              <strong>{auditAction(entry.action, text)}</strong>
              <span className="w-full text-muted-foreground">{auditSummary(entry, text)}</span>
              {entry.target_type && <span>{entry.target_type}</span>}
              {entry.target_id && (
                <span className="max-w-48 truncate font-mono text-muted-foreground">
                  {entry.target_id}
                </span>
              )}
            </div>
            <time className="text-muted-foreground sm:text-right">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(entry.created_at))}
            </time>
            <Button size="sm" variant="ghost" onClick={() => setSelected(entry)}>
              <Eye className="size-4" />
              {text("Details", "Details")}
            </Button>
          </div>
        ))}
        {!entries.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {text("Geen activiteiten gevonden.", "No activity found.")}
          </p>
        )}
        {entries.length > 20 && (
          <Button variant="outline" onClick={() => setAll((value) => !value)}>
            {all
              ? text("Minder tonen", "Show less")
              : text(`Alle ${entries.length} tonen`, `Show all ${entries.length}`)}
          </Button>
        )}
        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{text("Auditdetails", "Audit details")}</DialogTitle>
            </DialogHeader>
            {selected && (
              <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
                <Detail
                  label={text("Actie", "Action")}
                  value={auditAction(selected.action, text)}
                />
                <Detail
                  label={text("Gebruiker", "User")}
                  value={`${selected.actorName || text("Onbekend", "Unknown")} (${selected.actorEmail || selected.actor_user_id || "—"})`}
                />
                <Detail
                  label={text("Waar", "Target")}
                  value={
                    [selected.target_type, selected.target_id].filter(Boolean).join(" · ") || "—"
                  }
                />
                {(selected.targetName || selected.targetEmail) && (
                  <Detail
                    label={text("Betrokken account", "Affected account")}
                    value={`${selected.targetName || text("Onbekend", "Unknown")} (${selected.targetEmail || selected.target_id})`}
                  />
                )}
                <Detail label={text("Resultaat", "Result")} value={selected.result} />
                <Detail
                  label={text("Tijdstip", "Timestamp")}
                  value={new Date(selected.created_at).toLocaleString()}
                />
                {Object.entries(selected.details ?? {}).map(([key, value]) => (
                  <Detail
                    key={key}
                    label={key === "reason" ? text("Reden", "Reason") : key}
                    value={formatDetail(value)}
                  />
                ))}
              </dl>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </>
  );
}
function formatDetail(value: unknown) {
  return typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "—");
}

function auditAction(action: string, text: (nl: string, en: string) => string) {
  const deployment = action.match(/^platform\.deployment\.([a-z-]+)\.requested$/)?.[1];
  const labels: Record<string, [string, string]> = {
    refresh: ["Releases ophalen", "Fetch releases"],
    deploy: ["Release uitrollen", "Deploy release"],
    rollback: ["Vorige release herstellen", "Restore previous release"],
    restart: ["Release-applicaties herstarten", "Restart release applications"],
    "service-check": ["Service testen", "Test service"],
    "service-start": ["Service starten", "Start service"],
    "service-restart": ["Service herstarten", "Restart service"],
    reboot: ["Server rebooten", "Reboot server"],
    "pause-auto": ["Automatische uitrol pauzeren", "Pause automatic deployment"],
    "resume-auto": ["Automatische uitrol hervatten", "Resume automatic deployment"],
    "confirm-sql": ["SQL voor release bevestigen", "Confirm release SQL"],
    "approve-infrastructure": ["Onderhoud bevestigen", "Confirm maintenance"],
    "booking-check": ["Boekingsmail controleren", "Check booking mail"],
    "booking-enable": ["Boekingsmail activeren", "Enable booking mail"],
    "backup-now": ["Back-up starten", "Start backup"],
    "platform.staff.save": [
      "Medewerker en rechten wijzigen",
      "Change staff member and permissions",
    ],
    "admin.dashboard.view": ["Beheeroverzicht bekijken", "View admin overview"],
    "admin.access": ["Beheerderstoegang controleren", "Check administrator access"],
    "user.delete": ["Account verwijderen", "Delete account"],
    "user.notification": ["Gebruiker een bericht sturen", "Send user a message"],
  };
  const pair = labels[deployment ?? action];
  return pair ? text(...pair) : action;
}
function auditSummary(entry: any, text: (nl: string, en: string) => string) {
  const d = entry.details ?? {};
  const pieces = [
    entry.targetName || entry.targetEmail,
    d.node,
    d.service,
    d.commit ? `${text("Commit", "Commit")}: ${String(d.commit).slice(0, 10)}` : null,
    d.role ? `${text("Rol", "Role")}: ${d.role}` : null,
  ];
  if (d.permissions && typeof d.permissions === "object")
    pieces.push(
      `${text("Rechten", "Permissions")}: ${Object.entries(d.permissions)
        .map(
          ([key, value]) =>
            `${key === "server_ops" ? text("serverbeheer", "server operations") : key}: ${value === true ? text("aan", "on") : text("uit", "off")}`,
        )
        .join(", ")}`,
    );
  if (d.reason) pieces.push(`${text("Reden", "Reason")}: ${d.reason}`);
  if (d.outcome) pieces.push(String(d.outcome));
  return pieces.filter(Boolean).join(" ? ");
}
