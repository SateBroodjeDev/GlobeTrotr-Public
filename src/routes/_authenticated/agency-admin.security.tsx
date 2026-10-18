import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, History, ShieldCheck, Users } from "lucide-react";
import { getAgencyAudit, getAgencyTeam } from "@/lib/agency.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/agency-admin/security")({
  head: () => ({ meta: [{ title: "Agency-beveiliging — GlobeTrotr" }] }),
  component: AgencySecurityPage,
});

function AgencySecurityPage() {
  const { text } = useLocale();
  const team = useQuery({ queryKey: ["agency-team"], queryFn: () => getAgencyTeam(), retry: false });
  const audit = useQuery({ queryKey: ["agency-audit"], queryFn: () => getAgencyAudit(), retry: false });
  if (team.isLoading || audit.isLoading) return <p className="text-sm text-muted-foreground">{text("Beveiligingsstatus laden…", "Loading security status…")}</p>;
  if (!team.data || !audit.data) return <Card className="surface"><CardContent className="p-6 text-sm text-muted-foreground">{text("De beveiligingsstatus kon niet worden geladen.", "The security status could not be loaded.")}</CardContent></Card>;

  const active = team.data.members.filter((member) => member.status === "active").length;
  const suspended = team.data.members.filter((member) => member.status !== "active").length;
  const expired = team.data.invitations.filter((invitation) => invitation.status === "expired").length;
  const recent: any[] = audit.data.slice(0, 5);
  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-2 font-display text-3xl font-semibold"><ShieldCheck className="size-7 text-primary"/>{text("Beveiliging en toegang", "Security and access")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Controleer teamtoegang, openstaande uitnodigingen en recente beheeracties.", "Review team access, outstanding invitations and recent administrative actions.")}</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      <Status icon={Users} label={text("Actieve teamleden", "Active team members")} value={active} tone="ok"/>
      <Status icon={AlertTriangle} label={text("Geblokkeerde toegang", "Suspended access")} value={suspended} tone={suspended ? "warning" : "ok"}/>
      <Status icon={Clock3} label={text("Verlopen uitnodigingen", "Expired invitations")} value={expired} tone={expired ? "warning" : "ok"}/>
    </div>
    <Card className="surface"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="size-4"/>{text("Laatste toegangsacties", "Latest access actions")}</CardTitle></CardHeader><CardContent className="space-y-3">{recent.length ? recent.map((entry) => <div key={entry.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{entry.action}</p><p className="truncate text-xs text-muted-foreground">{entry.actorName || text("Systeem", "System")}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined,{dateStyle:"short",timeStyle:"short"}).format(new Date(entry.createdAt))}</time></div>) : <p className="text-sm text-muted-foreground">{text("Nog geen beheeracties vastgelegd.", "No administrative actions recorded yet.")}</p>}<Button asChild variant="outline"><Link to="/agency-admin/audit">{text("Volledige activiteit bekijken", "View all activity")}</Link></Button></CardContent></Card>
    <Card className="surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-medium">{text("Toegang aanpassen", "Adjust access")}</p><p className="text-sm text-muted-foreground">{text("Blokkeer leden, trek uitnodigingen in of pas persoonlijke rechten aan.", "Suspend members, revoke invitations or adjust personal permissions.")}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/agency-admin">{text("Team beheren", "Manage team")}</Link></Button><Button asChild><Link to="/agency-admin/permissions">{text("Rechten beheren", "Manage permissions")}</Link></Button></div></CardContent></Card>
  </div>;
}

function Status({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:number;tone:"ok"|"warning"}) {
  return <Card className="surface"><CardContent className="flex items-center gap-3 p-5"><span className={tone === "ok" ? "rounded-full bg-emerald-500/10 p-2 text-emerald-600" : "rounded-full bg-amber-500/10 p-2 text-amber-600"}>{tone === "ok" && value === 0 ? <CheckCircle2 className="size-5"/> : <Icon className="size-5"/>}</span><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
