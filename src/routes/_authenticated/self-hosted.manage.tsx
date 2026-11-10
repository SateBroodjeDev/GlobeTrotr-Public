import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Server } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createMyLicenseKey,
  getMySelfHostedLicenses,
  revokeMyInstallation,
  rotateMyLicenseKey,
} from "@/lib/self-hosted.functions";
import { useLocale } from "@/lib/locale";
export const Route = createFileRoute("/_authenticated/self-hosted/manage")({ component: Page });
function Page() {
  const { text } = useLocale(),
    query = useQuery({ queryKey: ["my-self-hosted"], queryFn: () => getMySelfHostedLicenses() }),
    [key, setKey] = useState("");
  async function generate(id: string) {
    try {
      const result = await createMyLicenseKey({ data: { licenseId: id } });
      setKey(result.key);
      await query.refetch();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("ALREADY")
          ? text(
              "Er bestaat al een sleutel. Laat een beheerder deze eerst roteren.",
              "A key already exists. Ask an administrator to rotate it first.",
            )
          : text("Sleutel kon niet worden gemaakt.", "The key could not be created."),
      );
    }
  }
  async function rotate(id: string) {
    if (
      !window.confirm(
        text(
          "De huidige sleutel stopt direct met werken. Doorgaan?",
          "The current key will stop working immediately. Continue?",
        ),
      )
    )
      return;
    try {
      const result = await rotateMyLicenseKey({ data: { licenseId: id } });
      setKey(result.key);
      await query.refetch();
      toast.success(text("Licentiesleutel geroteerd.", "Licence key rotated."));
    } catch {
      toast.error(text("Sleutel kon niet worden geroteerd.", "The key could not be rotated."));
    }
  }
  async function revoke(id: string) {
    if (
      !window.confirm(
        text(
          "Deze installatie verliest toegang. Doorgaan?",
          "This installation will lose access. Continue?",
        ),
      )
    )
      return;
    try {
      await revokeMyInstallation({ data: { installationId: id } });
      await query.refetch();
      toast.success(text("Installatie ingetrokken.", "Installation revoked."));
    } catch {
      toast.error(
        text("Installatie kon niet worden ingetrokken.", "The installation could not be revoked."),
      );
    }
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Server className="size-7 text-primary" />
          Self-Hosted Agency
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {text(
            "Beheer officiële GlobeTrotr-installaties van jouw organisatie.",
            "Manage your organisation's official GlobeTrotr installations.",
          )}
        </p>
      </header>
      {key && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{text("Bewaar deze sleutel nu", "Save this key now")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-all rounded bg-muted p-3 font-mono text-sm">{key}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {text(
                "Deze sleutel wordt niet opnieuw getoond.",
                "This key will not be shown again.",
              )}
            </p>
            <Button className="mt-3" onClick={() => void navigator.clipboard.writeText(key)}>
              <Copy className="size-4" />
              {text("Kopiëren", "Copy")}
            </Button>
          </CardContent>
        </Card>
      )}
      {!query.data?.licenses.length ? (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          {text(
            "Er is nog geen Self-Hosted-licentie aan je organisatie gekoppeld.",
            "No Self-Hosted licence is linked to your organisation yet.",
          )}
        </p>
      ) : (
        query.data.licenses.map((license: any) => (
          <Card key={license.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{license.license_number}</CardTitle>
                <Badge>{license.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {license.license_type} · GlobeTrotr {license.major_version}.x ·{" "}
                {license.installation_limit} production
              </p>
              {license.status === "active" && !license.activeKey && (
                <Button onClick={() => void generate(license.id)}>
                  <KeyRound className="size-4" />
                  {text("Eerste licentiesleutel maken", "Create first licence key")}
                </Button>
              )}
              {license.status === "active" && license.activeKey && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                  <span className="font-mono">{license.activeKey.key_prefix}••••••••</span>
                  <Button variant="outline" size="sm" onClick={() => void rotate(license.id)}>
                    <KeyRound className="size-4" />
                    {text("Sleutel roteren", "Rotate key")}
                  </Button>
                </div>
              )}
              <div className="grid gap-2">
                {(license.self_hosted_installations ?? []).map((item: any) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <strong>{item.domain}</strong>
                    <p className="text-xs text-muted-foreground">
                      {item.environment} · {item.version} ·{" "}
                      {item.revoked_at ? text("ingetrokken", "revoked") : text("actief", "active")}
                    </p>
                    {!item.revoked_at && (
                      <Button
                        className="mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() => void revoke(item.id)}
                      >
                        {text("Installatie intrekken", "Revoke installation")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
