import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkAgencyDomainDns, verifyAgencyDomain, type AgencyDeliverySettings } from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AgencyDomainInstructions, AgencyDomainProgress } from "./AgencyDomainInstructions";
import { AgencyLoginStatus } from "./AgencyLoginStatus";

export function AgencyDnsSettings({ settings, disabled = false }: { settings: AgencyDeliverySettings; disabled?: boolean }) {
  // Reset acknowledgement and results whenever the saved domain or generation changes.
  return <AgencyDnsDialog key={`${settings.workspaceId}:${settings.customDomain}:${settings.verificationToken}:${settings.dnsKind}`}
    settings={settings} disabled={disabled}/>;
}

function AgencyDnsDialog({ settings, disabled }: { settings: AgencyDeliverySettings; disabled: boolean }) {
  const { text, locale } = useLocale();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [activating, setActivating] = useState(false);
  const recordGeneration = JSON.stringify(settings.providerDnsRecords);
  useEffect(() => { setAdded(false); }, [recordGeneration]);
  const checks = useQuery({
    queryKey: ["agency-dns-check", settings.workspaceId, settings.customDomain, settings.verificationToken,
      settings.dnsKind, settings.domainCnameTarget, settings.providerDnsRecords],
    queryFn: () => checkAgencyDomainDns(), enabled: open && !disabled,
    retry: false, staleTime: 0, refetchOnWindowFocus: false,
  });
  const result = checks.data;
  const current = result?.hostname === settings.customDomain && result.verificationToken === settings.verificationToken
    && result.dnsKind === settings.dnsKind;
  async function activate() {
    if (!added || activating) return;
    setActivating(true);
    try {
      await verifyAgencyDomain();
      await Promise.all([checks.refetch(), client.invalidateQueries({ queryKey: ["agency-delivery"] })]);
      toast.info(text("Controle gestart. Je ziet hieronder welke records gevonden zijn. Activatie volgt automatisch zodra alle controles slagen.",
        "Verification started. The results below show which records were found. Activation follows automatically when all checks pass."));
    } catch {
      toast.error(text("Verificatie kon niet worden gestart. Probeer opnieuw.", "Verification could not be started. Try again."));
    } finally { setActivating(false); }
  }
  return <Dialog open={open && !disabled} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="secondary" disabled={disabled || !settings.customDomain || !settings.verificationToken}>
      {text("DNS-instellingen", "DNS Settings")}
    </Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{text("DNS-instellingen", "DNS Settings")}</DialogTitle>
        <DialogDescription>{text("Voeg deze records toe bij je DNS-provider. Kopieer de naam en waarde precies zoals hieronder.",
          "Add these records at your DNS provider. Copy the name and value exactly as shown below.")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span>{checks.isFetching ? text("DNS-records controleren…", "Checking DNS records…") : current && !checks.isError
          ? text("Laatste controle", "Last checked") + `: ${new Date(result.checkedAt).toLocaleTimeString(locale)}`
          : text("Nog geen actuele DNS-controle", "No current DNS check")}</span>
        <Button type="button" size="sm" variant="ghost" disabled={checks.isFetching || activating} onClick={() => void checks.refetch()}>
          <RefreshCw className={`mr-2 size-4 ${checks.isFetching ? "motion-safe:animate-spin" : ""}`}/>{text("Opnieuw controleren", "Check again")}
        </Button>
      </div>
      {checks.isError && <p role="alert" className="text-sm text-destructive">{text("DNS-controle niet beschikbaar. Probeer opnieuw; dit betekent niet dat je records fout zijn.",
        "DNS check unavailable. Try again; this does not mean your records are incorrect.")}</p>}
      <AgencyDomainInstructions settings={settings} checks={current && !checks.isError ? result.records : []}/>
      <div className="space-y-3 border-t pt-4">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={added} onChange={event => setAdded(event.target.checked)}/>
          {text("Ik heb alle getoonde DNS-records toegevoegd en opgeslagen bij mijn provider.", "I have added and saved all shown DNS records at my provider.")}</label>
        <Button type="button" className="w-full" disabled={!added || activating || checks.isFetching} onClick={() => void activate()}>
          {activating && <Loader2 className="mr-2 size-4 motion-safe:animate-spin"/>}
          {activating ? text("Controleren…", "Checking…") : text("DNS controleren en activeren", "Check DNS and activate")}
        </Button>
        {settings.domainAutomationEnabled && <AgencyDomainProgress state={settings.provisioningState} error={settings.provisioningError}/>}
        {!settings.domainAutomationEnabled && <p className="text-sm" role="status">{settings.domainStatus === "verified"
          ? text("Domeinverificatie geslaagd.", "Domain verification passed.") : text("Domein nog niet geverifieerd.", "Domain not yet verified.")}</p>}
        <AgencyLoginStatus workspaceId={settings.workspaceId} enabled={open && !disabled}
          generation={`${settings.subdomain}:${settings.customDomain}:${settings.verificationToken}`}/>
        <p className="text-xs text-muted-foreground">{text("Groene vinkjes bevestigen de DNS-records. Het domein is pas actief wanneer ook het certificaat en de verbinding zijn goedgekeurd. Je kunt dit venster sluiten.",
          "Green checks confirm DNS records. The domain becomes active after its certificate and connection are approved too. You can close this window.")}</p>
      </div>
    </DialogContent>
  </Dialog>;
}
