import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Lock, Users } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { hasFeature } from "@/lib/plans";
import type { TripMemberRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale";
import { useQuery } from "@tanstack/react-query";
import { getMyAgencyAccess } from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & reisrechten — GlobeTrotr" },
      {
        name: "description",
        content: "Beheer reisrechten per klantreis en houd toegang beperkt tot de juiste reis.",
      },
    ],
  }),
  component: TeamPage,
});

const AGENCY_ROLES: { id: TripMemberRole; label: string; permissions: string[] }[] = [
  {
    id: "owner",
    label: "Workspace-eigenaar",
    permissions: ["Reizen beheren", "Uitgaven beheren", "Leden beheren", "Abonnement beheren"],
  },
  {
    id: "advisor",
    label: "Reisadviseur",
    permissions: ["Reizen beheren", "Uitgaven beheren"],
  },
  { id: "finance", label: "Financiën", permissions: ["Uitgaven beheren"] },
  { id: "client", label: "Klant / reiziger", permissions: ["Reis bekijken"] },
  { id: "viewer", label: "Kijker", permissions: ["Reis bekijken"] },
];

const ALL_PERMISSIONS = [
  "Reizen beheren",
  "Uitgaven beheren",
  "Leden beheren",
  "Abonnement beheren",
  "Reis bekijken",
];

function TeamPage() {
  const { text } = useLocale();
  const { state } = useWorkspace();
  const access=useQuery({queryKey:["my-agency-access"],queryFn:()=>getMyAgencyAccess(),enabled:state.plan==="agency",retry:false});
  const allowed = hasFeature(state.plan, "roles") && access.data?.permissions.members_manage===true;
  const trips = state.trips ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {text("Team & reisrechten", "Team & trip permissions")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {text(
            "Beheer toegang per reis. Een reisgenoot krijgt nooit automatisch toegang tot al je reizen.",
            "Manage access per trip. A traveller never automatically gains access to all your trips.",
          )}
        </p>
      </div>

      {!allowed && (
        <p className="flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          <Lock className="size-4" />{" "}
          {text(
            "Uitgebreid rollenbeheer zit in Agency (eigenaarsrol).",
            "Advanced role management is part of Agency (owner role).",
          )}{" "}
          <Link to="/billing" className="underline">
            {text("Upgraden", "Upgrade")}
          </Link>
        </p>
      )}

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{text("Reisteams", "Trip teams")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {text(
              "Reisgenoten voeg je toe in Reisinstellingen → Reisgenoten. GlobeTrotr verstuurt de uitnodiging per e-mail; de actuele bezorgstatus staat bij de openstaande uitnodiging.",
              "Add travellers under Trip settings → Travellers. GlobeTrotr sends the invitation by email; its current delivery status appears with the pending invitation.",
            )}
          </p>
          {trips.length ? (
            <ul className="space-y-3">
              {trips.map((trip) => {
                const members = trip.members ?? [];
                const memberCount = 1 + members.length;
                return (
                  <li key={trip.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-anywhere font-medium">{trip.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {memberCount}{" "}
                          {text(
                            memberCount === 1 ? "lid" : "leden",
                            memberCount === 1 ? "member" : "members",
                          )}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" disabled={!allowed}>
                        <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
                          <Users className="size-4" /> {text("Reisinstellingen", "Trip settings")}
                        </Link>
                      </Button>
                    </div>
                    {members.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {members.map((member) => (
                          <Badge key={member.id} variant="secondary">
                            {member.name} · {roleLabel(member.role, text)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {text(
                "Maak eerst een reis aan om een reisteam samen te stellen.",
                "Create a trip first to assemble a trip team.",
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{text("Rechtenmatrix", "Permissions matrix")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">{text("Recht", "Permission")}</th>
                {AGENCY_ROLES.map((role) => (
                  <th key={role.id} className="p-3">
                    {roleLabel(role.id, text)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((permission) => (
                <tr key={permission} className="border-t border-border">
                  <td className="p-3">{permissionLabel(permission, text)}</td>
                  {AGENCY_ROLES.map((role) => (
                    <td key={role.id} className="p-3 text-center">
                      {role.permissions.includes(permission) ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function roleLabel(role: TripMemberRole, text: (nl: string, en: string) => string) {
  const labels: Record<TripMemberRole, [string, string]> = {
    owner: ["Workspace-eigenaar", "Workspace owner"],
    advisor: ["Reisadviseur", "Travel advisor"],
    finance: ["Financiën", "Finance"],
    client: ["Klant / reiziger", "Client / traveller"],
    viewer: ["Kijker", "Viewer"],
    traveler: ["Reisgenoot", "Traveller"],
  };
  return text(...labels[role]);
}

function permissionLabel(permission: string, text: (nl: string, en: string) => string) {
  const labels: Record<string, string> = {
    "Reizen beheren": "Manage trips",
    "Uitgaven beheren": "Manage expenses",
    "Leden beheren": "Manage members",
    "Abonnement beheren": "Manage subscription",
    "Reis bekijken": "View trip",
  };
  return text(permission, labels[permission] ?? permission);
}
