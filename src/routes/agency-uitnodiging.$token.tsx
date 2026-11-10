import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Building2, Check, Clock3, LogIn, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgencyInvitation, respondToAgencyInvitation } from "@/lib/agency.functions";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/agency-uitnodiging/$token")({ component: AgencyInvitationPage });

export function AgencyInvitationPage() {
  const { token } = useParams({ strict: false }) as { token: string };
  const { user } = useAuth();
  const { text } = useLocale();
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["agency-invitation", token], queryFn: () => getAgencyInvitation({ data: { token } }), retry: false });
  const invitation = query.data;
  async function respond(response: "accept" | "decline") {
    setBusy(true);
    try {
      const result = await respondToAgencyInvitation({ data: { token, response } });
      if (result.status === "accepted") { toast.success(text("Je bent aan het Agency-team toegevoegd.", "You joined the Agency team.")); window.location.assign("/dashboard"); return; }
      if (result.status === "declined") toast.success(text("Uitnodiging geweigerd.", "Invitation declined."));
      else toast.error(statusText(result.status, text));
      await query.refetch();
    } catch { toast.error(text("Je antwoord kon niet worden opgeslagen.", "Your response could not be saved.")); }
    finally { setBusy(false); }
  }
  if (query.isLoading) return <Shell><p>{text("Uitnodiging laden…", "Loading invitation…")}</p></Shell>;
  if (!invitation || invitation.status === "invalid") return <Shell><State title={text("Ongeldige uitnodiging", "Invalid invitation")} body={text("Deze Agency-uitnodiging bestaat niet of is ongeldig.", "This Agency invitation does not exist or is invalid.")}/></Shell>;
  if (invitation.status !== "pending") return <Shell><State title={text("Uitnodiging verwerkt", "Invitation handled")} body={statusText(invitation.status, text)}/></Shell>;
  return <Shell><Badge variant="secondary"><Building2 className="mr-1 size-3"/>Agency team</Badge><h1 className="mt-5 font-display text-3xl font-semibold">{invitation.workspaceName}</h1><p className="mt-3 text-sm text-muted-foreground">{text("Je bent uitgenodigd voor workspacebrede toegang als", "You have been invited for workspace-wide access as")} <strong className="text-foreground">{invitation.role === "finance" ? "Finance" : "Advisor"}</strong>.</p><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4"/>{text("Geldig tot", "Valid until")} {new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(invitation.expiresAt))}</p>{user ? <div className="mt-6 grid gap-2 sm:grid-cols-2"><Button disabled={busy} onClick={()=>void respond("accept")}><Check className="size-4"/>{text("Accepteren","Accept")}</Button><Button variant="outline" disabled={busy} onClick={()=>void respond("decline")}><X className="size-4"/>{text("Weigeren","Decline")}</Button></div> : <Button className="mt-6 w-full" asChild><Link to="/auth" search={{redirect:`/agency-invite/${token}`}}><LogIn className="size-4"/>{text("Inloggen of account maken","Sign in or create account")}</Link></Button>}</Shell>;
}
function Shell({children}:{children:ReactNode}){return <div className="mx-auto max-w-xl py-10"><Card className="surface"><CardHeader><CardTitle>GlobeTrotr</CardTitle></CardHeader><CardContent>{children}</CardContent></Card></div>}
function State({title,body}:{title:string;body:string}){return <div className="py-6 text-center"><h1 className="font-display text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{body}</p><Button className="mt-6" variant="outline" asChild><Link to="/">GlobeTrotr</Link></Button></div>}
function statusText(status:string,text:(nl:string,en:string)=>string){return ({accepted:text("Deze uitnodiging is al geaccepteerd.","This invitation has already been accepted."),declined:text("Deze uitnodiging is geweigerd.","This invitation was declined."),expired:text("Deze uitnodiging is verlopen.","This invitation has expired."),revoked:text("Deze uitnodiging is ingetrokken.","This invitation was revoked."),forbidden:text("Log in met het uitgenodigde e-mailadres.","Sign in with the invited email address."),unavailable:text("Deze Agency-workspace is niet beschikbaar.","This Agency workspace is unavailable.")} as Record<string,string>)[status] ?? text("De uitnodiging kon niet worden verwerkt.","The invitation could not be handled.")}
