import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getSelfHostedAdmin,
  saveSelfHostedLicense,
  updateSelfHostedLicenseStatus,
} from "@/lib/self-hosted.functions";
import { useLocale } from "@/lib/locale";
export const Route = createFileRoute("/_authenticated/corporate-admin/licenses")({
  component: Page,
});
const initial = {
  ownerEmail: "",
  legalName: "",
  supportEmail: "",
  licenseType: "annual" as const,
  expiresAt: "",
  maintenanceEndsAt: "",
  installationLimit: 1,
  testInstallationLimit: 1,
  reason: "",
};
function Page() {
  const { text } = useLocale(),
    query = useQuery({ queryKey: ["self-hosted-admin"], queryFn: () => getSelfHostedAdmin() }),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false),
    [change, setChange] = useState<{ id: string; status: string; reason: string } | null>(null);
  async function save() {
    setBusy(true);
    try {
      await saveSelfHostedLicense({
        data: {
          ...form,
          licenseType: form.licenseType,
          expiresAt:
            form.licenseType === "annual"
              ? new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString()
              : null,
          maintenanceEndsAt: form.maintenanceEndsAt
            ? new Date(`${form.maintenanceEndsAt}T23:59:59.999Z`).toISOString()
            : null,
        },
      });
      setOpen(false);
      setForm(initial);
      await query.refetch();
      toast.success(text("Licentie aangemaakt.", "Licence created."));
    } catch {
      toast.error(
        text(
          "Licentie kon niet worden aangemaakt. Controleer eigenaar, datums en rechten.",
          "The licence could not be created. Check owner, dates and permissions.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function status() {
    if (!change) return;
    setBusy(true);
    try {
      await updateSelfHostedLicenseStatus({
        data: { licenseId: change.id, status: change.status as any, reason: change.reason },
      });
      setChange(null);
      await query.refetch();
      toast.success(text("Licentiestatus bijgewerkt.", "Licence status updated."));
    } catch {
      toast.error(text("Status kon niet worden bijgewerkt.", "The status could not be updated."));
    } finally {
      setBusy(false);
    }
  }
  const customer = new Map((query.data?.customers ?? []).map((x: any) => [x.id, x]));
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <KeyRound className="size-6 text-primary" />
            {text("Self-Hosted-licenties", "Self-Hosted licences")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(
              "Deze beheerlaag is voorbereid maar de openbare verkoop blijft via de featureflag uitgeschakeld.",
              "This management layer is ready, while public sales remain disabled by feature flag.",
            )}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {text("Licentie toevoegen", "Add licence")}
        </Button>
      </header>
      {query.data && (
        <div
          className={`rounded-lg border p-3 text-sm ${query.data.signingConfigured ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}
        >
          {query.data.signingConfigured
            ? text("Licentieondertekening is geconfigureerd.", "Licence signing is configured.")
            : text(
                "Licentieondertekening ontbreekt. Activaties werken pas na het instellen van de privésleutel.",
                "Licence signing is missing. Activations require the private key to be configured.",
              )}
        </div>
      )}
      <div className="grid gap-3">
        {(query.data?.licenses ?? []).map((license: any) => {
          const owner: any = customer.get(license.customer_id),
            installs = (query.data?.installations ?? []).filter(
              (x: any) => x.license_id === license.id,
            );
          return (
            <Card key={license.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{owner?.legal_name || license.license_number}</CardTitle>
                  <Badge>{license.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {license.license_number} · {license.license_type} · {installs.length}/
                  {license.installation_limit + license.test_installation_limit}{" "}
                  {text("installaties", "installations")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{owner?.support_email}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setChange({
                        id: license.id,
                        status: license.status === "active" ? "suspended" : "active",
                        reason: "",
                      })
                    }
                  >
                    {license.status === "active"
                      ? text("Opschorten", "Suspend")
                      : text("Activeren", "Activate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setChange({ id: license.id, status: "revoked", reason: "" })}
                  >
                    {text("Intrekken", "Revoke")}
                  </Button>
                </div>
                {installs.map((i: any) => (
                  <div key={i.id} className="mt-3 rounded-lg border p-3 text-xs">
                    <strong>{i.domain}</strong> · {i.environment} · {i.version}
                    <span className="ml-2 text-muted-foreground">
                      {new Date(i.last_seen_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {text("Self-Hosted-licentie toevoegen", "Add Self-Hosted licence")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={text("E-mail accounteigenaar", "Account owner email")}
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            />
            <Input
              placeholder={text("Juridische organisatienaam", "Legal organisation name")}
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
            <Input
              placeholder={text("Supportadres", "Support email")}
              value={form.supportEmail}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
            />
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={form.licenseType}
              onChange={(e) => setForm({ ...form, licenseType: e.target.value as any })}
            >
              <option value="annual">Annual</option>
              <option value="perpetual">Perpetual 1.x</option>
            </select>
            {form.licenseType === "annual" && (
              <label className="text-sm">
                {text("Einddatum", "Expiry")}
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </label>
            )}
            <label className="text-sm">
              {text("Onderhoud tot", "Maintenance until")}
              <Input
                type="date"
                value={form.maintenanceEndsAt}
                onChange={(e) => setForm({ ...form, maintenanceEndsAt: e.target.value })}
              />
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.installationLimit}
              onChange={(e) => setForm({ ...form, installationLimit: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              max={10}
              value={form.testInstallationLimit}
              onChange={(e) => setForm({ ...form, testInstallationLimit: Number(e.target.value) })}
            />
            <Input
              className="sm:col-span-2"
              placeholder={text("Verplichte reden", "Required reason")}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <Button
              className="sm:col-span-2"
              disabled={
                busy ||
                form.reason.trim().length < 5 ||
                !form.legalName ||
                !form.ownerEmail ||
                !form.supportEmail ||
                (form.licenseType === "annual" && !form.expiresAt)
              }
              onClick={() => void save()}
            >
              <Save className="size-4" />
              {text("Licentie aanmaken", "Create licence")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(change)}
        onOpenChange={(o) => {
          if (!o) setChange(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text("Licentiestatus wijzigen", "Change licence status")}</DialogTitle>
          </DialogHeader>
          {change && (
            <>
              <p className="text-sm">{change.status}</p>
              <Input
                placeholder={text("Verplichte reden", "Required reason")}
                value={change.reason}
                onChange={(e) => setChange({ ...change, reason: e.target.value })}
              />
              <Button
                disabled={busy || change.reason.trim().length < 5}
                onClick={() => void status()}
              >
                {text("Wijziging bevestigen", "Confirm change")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
