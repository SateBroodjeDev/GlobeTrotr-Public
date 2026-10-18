import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getAgencyDeliverySettings,
  saveAgencyDeliverySettings,
  testAgencySmtp,
  verifyAgencyDomain,
  type AgencyDeliverySettings as Values,
} from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function AgencyDeliverySettings() {
  const { text } = useLocale(),
    q = useQuery({
      queryKey: ["agency-delivery"],
      queryFn: () => getAgencyDeliverySettings(),
      retry: false,
    }),
    [form, setForm] = useState<Values | null>(null),
    [busy, setBusy] = useState(false),
    [smtpPassword, setSmtpPassword] = useState(""),
    [testingSmtp, setTestingSmtp] = useState(false),
    [verifying, setVerifying] = useState(false),
    [dnsOpen, setDnsOpen] = useState(false);
  useEffect(() => {
    if (q.data) setForm(q.data);
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
      await q.refetch();
      setSmtpPassword("");
      toast.success(
        text("Domein- en afzenderinstellingen opgeslagen.", "Domain and sender settings saved."),
      );
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === "DOMAIN_ALREADY_USED"
          ? text("Dit domein is al gekoppeld.", "This domain is already linked.")
          : text("Instellingen konden niet worden opgeslagen.", "Settings could not be saved."),
      );
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
  async function verify() {
    if (!form) return;
    setVerifying(true);
    try {
      const result = await verifyAgencyDomain();
      await q.refetch();
      if (result.verified)
        toast.success(
          text(
            "Domein geverifieerd. HTTPS wordt automatisch geactiveerd.",
            "Domain verified. HTTPS will be enabled automatically.",
          ),
        );
      else
        toast.error(
          text(
            `DNS is nog niet compleet. DNS-doel: ${result.cnameOk ? "ok" : "mist"}, TXT: ${result.txtOk ? "ok" : "mist"}.`,
            `DNS is incomplete. DNS target: ${result.cnameOk ? "ok" : "missing"}, TXT: ${result.txtOk ? "ok" : "missing"}.`,
          ),
        );
    } catch {
      toast.error(
        text(
          "DNS-controle kon niet worden afgerond. Probeer het later opnieuw.",
          "DNS verification could not be completed. Try again later.",
        ),
      );
    } finally {
      setVerifying(false);
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2">
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
                      turnstileConfigured:
                        v.toLowerCase() === current.customDomain
                          ? current.turnstileConfigured
                          : false,
                    }
                  : current,
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            {text(
              "Je opgeslagen GlobeTrotr-subdomein werkt direct met je Agency-branding. Alleen voor een eigen extern domein controleer je eerst CNAME en TXT. Status:",
              "Your saved GlobeTrotr subdomain works immediately with your Agency branding. Only an external custom domain requires CNAME and TXT verification first. Status:",
            )}{" "}
            {form.subdomain && !form.customDomain ? text("actief", "active") : form.domainStatus}
          </p>
          {form.customDomain && (
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={form.turnstileConfigured}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, turnstileConfigured: event.target.checked }
                      : current,
                  )
                }
              />
              <span>
                <strong className="block">Cloudflare Turnstile</strong>
                <span className="text-xs text-muted-foreground">
                  {text(
                    "Ik heb het hoofddomein toegevoegd aan Turnstile Hostname Management. Zonder deze bevestiging blijft registratie op dit eigen domein veilig uitgeschakeld.",
                    "I added the root domain to Turnstile Hostname Management. Without this confirmation, registration on this custom domain remains safely disabled.",
                  )}
                </span>
              </span>
            </label>
          )}
          <Field label="SMTP host" value={form.smtpHost} onChange={(v) => set("smtpHost", v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={text("SMTP-poort", "SMTP port")}
              type="number"
              value={String(form.smtpPort)}
              onChange={(v) =>
                setForm((current) => (current ? { ...current, smtpPort: Number(v) } : current))
              }
            />
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, smtpSecure: event.target.checked } : current,
                  )
                }
              />
              {text("Direct TLS (meestal poort 465)", "Direct TLS (usually port 465)")}
            </label>
          </div>
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
          <div className="flex flex-wrap items-center gap-3">
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
              {text("Status", "Status")}: {form.smtpTestStatus}
            </span>
          </div>
          {form.customDomain && form.verificationToken && (
            <>
              <Button type="button" variant="secondary" onClick={() => setDnsOpen(true)}>
                {text("DNS-instellingen bekijken", "View DNS settings")}
              </Button>
              <Dialog open={dnsOpen} onOpenChange={setDnsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {text("DNS voor je Agency-domein", "DNS for your Agency domain")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                    <p>
                      CNAME{" "}
                      <strong>{form.customDomain || text("jouw domein", "your domain")}</strong> →{" "}
                      <strong>portal.globetrotr.nl</strong>
                    </p>
                    <p>
                      TXT <strong>_globetrotr.{form.customDomain}</strong>
                    </p>
                    <code className="block break-all">
                      globetrotr-verification={form.verificationToken}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      {text(
                        "Laat een eventuele proxy uit tijdens de eerste controle. DNS-wijzigingen kunnen enige tijd nodig hebben.",
                        "Disable any proxy during the first check. DNS changes may take some time.",
                      )}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={verifying || !form.customDomain}
            onClick={() => void verify()}
          >
            {verifying
              ? text("DNS controleren...", "Checking DNS...")
              : text("DNS controleren en activeren", "Verify DNS and activate")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2">
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
              "Zonder geteste eigen SMTP verzendt deze Agency via de centrale ZXCS-relay. Na een geslaagde SMTP-test gebruikt Agency-communicatie de eigen server. SMTP-geheimen worden nooit in dit scherm getoond.",
              "Without verified custom SMTP, this Agency sends through the central ZXCS relay. After a successful SMTP test, Agency communications use the custom server. SMTP secrets are never shown on this screen.",
            )}
          </p>
        </CardContent>
      </Card>
      <Button
        className="lg:col-span-2 lg:justify-self-start"
        disabled={busy}
        onClick={() => void save()}
      >
        <Save className="size-4" />
        {busy
          ? text("Opslaan…", "Saving…")
          : text("Domeininstellingen opslaan", "Save domain settings")}
      </Button>
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
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <div className="flex">
        <Input
          className={suffix ? "rounded-r-none" : ""}
          type={type}
          value={value}
          maxLength={254}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
