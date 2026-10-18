import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  MailCheck,
  Power,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getDeploymentControl, requestDeploymentAction } from "@/lib/deployment-control.functions";
import {
  deploymentSqlReview,
  type DeploymentNode,
  type DeploymentAction,
  type DeploymentRequest,
} from "@/lib/deployment-control";
import { useLocale } from "@/lib/locale";
import { getMyCorporateCapabilities } from "@/lib/corporate-business.functions";

export function DeploymentControlPanel() {
  const { text } = useLocale();
  const client = useQueryClient();
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [servicesNode, setServicesNode] = useState<DeploymentNode | null>(null);
  const servicesTrigger = useRef<HTMLButtonElement | null>(null);
  const [historyNode, setHistoryNode] = useState<DeploymentNode | null>(null);
  const access = useQuery({
    queryKey: ["corporate-capabilities"],
    queryFn: () => getMyCorporateCapabilities(),
    retry: false,
  });
  const query = useQuery({
    queryKey: ["deployment-control"],
    queryFn: () => getDeploymentControl(),
    enabled: access.data?.role === "owner",
    refetchInterval: 10000,
    retry: false,
  });
  const action = useMutation({
    mutationFn: (input: DeploymentRequest) => requestDeploymentAction({ data: input }),
    onSuccess: async () => {
      toast.success(
        text(
          "Actie aangevraagd. Volg de voortgang hieronder.",
          "Action queued. Follow progress below.",
        ),
      );
      await client.invalidateQueries({ queryKey: ["deployment-control"] });
    },
    onError: () =>
      toast.error(
        text(
          "Actie niet gestart. Controleer verbinding, eigenaarrechten en lopende taken.",
          "Action not started. Check connection, owner permissions and running jobs.",
        ),
      ),
  });
  const label = (code: string) =>
    ({
      CI_NOT_READY: text("Beheeragent gebruikt nog het oude controlebeleid; upgrade vereist", "Management agent still uses the previous check policy; upgrade required"),
      RELEASE_NOT_READY: text("Release nog niet vrijgegeven", "Release not marked ready"),
      SQL_NOT_CONFIRMED: text("SQL nog niet bevestigd", "SQL not confirmed"),
      INFRASTRUCTURE_NOT_CONFIRMED: text(
        "Infrastructuurwijziging vereist onderhoud",
        "Infrastructure change requires maintenance",
      ),
      BRANCH_DIVERGED: text(
        "Branch wijkt af: handmatig onderzoeken",
        "Branch diverged: manual investigation required",
      ),
      CHECKOUT_CHANGED: text(
        "Beheerconfiguratie gewijzigd: baseline controleren",
        "Management configuration changed: check baseline",
      ),
    })[code] || code;
  const actionLabel = (kind: string) =>
    ({
      refresh: text("Releases ophalen", "Fetch releases"),
      deploy: text("Release uitrollen", "Deploy release"),
      rollback: text("Vorige versie herstellen", "Restore previous version"),
      restart: text("Applicaties herstarten", "Restart applications"),
      "confirm-sql": text("SQL voor release bevestigen", "Confirm release SQL"),
      "approve-infrastructure": text("Onderhoud bevestigen", "Confirm maintenance"),
      "booking-check": text("Boekingsmail controleren", "Check booking mail"),
      "booking-enable": text("Boekingsmail activeren", "Enable booking mail"),
      "service-check": text("Service testen", "Test service"),
      "service-start": text("Service starten", "Start service"),
      "service-restart": text("Service herstarten", "Restart service"),
      reboot: text("Volledige server rebooten", "Reboot entire server"),
      "pause-auto": text("Automatische uitrol pauzeren", "Pause automatic deployment"),
      "resume-auto": text("Automatische uitrol hervatten", "Resume automatic deployment"),
      "backup-now": text("Versleutelde back-up maken", "Create encrypted backup"),
    })[kind] || kind;
  const statusLabel = (status: string) =>
    ({
      queued: text("In wachtrij", "Queued"),
      running: text("Bezig", "Running"),
      completed: text("Afgerond", "Completed"),
      failed: text("Mislukt", "Failed"),
      interrupted: text("Onderbroken", "Interrupted"),
      reboot_pending: text("Wacht op herstart van server", "Waiting for server reboot"),
    })[status] || status;
  const resultLabel = (result: string) =>
    ({
      SERVICE_CHECK_PASSED: text("Servicecontrole geslaagd", "Service check passed"),
      TRANSLATION_MODEL_TEST_PASSED: text(
        "Vertaalmodel getest: EN naar NL werkt",
        "Translation model tested: EN to NL works",
      ),
      HOST_REBOOT_SCHEDULED: text(
        "Reboot gepland; wacht op opnieuw verbinden",
        "Reboot scheduled; waiting to reconnect",
      ),
      HOST_REBOOT_COMPLETED: text("Nieuwe serverstart bevestigd", "New server boot confirmed"),
      HOST_REBOOT_NOT_COMPLETED: text(
        "Serverstart niet bevestigd; controleer Hetzner",
        "New server boot not confirmed; check Hetzner",
      ),
      ENCRYPTED_BACKUP_COMPLETED: text(
        "Versleutelde back-uptaak geslaagd",
        "Encrypted backup job completed",
      ),
      AUTO_DEPLOY_PAUSED: text("Automatische uitrol gepauzeerd", "Automatic deployment paused"),
      AUTO_DEPLOY_RESUMED: text("Automatische uitrol hervat", "Automatic deployment resumed"),
      SERVICE_NOT_INSTALLED: text(
        "Geen bestaande container gevonden",
        "No existing container found",
      ),
      SERVICE_NOT_HEALTHY: text("Service is niet gezond", "Service is not healthy"),
      SERVICE_RESTART_CHECK_FAILED: text(
        "Service na herstart niet gezond; controleer serverlogs",
        "Service unhealthy after restart; check server logs",
      ),
      TRANSLATION_TEST_FAILED: text("Vertaalmodeltest mislukt", "Translation model test failed"),
      IMAP_SYNC_NOT_READY: text(
        "Importinbox niet gereed of synchronisatie te oud",
        "Import inbox not ready or synchronization stale",
      ),
      SERVICE_CHECK_FAILED: text("Servicecontrole mislukt", "Service check failed"),
      HOST_REBOOT_PENDING: text(
        "Wacht tot de serverherstart is afgerond",
        "Wait for the server reboot to complete",
      ),
    })[result] || result;
  function request(
    node: DeploymentNode,
    kind: DeploymentAction,
    commit?: string,
    confirmed = false,
    service?: string,
  ) {
    if (
      [
        "deploy",
        "rollback",
        "restart",
        "booking-enable",
        "confirm-sql",
        "approve-infrastructure",
        "service-start",
        "service-restart",
        "reboot",
        "resume-auto",
        "backup-now",
      ].includes(kind) &&
      !window.confirm(
        text(
          `${actionLabel(kind)}${service ? ` (${service})` : ""} op ${node}?${kind === "reboot" ? " Alle diensten op deze server vallen tijdelijk weg." : ""}`,
          `${actionLabel(kind)}${service ? ` (${service})` : ""} on ${node}?${kind === "reboot" ? " All services on this server will be temporarily unavailable." : ""}`,
        ),
      )
    )
      return;
    action.mutate({ node, action: kind, commit, confirmed, service });
  }
  if (access.data?.role !== "owner") return null;
  const isOwner = access.data.role === "owner";
  return (
    <section className="space-y-5" aria-label={text("Productiebeheer", "Production control")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {text("Releases & servers", "Releases & servers")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {text(
              "Beheer de actieve versie op beide nodes. Releases komen van de ingestelde productiebranch, met releasevrijgave, SQL-bevestiging en herstel naar de vorige images.",
              "Manage the active version on both nodes. Releases come from the configured production branch, with release approval, SQL confirmation and previous-image recovery.",
            )}
          </p>
        </div>
        <Badge variant="outline">
          <GitBranch className="mr-1 size-3" />
          GitHub · 15 min
        </Badge>
      </div>
      {query.isPending && (
        <p role="status">{text("Serverstatus ophalen…", "Loading server status…")}</p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {text(
            "Serverstatus kon niet worden opgehaald. Controleer je eigenaarstatus en de verbinding.",
            "Server status could not be loaded. Check your owner status and connection.",
          )}
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {query.data?.map((entry) => {
          const state = entry.status;
          const release = state?.release;
          const rebootElsewhere = query.data?.some((other: any) => other.status?.rebootPending);
          const busy =
            action.isPending ||
            rebootElsewhere ||
            state?.automaticRunning ||
            state?.jobs?.some((job: any) =>
              ["queued", "running", "reboot_pending"].includes(job.status),
            );
          const supports = (kind: string) => state?.capabilities?.includes(kind) === true;
          const commit = release?.tip;
          const sqlReview = release ? deploymentSqlReview(release) : null;
          const alreadyActive = !!commit && commit === state?.active;
          const failedDeployment = state?.jobs?.some(
            (job: any) =>
              job.action === "deploy" && job.commit === commit && job.status === "failed",
          );
          const sqlKey = `${entry.node}:${commit}:sql:${sqlReview?.mode}:${JSON.stringify(sqlReview?.files)}`;
          const infraKey = `${entry.node}:${commit}:infra`;
          const rebootKey = `${entry.node}:reboot`;
          return (
            <Card key={entry.node} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Server className="size-5" />
                    {entry.node === "node-01" ? "Node-01 · Web" : "Node-02 · Worker & mail"}
                  </span>
                  <Badge variant={entry.connected ? "secondary" : "destructive"}>
                    {entry.connected
                      ? text("Verbonden", "Connected")
                      : text("Niet verbonden", "Disconnected")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {!entry.connected ? (
                  <p className="text-sm text-muted-foreground">
                    {text(
                      "Installeer eenmalig de private beheeragent en configureer de verbinding volgens SERVER_OPERATIONS. Een uitgeschakelde host kan dit paneel niet opstarten.",
                      "Install the private management agent and configure connectivity using SERVER_OPERATIONS. This panel cannot power on a stopped host.",
                    )}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border p-3">
                        <p className="text-xs text-muted-foreground">
                          {text("Actieve commit", "Active commit")}
                        </p>
                        <code className="text-sm">{state.active?.slice(0, 10) || "—"}</code>
                        <p className="mt-1 text-xs text-muted-foreground">
                          GitHub: {release?.branch === "main" ? "main" : text("onbekend", "unknown")}
                        </p>
                      </div>
                      <div className="rounded-xl border p-3">
                        <p className="text-xs text-muted-foreground">
                          {text("Automatische controle", "Automatic checks")}
                        </p>
                        <strong className="text-sm">
                          {state.timerActive
                            ? text("Actief", "Active")
                            : text("Gepauzeerd", "Paused")}
                        </strong>
                        {state.lastPollAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {text("Laatste servercontrole", "Last server check")}:{" "}
                            {new Date(state.lastPollAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {state.host && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border p-3">
                          <p className="text-xs text-muted-foreground">
                            {text("Geheugen", "Memory")}
                          </p>
                          <strong>{state.host.memoryUsedPercent}%</strong>
                        </div>
                        <div className="rounded-xl border p-3">
                          <p className="text-xs text-muted-foreground">{text("Schijf", "Disk")}</p>
                          <strong>
                            {state.host.diskUsedPercent}% · {state.host.diskFreeGiB} GiB{" "}
                            {text("vrij", "free")}
                          </strong>
                        </div>
                        <div className="rounded-xl border p-3">
                          <p className="text-xs text-muted-foreground">
                            {text("Uptime", "Uptime")}
                          </p>
                          <strong>
                            {Math.floor(state.host.uptimeSeconds / 3600)}h{" "}
                            {Math.floor((state.host.uptimeSeconds % 3600) / 60)}m
                          </strong>
                        </div>
                        <div className="rounded-xl border p-3">
                          <p className="text-xs text-muted-foreground">
                            {text("Serverbelasting", "Server load")}
                          </p>
                          <strong>{state.host.load1}</strong>
                        </div>
                      </div>
                    )}
                    {!supports("reboot") && (
                      <p className="text-sm text-amber-700">
                        {text(
                          "Werk de beheeragent bij om services en de volledige server te kunnen beheren.",
                          "Update the management agent to manage individual services and the entire server.",
                        )}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {
                        state.services.filter((service: any) =>
                          ["healthy", "running"].includes(service.status),
                        ).length
                      }
                      /{state.services.length} {text("services draaien", "services running")}
                      {state.services.some(
                        (service: any) => !["healthy", "running"].includes(service.status),
                      ) && (
                        <span className="ml-2 text-amber-600">
                          {text("Controle nodig", "Check required")}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busy || !supports(state.timerActive ? "pause-auto" : "resume-auto")
                        }
                        onClick={() =>
                          request(
                            entry.node,
                            state.timerActive ? "pause-auto" : "resume-auto",
                            undefined,
                            !state.timerActive,
                          )
                        }
                      >
                        {state.timerActive
                          ? text("Uitrol pauzeren", "Pause deployments")
                          : text("Uitrol hervatten", "Resume deployments")}
                      </Button>
                      {entry.node === "node-02" && supports("backup-now") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => request(entry.node, "backup-now")}
                        >
                          {text("Back-up maken", "Create backup")}
                        </Button>
                      )}
                    </div>
                    {state.recovering && (
                      <p role="alert" className="text-sm text-destructive">
                        {text(
                          busy
                            ? "Uitrol bezig. De vorige versie blijft beschikbaar voor herstel."
                            : "Een onderbroken uitrol wacht op herstel. Controleer de taak en vorige images.",
                          busy
                            ? "Deployment in progress. The previous version remains available for recovery."
                            : "An interrupted deployment needs recovery. Check the job and previous images.",
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => request(entry.node, "refresh")}
                      >
                        <RefreshCw className="size-4" />
                        {text("Releases ophalen", "Fetch releases")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={(event) => {
                          servicesTrigger.current = event.currentTarget;
                          setServicesNode(entry.node);
                        }}
                      >
                        <RotateCcw className="size-4" />
                        {text("Services", "Services")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !state.previous}
                        onClick={() => request(entry.node, "rollback")}
                      >
                        {text("Vorige versie herstellen", "Restore previous version")}
                      </Button>
                    </div>
                    {release && (
                      <div className="space-y-3 rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm">
                            {text("Nieuwste release", "Latest release")}
                          </strong>
                          <code className="text-xs">{commit?.slice(0, 10)}</code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {text("Laatste release-inventarisatie", "Last release inventory")}:{" "}
                          {new Date(release.checkedAt).toLocaleString()}
                        </p>
                        {alreadyActive && (
                          <p
                            role="status"
                            className="flex items-center gap-2 text-sm text-emerald-600"
                          >
                            <CheckCircle2 className="size-4" />
                            {text(
                              "Deze release is al actief op deze node.",
                              "This release is already active on this node.",
                            )}
                          </p>
                        )}
                        {release.blockers.map((code: string) => (
                          <p key={code} className="flex items-start gap-2 text-sm">
                            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            {label(code)}
                          </p>
                        ))}
                        {release.blockers.includes("RELEASE_NOT_READY") && !alreadyActive && (
                          <p className="text-xs text-muted-foreground">
                            {text(
                              "Deze commit is nog niet door de ontwikkelaar vrijgegeven voor productie. Wacht op de afgeronde release; een SQL-bevestiging heft deze blokkade niet op.",
                              "The developer has not marked this commit ready for production. Wait for the completed release; SQL confirmation does not remove this blocker.",
                            )}
                          </p>
                        )}
                        {isOwner &&
                          sqlReview &&
                          sqlReview.mode !== "none" &&
                          !release.sqlConfirmed &&
                          !alreadyActive && (
                            <div className="space-y-2 rounded-lg bg-muted p-3">
                              <strong className="text-sm">
                                {sqlReview.mode === "existing"
                                  ? text("Bestaande SQL bevestigen", "Confirm existing SQL")
                                  : sqlReview.mode === "changed"
                                    ? text("Gewijzigde SQL beoordelen", "Review changed SQL")
                                    : text(
                                        "SQL-inventaris niet beschikbaar",
                                        "SQL inventory unavailable",
                                      )}
                              </strong>
                              <p className="text-xs text-muted-foreground">
                                {sqlReview.mode === "existing"
                                  ? text(
                                      "Er zijn geen gewijzigde SQL-bestanden ten opzichte van de actieve versie. Deze release gebruikt bestaande SQL. Controleer de release-instructies en bevestig dat die SQL al is toegepast en gecontroleerd. Voer toegepaste migraties niet opnieuw uit.",
                                      "No SQL files have changed since the active version. This release uses existing SQL. Check the release instructions and confirm that SQL is already applied and verified. Do not rerun applied migrations.",
                                    )
                                  : sqlReview.mode === "changed"
                                    ? text(
                                        "Onderstaande SQL-bestanden verschillen van de actieve versie. Lees de release-instructies en voer alleen de benodigde, nog niet toegepaste migraties of rollbacktests uit. Beoordeel ook gewijzigde of verwijderde bestanden; draai toegepaste migraties niet opnieuw.",
                                        "The SQL files below differ from the active version. Read the release instructions and run only required migrations not yet applied or rollback tests. Review changed or removed files too; do not rerun applied migrations.",
                                      )
                                    : text(
                                        "Haal releases opnieuw op. Zonder een volledige SQL-inventaris kun je deze release hier niet bevestigen.",
                                        "Fetch releases again. Without a complete SQL inventory you cannot confirm this release here.",
                                      )}
                              </p>
                              <ul className="space-y-1 text-xs">
                                {sqlReview.files.map((file) => (
                                  <li key={file} className="break-all">
                                    <code>{file}</code>
                                  </li>
                                ))}
                              </ul>
                              {sqlReview.mode !== "unknown" && !sqlReview.canConfirm && (
                                <p role="status" className="text-xs text-muted-foreground">
                                  {text(
                                    "Bevestigen kan zodra deze exacte commit voor productie is vrijgegeven en de release-inventaris beschikbaar is. Wacht daarop om een tussencommit niet onnodig te bevestigen.",
                                    "Confirmation becomes available once this exact commit is marked ready for production and the release inventory is available. Wait for that to avoid confirming an intermediate commit.",
                                  )}
                                </p>
                              )}
                              {sqlReview.canConfirm && (
                                <>
                                  <label className="flex gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={!!acknowledged[sqlKey]}
                                      onChange={(event) =>
                                        setAcknowledged({
                                          ...acknowledged,
                                          [sqlKey]: event.target.checked,
                                        })
                                      }
                                    />
                                    {text(
                                      sqlReview.mode === "existing"
                                        ? "Ik bevestig dat de benodigde bestaande SQL voor deze exacte commit al is toegepast en gecontroleerd."
                                        : "Ik heb de SQL-wijzigingen beoordeeld en de benodigde SQL voor deze exacte commit toegepast en gecontroleerd.",
                                      sqlReview.mode === "existing"
                                        ? "I confirm the required existing SQL for this exact commit is already applied and verified."
                                        : "I reviewed the SQL changes and applied and verified the required SQL for this exact commit.",
                                    )}
                                  </label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      busy || !supports("confirm-sql") || !acknowledged[sqlKey]
                                    }
                                    onClick={() => request(entry.node, "confirm-sql", commit, true)}
                                  >
                                    <CheckCircle2 className="size-4" />
                                    {text("SQL voor release bevestigen", "Confirm release SQL")}
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        {isOwner &&
                          release.requiresInfrastructure &&
                          !release.infrastructureConfirmed && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                {text(
                                  "Deze release verandert server-/buildconfiguratie. De bevestiging installeert geen scripts of configuratie.",
                                  "This release changes server/build configuration. Confirmation does not install scripts or configuration.",
                                )}
                              </p>
                              <label className="flex gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={!!acknowledged[infraKey]}
                                  onChange={(event) =>
                                    setAcknowledged({
                                      ...acknowledged,
                                      [infraKey]: event.target.checked,
                                    })
                                  }
                                />
                                {text(
                                  "Benodigd onderhoud voor deze commit is uitgevoerd.",
                                  "Required maintenance for this commit is complete.",
                                )}
                              </label>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || !acknowledged[infraKey]}
                                onClick={() =>
                                  request(entry.node, "approve-infrastructure", commit, true)
                                }
                              >
                                {text("Onderhoud bevestigen", "Confirm maintenance")}
                              </Button>
                            </div>
                          )}
                        <Button
                          disabled={busy || release.blockers.length > 0 || commit === state.active}
                          onClick={() => request(entry.node, "deploy", commit)}
                        >
                          <ArrowUpCircle className="size-4" />
                          {text(
                            alreadyActive
                              ? "Release is actief"
                              : failedDeployment
                                ? "Uitrol opnieuw starten"
                                : "Nieuwe release uitrollen",
                            alreadyActive
                              ? "Release is active"
                              : failedDeployment
                                ? "Retry deployment"
                                : "Deploy new release",
                          )}
                        </Button>
                        <div className="space-y-2 border-t pt-3">
                          {release.commits.map((item: any) => (
                            <a
                              key={item.commit}
                              href={`https://github.com/SateBroodjeDev/GlobeTrotr-App/commit/${item.commit}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start justify-between gap-2 text-sm hover:text-primary"
                            >
                              <span className="min-w-0 break-words">
                                {item.title}
                                <code className="ml-2 text-xs text-muted-foreground">
                                  {item.commit.slice(0, 7)}
                                </code>
                              </span>
                              <ExternalLink className="size-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {supports("reboot") && (
                      <details className="space-y-3 rounded-xl border border-destructive/30 p-4">
                        <summary className="cursor-pointer font-medium">
                          {text("Volledige server rebooten", "Reboot entire server")}
                        </summary>
                        <p className="text-sm text-muted-foreground">
                          {text(
                            "Alle diensten op deze node worden kort onderbroken. De reboot start na 15 seconden. Doe één node tegelijk en wacht tot deze weer verbonden en gezond is.",
                            "All services on this node will be briefly interrupted. Reboot starts after 15 seconds. Reboot one node at a time and wait until it reconnects and is healthy.",
                          )}
                        </p>
                        {state.rebootPending && (
                          <p role="status">
                            {text(
                              "Serverherstart aangevraagd; wacht op opnieuw verbinden.",
                              "Server reboot requested; waiting to reconnect.",
                            )}
                          </p>
                        )}
                        <label className="flex gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!acknowledged[rebootKey]}
                            onChange={(event) =>
                              setAcknowledged({
                                ...acknowledged,
                                [rebootKey]: event.target.checked,
                              })
                            }
                          />
                          {text(
                            "Ik wil de volledige server herstarten en accepteer de tijdelijke onderbreking.",
                            "I want to reboot the entire server and accept temporary downtime.",
                          )}
                        </label>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy || state.recovering || !acknowledged[rebootKey]}
                          onClick={() => {
                            request(entry.node, "reboot", undefined, true);
                            setAcknowledged({ ...acknowledged, [rebootKey]: false });
                          }}
                        >
                          <Power className="size-4" />
                          {text("Server rebooten", "Reboot server")}
                        </Button>
                      </details>
                    )}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{text("Recente taken", "Recent jobs")}</h3>
                        {state.jobs.length > 3 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHistoryNode(entry.node)}
                          >
                            {text("Alle taken bekijken", "View all jobs")} ({state.jobs.length})
                          </Button>
                        )}
                      </div>
                      {state.jobs.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {text("Nog geen beheertaken uitgevoerd.", "No management jobs yet.")}
                        </p>
                      )}
                      {[...state.jobs]
                        .reverse()
                        .slice(0, 3)
                        .map((job: any) => (
                          <div key={job.id} className="rounded-lg border p-3 text-xs">
                            <p className="flex justify-between gap-2">
                              <strong>
                                {actionLabel(job.action)}
                                {job.service ? ` · ${job.service}` : ""}
                              </strong>
                              <span>{statusLabel(job.status)}</span>
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString()}
                            </p>
                            {typeof job.result === "string" && (
                              <p className="mt-1 break-words">{resultLabel(job.result)}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog
        open={servicesNode !== null}
        onOpenChange={(open) => {
          if (!open) setServicesNode(null);
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            servicesTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {text("Services", "Services")} · {servicesNode}
            </DialogTitle>
            <DialogDescription>
              {text(
                "Bekijk de status, test of herstart een service. Een herstart onderbreekt alleen de gekozen service.",
                "View status, test or restart a service. Restarting interrupts only the selected service.",
              )}
            </DialogDescription>
          </DialogHeader>
          {query.data
            ?.filter((entry) => entry.node === servicesNode)
            .map((entry) => {
              const state = entry.status;
              const busy =
                action.isPending ||
                state?.automaticRunning ||
                query.data?.some((other) => other.status?.rebootPending) ||
                state?.jobs?.some((job: any) =>
                  ["queued", "running", "reboot_pending"].includes(job.status),
                );
              const supports = (kind: string) => state?.capabilities?.includes(kind) === true;
              const bookingKey = `${entry.node}:booking`;
              const bookingReady =
                state?.bookingEnabledConfigured === true && state?.bookingEnabledRuntime === true;
              const latestCheck = state?.jobs
                ?.filter(
                  (job: any) =>
                    ["booking-check", "booking-enable"].includes(job.action) &&
                    job.status === "completed",
                )
                .at(-1)?.result;
              return (
                <div key={entry.node} className="space-y-4">
                  <div className="space-y-2">
                    {state?.services?.map((service: any) => (
                      <div
                        key={service.name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <Badge
                          variant={
                            ["healthy", "running"].includes(service.status)
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          <Activity className="mr-1 size-3" />
                          {service.name}:{" "}
                          {service.status === "healthy"
                            ? text("Gezond", "Healthy")
                            : service.status === "running"
                              ? text("Draait", "Running")
                              : service.status === "not_installed"
                                ? text("Niet geïnstalleerd", "Not installed")
                                : service.status === "exited"
                                  ? text("Gestopt", "Stopped")
                                  : service.status === "unhealthy"
                                    ? text(
                                        "Draait, gezondheidscontrole mislukt",
                                        "Running, health check failed",
                                      )
                                    : service.status === "starting"
                                      ? text("Gezondheidscontrole start", "Health check starting")
                                      : service.status === "unknown"
                                        ? text("Status niet beschikbaar", "Status unavailable")
                                        : text("Controleren", "Check required")}
                        </Badge>
                        {state?.capabilities?.includes("service-check") && (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || service.status === "not_installed"}
                              onClick={() =>
                                request(entry.node, "service-check", undefined, false, service.name)
                              }
                            >
                              {text("Testen", "Test")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                busy || ["not_installed", "unknown"].includes(service.status)
                              }
                              onClick={() =>
                                request(
                                  entry.node,
                                  service.status === "exited" || service.status === "created"
                                    ? "service-start"
                                    : "service-restart",
                                  undefined,
                                  true,
                                  service.name,
                                )
                              }
                            >
                              {service.status === "exited" || service.status === "created"
                                ? text("Starten", "Start")
                                : text("Herstarten", "Restart")}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <details className="group rounded-xl bg-muted/40 p-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
                      <MailCheck className="size-4 text-primary" />
                      {text("Boekingsmail", "Booking mail")}
                      <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 space-y-3">
                      {bookingReady && (
                        <p className="flex items-center gap-2 text-sm text-primary">
                          <CheckCircle2 className="size-4" />
                          {text("Boekingsmail is ingeschakeld.", "Booking mail is enabled.")}
                        </p>
                      )}
                      {state?.bookingEnabledConfigured === true &&
                        state?.bookingEnabledRuntime == null && (
                          <p role="status" className="text-sm text-muted-foreground">
                            {text(
                              "Boekingsmail is ingesteld. De actieve servicestatus is tijdelijk niet beschikbaar; opnieuw instellen is niet nodig.",
                              "Booking mail is configured. The active service status is temporarily unavailable; no setup is needed.",
                            )}
                          </p>
                        )}
                      <p className="text-sm">
                        {text("Serverinstelling", "Server setting")}:{" "}
                        {state?.bookingEnabledConfigured === true
                          ? text("Aan", "Enabled")
                          : state?.bookingEnabledConfigured === false
                            ? text("Uit", "Disabled")
                            : text("Status niet beschikbaar", "Status unavailable")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {text("Actieve import/webinstelling", "Active import/web setting")}:{" "}
                        {state?.bookingEnabledRuntime === true
                          ? text("Aan", "Enabled")
                          : state?.bookingEnabledRuntime === false
                            ? text("Uit", "Disabled")
                            : text("Status niet beschikbaar", "Status unavailable")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {text(
                          "Controleer en activeer eerst Node-02, daarna Node-01. Een groene diagnose bewijst geen aflevering; stuur daarna een echte bevestiging naar een reisadres.",
                          "Check and enable Node-02 first, then Node-01. A green diagnosis does not prove delivery; forward a real confirmation to a trip address afterwards.",
                        )}
                      </p>
                      {latestCheck && typeof latestCheck === "object" && (
                        <div className="rounded-lg bg-muted p-3 text-xs">
                          <p>
                            {text(
                              "Inbox gereed / recent gesynchroniseerd",
                              "Inbox ready / recently synced",
                            )}
                            :{" "}
                            {latestCheck.inboxReady && latestCheck.inboxSynced
                              ? text("Ja", "Yes")
                              : text("Nee", "No")}
                          </p>
                          <p>
                            {text("Actieve reisadressen", "Active trip addresses")}:{" "}
                            {latestCheck.activeAddresses || 0}
                          </p>
                          {latestCheck.findings?.map((finding: string) => (
                            <p key={finding}>{finding}</p>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !entry.connected || !supports("booking-check")}
                        onClick={() => request(entry.node, "booking-check")}
                      >
                        {text("Boekingsmail controleren", "Check booking mail")}
                      </Button>
                      {isOwner &&
                        (state?.bookingEnabledConfigured === false ||
                          state?.bookingEnabledRuntime === false) &&
                        entry.connected &&
                        supports("booking-enable") && (
                          <>
                            <label className="flex gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!acknowledged[bookingKey]}
                                onChange={(event) =>
                                  setAcknowledged({
                                    ...acknowledged,
                                    [bookingKey]: event.target.checked,
                                  })
                                }
                              />
                              {text(
                                "De exacte trip-adresregel in Stalwart is ingesteld; geen catch-all. Ik wil de import activeren.",
                                "The exact trip-address rule in Stalwart is configured; no catch-all. I want to enable import.",
                              )}
                            </label>
                            <Button
                              size="sm"
                              disabled={busy || !acknowledged[bookingKey]}
                              onClick={() => request(entry.node, "booking-enable", undefined, true)}
                            >
                              {text(
                                state?.bookingEnabledConfigured
                                  ? "Opnieuw activeren"
                                  : "Boekingsmail activeren",
                                state?.bookingEnabledConfigured
                                  ? "Enable again"
                                  : "Enable booking mail",
                              )}
                            </Button>
                          </>
                        )}
                    </div>
                  </details>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => request(entry.node, "restart")}
                  >
                    {text(
                      "Release-applicaties samen herstarten",
                      "Restart release applications together",
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {text(
                      "De gezamenlijke herstart betreft de release-applicaties; overige services herstart je afzonderlijk hierboven.",
                      "The combined restart covers release applications; restart other services individually above.",
                    )}
                  </p>
                </div>
              );
            })}
        </DialogContent>
      </Dialog>
      <Dialog
        open={historyNode !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryNode(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {text("Taakgeschiedenis", "Job history")} · {historyNode}
            </DialogTitle>
            <DialogDescription>
              {text(
                "Alle beschikbare beheertaken, nieuwste eerst.",
                "All available management jobs, newest first.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[...(query.data?.find((entry) => entry.node === historyNode)?.status?.jobs ?? [])]
              .reverse()
              .map((job: any) => (
                <div key={job.id} className="rounded-lg border p-3 text-xs">
                  <p className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {actionLabel(job.action)}
                      {job.service ? ` · ${job.service}` : ""}
                    </strong>
                    <span>{statusLabel(job.status)}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </p>
                  {typeof job.result === "string" && (
                    <p className="mt-1 break-words">{resultLabel(job.result)}</p>
                  )}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
