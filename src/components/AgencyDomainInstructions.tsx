import type { AgencyDeliverySettings } from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { agencyDnsRecords, type AgencyDnsCheck } from "@/lib/agency-dns";

export function AgencyDomainTypeField({ value, onChange }: {
  value: "cname" | "alias"; onChange: (value: "cname" | "alias") => void;
}) {
  const { text } = useLocale();
  return <label className="block space-y-2 text-sm">
    <span>{text("Type eigen domein", "Custom domain type")}</span>
    <select className="h-10 w-full rounded-md border bg-background px-3" value={value}
      onChange={event => onChange(event.target.value === "alias" ? "alias" : "cname")}>
      <option value="cname">{text("Subdomein, bijvoorbeeld reizen.bedrijf.nl", "Subdomain, for example travel.company.com")}</option>
      <option value="alias">{text("Hoofddomein, bijvoorbeeld bedrijf.nl", "Root domain, for example company.com")}</option>
    </select>
    {value === "alias" && <span className="block text-xs text-muted-foreground">{text(
      "Je DNS-provider moet ALIAS, ANAME of CNAME-flattening ondersteunen. Cloudflare ondersteunt dit. Gebruik anders een subdomein. Laat je mailrecords staan.",
      "Your DNS provider must support ALIAS, ANAME or CNAME flattening. Cloudflare supports this. Otherwise use a subdomain. Keep your email records.",
    )}</span>}
  </label>;
}

export function AgencyDomainProgress({ state, error }: { state: string; error: string }) {
  const { text } = useLocale();
  const labels: Record<string, string> = {
    queued: text("DNS-records worden voorbereid…", "Preparing DNS records…"),
    dns_pending: text("Voeg de records toe en klik op verificatie.", "Add the records, then click verify."),
    certificate_pending: text("DNS-eigendom bevestigd. Certificaat wordt gecontroleerd…", "DNS ownership confirmed. Checking the certificate…"),
    route_pending: text("Certificaten en verbinding worden gecontroleerd…", "Checking certificates and routing…"),
    active: text("Domein actief. HTTPS en routering zijn gecontroleerd.", "Domain active. HTTPS and routing have been verified."),
    error: text("Nog niet actief. De controle wordt automatisch opnieuw geprobeerd.", "Not active yet. Verification will retry automatically."),
  };
  return <div className="rounded-lg border bg-muted/30 p-3 text-sm" role="status" aria-live="polite">
    <p>{labels[state] || labels.queued}</p>
    {error === "DOMAIN_HOSTNAME_LIMIT" && <p className="mt-1 text-xs">{text("De domeinlimiet van het platform is bereikt. Je GlobeTrotr-subdomein blijft beschikbaar.", "The platform domain limit has been reached. Your GlobeTrotr subdomain remains available.")}</p>}
    {error && error !== "DOMAIN_HOSTNAME_LIMIT" && <p className="mt-1 text-xs text-muted-foreground">{text("Controleer je DNS-records. Bij een blijvende fout kun je contact opnemen met support.", "Check your DNS records. Contact support if the error persists.")}</p>}
  </div>;
}

export function AgencyDomainInstructions({ settings, checks = [] }: {
  settings: Pick<AgencyDeliverySettings, "customDomain" | "domainCnameTarget" | "verificationToken" | "cloudflareEnabled">
    & Partial<Pick<AgencyDeliverySettings, "domainAutomationEnabled" | "dnsKind" | "providerDnsRecords">>;
  checks?: AgencyDnsCheck[];
}) {
  const { text } = useLocale();
  return <div className="space-y-2 break-words text-sm">
    {agencyDnsRecords(settings).map(record => <DnsRecord key={`${record.type}:${record.name}:${record.value}`} {...record}
      status={checks.find(check => check.type === record.type && check.name === record.name && check.value === record.value)?.status}/>)}
    {!settings.verificationToken && <p>{text("Je verificatierecord verschijnt na opslaan.", "Your verification record appears after saving.")}</p>}
    <p className="text-xs text-muted-foreground">{settings.dnsKind === "alias" ? text(
      "Stel het hoofddomein bij je provider in met ALIAS, ANAME of CNAME-flattening naar het getoonde doel. Een gewoon A-record naar een gedeeld IP is geen vervanging. Verwijder geen MX- of mailrecords.",
      "Configure the root domain using ALIAS, ANAME or CNAME flattening to the target shown. An ordinary A record pointing to a shared IP is not a replacement. Keep MX and email records.",
    ) : text(
      "Gebruik bij je DNS-provider DNS only voor het klantrecord, zodat de CNAME zichtbaar blijft. Verwijder geen MX- of mailrecords. DNS-wijzigingen kunnen tijd kosten.",
      "Use DNS only for the customer record at your DNS provider so the CNAME remains visible. Keep MX and email records. DNS changes can take time.",
    )}</p>
    {settings.domainAutomationEnabled ? <p className="text-xs text-muted-foreground">{text(
      "GlobeTrotr maakt de koppeling en validatierecords automatisch aan. Voeg alle getoonde records toe bij je DNS-provider, sla ze daar op en klik hier op verificatie. De koppeling activeert zodra DNS, certificaten en HTTPS-routering kloppen. Nieuwe validatierecords kunnen na enkele seconden verschijnen.",
      "GlobeTrotr automatically prepares the connection and validation records. Add all shown records at your DNS provider, save them there, then click verify here. Activation follows when DNS, certificates and HTTPS routing are correct. Additional validation records may appear after a few seconds.",
    )}</p> : settings.cloudflareEnabled && <p className="text-xs text-muted-foreground">{text(
      "GlobeTrotr-beheer registreert dit domein bij Cloudflare. Neem eventuele aanvullende verificatierecords van beheer over. Activeren kan pas als ook de domein- en certificaatstatus bij Cloudflare actief zijn.",
      "GlobeTrotr support registers this domain with Cloudflare. Add any additional verification records supplied by support. Activation also requires active hostname and certificate statuses at Cloudflare.",
    )}</p>}
  </div>;
}

function DnsRecord({ type, name, value, status }: { type: string; name: string; value: string; status?: AgencyDnsCheck["status"] }) {
  const { text } = useLocale();
  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(text("Gekopieerd.", "Copied."));
    } catch {
      toast.error(text("Kopieer de tekst handmatig.", "Copy the text manually."));
    }
  }
  return <div className="min-w-0 space-y-2 rounded-lg border p-3">
    <p className="break-all"><strong>{type === "ALIAS" ? "ALIAS / ANAME / CNAME (flattening)" : type}</strong> {name}</p>
    <p className={`flex items-start gap-2 text-xs ${status === "matched" ? "text-emerald-700 dark:text-emerald-400" : status === "missing" || status === "mismatch" ? "text-destructive" : "text-muted-foreground"}`}>
      {status === "matched" ? <CheckCircle2 className="size-4 shrink-0"/> : status === "missing" || status === "mismatch" ? <XCircle className="size-4 shrink-0"/> : <CircleHelp className="size-4 shrink-0"/>}
      {status === "matched" ? text("Correct gevonden", "Correct record found")
        : status === "missing" ? text("Nog niet gevonden. DNS-wijzigingen kunnen tijd kosten.", "Not found yet. DNS changes can take time.")
        : status === "mismatch" ? text("Andere waarde gevonden. Controleer het doel of de inhoud.", "Different value found. Check the target or content.")
        : status === "unavailable" ? text("DNS-controle tijdelijk niet beschikbaar. Probeer opnieuw.", "DNS lookup temporarily unavailable. Try again.")
        : status === "pending" ? text("Flattening verbergt het doel. De HTTPS-controle bevestigt de verbinding bij activatie.", "Flattening hides the target. The HTTPS check confirms routing during activation.")
        : text("Nog niet gecontroleerd", "Not checked yet")}
    </p>
    <code className="block break-all text-xs">{value}</code>
    <div className="flex flex-wrap gap-1">
      <Button type="button" size="sm" variant="ghost" aria-label={`${text("Recordnaam kopiëren", "Copy record name")}: ${name}`}
        onClick={() => void copy(name)}>{text("Naam kopiëren", "Copy name")}</Button>
      <Button type="button" size="sm" variant="ghost" aria-label={`${text("Recordwaarde kopiëren", "Copy record value")}: ${name}`}
        onClick={() => void copy(value)}>{text("Waarde kopiëren", "Copy value")}</Button>
    </div>
  </div>;
}

export function agencyVerificationMessage(result: {
  verified: boolean; cnameOk: boolean; txtOk: boolean; cloudflareState: string;
}, text: (nl: string, en: string) => string) {
  if (result.cloudflareState === "checking") return text(
    "Verificatie gestart. Je hoeft niet te blijven wachten: de koppeling wordt automatisch geactiveerd zodra alle controles slagen.",
    "Verification started. You do not need to keep waiting: the connection activates automatically when all checks pass.",
  );
  if (!result.cnameOk || !result.txtOk) return text(
    `DNS is nog niet compleet. CNAME: ${result.cnameOk ? "ok" : "ontbreekt"}, TXT: ${result.txtOk ? "ok" : "ontbreekt"}.`,
    `DNS is incomplete. CNAME: ${result.cnameOk ? "ok" : "missing"}, TXT: ${result.txtOk ? "ok" : "missing"}.`,
  );
  if (result.cloudflareState === "not_registered") return text(
    "Domeineigendom klopt. Vraag GlobeTrotr-beheer het domein bij Cloudflare te registreren.",
    "Domain ownership is confirmed. Ask GlobeTrotr support to register the hostname with Cloudflare.",
  );
  if (result.cloudflareState === "hostname_pending") return text(
    "DNS klopt. Cloudflare controleert de domeinkoppeling nog. Controleer eventuele aanvullende verificatierecords.",
    "DNS is correct. Cloudflare hostname validation is pending. Check any additional verification records.",
  );
  if (result.cloudflareState === "certificate_pending") return text(
    "Het domein is gekoppeld. Het Cloudflare-certificaat is nog niet gereed.",
    "The hostname is connected. Its Cloudflare certificate is not ready yet.",
  );
  return text(
    "Domeincontrole geslaagd. Open het domein om ook HTTPS en aanmelden te controleren.",
    "Domain verification passed. Open the domain to also check HTTPS and sign-in.",
  );
}
