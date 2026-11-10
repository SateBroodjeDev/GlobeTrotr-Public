import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Globe, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getAgencyDeliverySettings,
  saveAgencyDeliverySettings,
  testAgencySmtp,
  type AgencyDeliverySettings as Values,
} from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AgencyDomainTypeField,
  AgencyDomainProgress,
} from "@/components/AgencyDomainInstructions";
import { AgencyDnsSettings } from "@/components/AgencyDnsSettings";
import { AgencyLoginStatus } from "@/components/AgencyLoginStatus";
import { agencyDeliveryErrorMessage } from "@/lib/agency-delivery-mail";

export function AgencyDeliverySettings() {
  const { text } = useLocale(),
    q = useQuery({
      queryKey: ["agency-delivery"],
      queryFn: () => getAgencyDeliverySettings(),
      retry: false,
      refetchInterval: (query) =>
        query.state.data?.domainAutomationEnabled &&
        query.state.data.customDomain &&
        query.state.data.provisioningState !== "active"
          ? 5000
          : false,
    }),
    [form, setForm] = useState<Values | null>(null),
    [busy, setBusy] = useState(false),
    [smtpPassword, setSmtpPassword] = useState(""),
    [testingSmtp, setTestingSmtp] = useState(false);
  useEffect(() => {
    if (q.data) {
      const latest = q.data;
      setForm((current) =>
        !current
          ? latest
          : current.customDomain === latest.customDomain
            ? {
                ...current,
                domainStatus: latest.domainStatus,
                provisioningState: latest.provisioningState,
                provisioningError: latest.provisioningError,
                providerDnsRecords: latest.providerDnsRecords,
                verificationToken: latest.verificationToken,
              }
            : current,
      );
    }
  }, [q.data]);
  if (!form) return null;
  const set = (key: keyof Values, value: string) =>
    setForm((v) => (v ? { ...v, [key]: value } : v));
  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await saveAgencyDeliverySettings({
        data: {
          subdomain: form.subdomain,
          customDomain: form.customDomain,
          dnsKind: form.dnsKind,
          fromName: form.fromName,
          fromEmail: form.fromEmail,
          replyTo: form.replyTo,
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpSecure: form.smtpSecure,
          smtpUsername: form.smtpUsername,
          smtpPassword,
          turnstileConfigured: form.turnstileConfigured,
        },
      });
      const refreshed = await q.refetch();
      if (refreshed.data) setForm(refreshed.data);
      setSmtpPassword("");
      toast.success(
        text("Domein- en afzenderinstellingen opgeslagen.", "Domain and sender settings saved."),
      );
    } catch (e) {
      toast.error(agencyDeliveryErrorMessage(e, text));
    } finally {
      setBusy(false);
    }
  }
  async function testSmtp() {
    setTestingSmtp(true);
    try {
      await testAgencySmtp();
      await q.refetch();
      toast.success(text("SMTP-verbinding werkt.", "SMTP connection works."));
    } catch {
      await q.refetch();
      toast.error(
        text(
          "SMTP-verbinding is mislukt. Controleer host, poort, TLS en inloggegevens.",
          "SMTP connection failed. Check host, port, TLS and credentials.",
        ),
      );
    } finally {
      setTestingSmtp(false);
    }
  }
  return (
    <div className="@container">
      <div className="grid items-start gap-5 @4xl:grid-cols-2">
        <Card className="@container min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-5" />
              {text("Agency-domein", "Agency domain")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={text("Subdomein", "Subdomain")}
              value={form.subdomain}
              suffix=".globetrotr.nl"
              onChange={(v) => set("subdomain", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            <Field
              label={text("Eigen domein (optioneel)", "Custom domain (optional)")}
              value={form.customDomain}
              onChange={(v) =>
                setForm((current) =>
                  current
                    ? {
                        ...current,
                        customDomain: v.toLowerCase(),
                        domainStatus: "pending",
                        providerDnsRecords: [],
                        verificationToken: "",
                        turnstileConfigured:
                          v.toLowerCase() === current.customDomain
                            ? current.turnstileConfigured
                            : false,
                      }
                    : current,
                )
              }
            />
            {form.domainAutomationEnabled && (
              <AgencyDomainTypeField
                value={form.dnsKind}
                onChange={(dnsKind) =>
                  setForm((current) => (current ? { ...current, dnsKind } : current))
                }
              />
            )}
            {form.domainAutomationEnabled &&
              form.customDomain === q.data?.customDomain &&
              form.customDomain && (
                <AgencyDomainProgress
                  state={form.provisioningState}
                  error={form.provisioningError}
                />
              )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {text(
                "Je GlobeTrotr-subdomein werkt na opslaan. Een eigen domein activeer je na DNS-verificatie. Status:",
                "Your GlobeTrotr subdomain works after saving. Activate a custom domain after DNS verification. Status:",
              )}{" "}
              {form.subdomain && !form.customDomain
                ? text("actief", "active")
                : {
                    unconfigured: text("niet ingesteld", "not configured"),
                    pending: text("wacht op controle", "pending verification"),
                    verified: text("geverifieerd", "verified"),
                    failed: text("controle nodig", "needs attention"),
                  }[form.domainStatus]}
            </p>
            {form.customDomain && !form.domainAutomationEnabled && (
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={form.turnstileConfigured}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, turnstileConfigured: event.target.checked } : current,
                    )
                  }
                />
                <span>
                  <strong className="block">Cloudflare Turnstile</strong>
                  <span className="text-xs text-muted-foreground">
                    {text(
                      "GlobeTrotr-beheer heeft bevestigd dat dit domein aan de Turnstile-widget is toegevoegd. Zonder bevestiging blijft registratie op dit domein uitgeschakeld.",
                      "GlobeTrotr support confirmed that this hostname has been added to the Turnstile widget. Registration on this domain remains disabled without confirmation.",
                    )}
                  </span>
                </span>
              </label>
            )}
            {form.customDomain && form.domainAutomationEnabled && (
              <p className="text-xs text-muted-foreground">
                {text(
                  "Nieuwe accounts registreren veilig via het centrale GlobeTrotr-portaal. Bestaande accounts kunnen op je domein inloggen. Hiervoor hoef je geen Turnstile-hostnamen te laten toevoegen.",
                  "New accounts register securely through the central GlobeTrotr portal. Existing accounts can sign in on your domain. No manual Turnstile hostname setup is required.",
                )}
              </p>
            )}
            <div className="border-t pt-4">
              <AgencyDnsSettings settings={form} disabled={form.customDomain !== q.data?.customDomain || form.subdomain !== q.data?.subdomain || form.dnsKind !== q.data?.dnsKind}/>
            </div>
            <AgencyLoginStatus workspaceId={form.workspaceId}
              generation={`${form.subdomain}:${form.customDomain}:${form.verificationToken}`}
              enabled={form.customDomain === q.data?.customDomain && form.subdomain === q.data?.subdomain}/>
            {(form.customDomain !== q.data?.customDomain ||
              form.subdomain !== q.data?.subdomain ||
              form.dnsKind !== q.data?.dnsKind) && (
              <p className="text-xs text-muted-foreground">
                {text(
                  "Sla je domeinwijzigingen op voordat je controleert.",
                  "Save domain changes before verifying.",
                )}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="@container min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-5" />
              {text("E-mailafzender", "Email sender")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={text("Afzendernaam", "Sender name")}
              value={form.fromName}
              onChange={(v) => set("fromName", v)}
            />
            <Field
              label={text("Afzenderadres", "From address")}
              type="email"
              value={form.fromEmail}
              onChange={(v) => set("fromEmail", v)}
            />
            <Field
              label="Reply-to"
              type="email"
              value={form.replyTo}
              onChange={(v) => set("replyTo", v)}
            />
            <p className="text-xs text-muted-foreground">
              {text(
                "Standaard verstuurt GlobeTrotr je e-mails. Een eigen mailserver stel je hieronder optioneel in.",
                "GlobeTrotr sends your emails by default. You can optionally configure your own mail server below.",
              )}
            </p>
            <details
              className="group rounded-xl border border-border/70"
              open={form.smtpConfigured || undefined}
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                {text("Eigen SMTP-server (optioneel)", "Custom SMTP server (optional)")}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="space-y-4 border-t p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {text(
                    "Vul dit alleen in als je via je eigen mailserver wilt verzenden. Sla eerst op en test daarna de verbinding.",
                    "Only fill this in to send through your own mail server. Save first, then test the connection.",
                  )}
                </p>
                <Field
                  label="SMTP host"
                  value={form.smtpHost}
                  onChange={(v) => set("smtpHost", v)}
                />
                <div className="grid items-end gap-3 @sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <Field
                    label={text("SMTP-poort", "SMTP port")}
                    type="number"
                    value={String(form.smtpPort)}
                    onChange={(v) =>
                      setForm((current) =>
                        current ? { ...current, smtpPort: Number(v || 587) } : current,
                      )
                    }
                  />
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.smtpSecure}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, smtpSecure: event.target.checked } : current,
                        )
                      }
                    />
                    <span>
                      <span className="block">Direct TLS</span>
                      <span className="block text-xs text-muted-foreground">
                        {text("Meestal poort 465", "Usually port 465")}
                      </span>
                    </span>
                  </label>
                </div>
                <div className="grid gap-4 @sm:grid-cols-2">
                  <Field
                    label={text("SMTP-gebruikersnaam", "SMTP username")}
                    value={form.smtpUsername}
                    onChange={(v) => set("smtpUsername", v)}
                  />
                  <Field
                    label={text("SMTP-wachtwoord", "SMTP password")}
                    type="password"
                    value={smtpPassword}
                    placeholder={form.smtpPasswordSet ? "••••••••••••" : ""}
                    onChange={setSmtpPassword}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testingSmtp || !form.smtpConfigured}
                    onClick={() => void testSmtp()}
                  >
                    {testingSmtp
                      ? text("Testen…", "Testing…")
                      : text("SMTP-verbinding testen", "Test SMTP connection")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {text("Status", "Status")}:{" "}
                    {{
                      ok: text("Geslaagd", "Passed"),
                      failed: text("Mislukt", "Failed"),
                      untested: text("Nog niet getest", "Not tested yet"),
                    }[form.smtpTestStatus] ?? text("Nog niet getest", "Not tested yet")}
                  </span>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
        <div className="flex justify-end border-t pt-4 @4xl:col-span-2">
          <Button className="w-full @sm:w-auto" disabled={busy} onClick={() => void save()}>
            <Save className="size-4" />
            {busy ? text("Opslaan…", "Saving…") : text("Wijzigingen opslaan", "Save changes")}
          </Button>
        </div>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 space-y-1.5 text-sm">
      <span>{label}</span>
      <div className="flex">
        <Input
          className={suffix ? "min-w-0 flex-1 rounded-r-none" : "min-w-0"}
          type={type}
          value={value}
          maxLength={254}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="flex shrink-0 items-center rounded-r-md border border-l-0 bg-muted px-3 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
