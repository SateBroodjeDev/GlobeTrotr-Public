import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/locale";
import { issueCategoryLabel } from "@/lib/issue-categories";

export const Route = createFileRoute("/bekende-problemen")({
  head: () => ({ meta: [
    { title: "Bekende problemen — GlobeTrotr" },
    { name: "description", content: "Bekijk bekende problemen, geplande oplossingen en de actuele productstatus van GlobeTrotr." },
  ] }),
  component: KnownIssuesPage,
});
export function KnownIssuesPage() {
  const { text, language } = useLocale();
  const statusLabel=(value:string)=>({investigating:text("In onderzoek","Investigating"),planned:text("Gepland","Planned"),monitoring:text("Wordt gemonitord","Monitoring"),resolved:text("Opgelost","Resolved")}[value]??value);
  const query = useQuery({ queryKey:["known-issues"], refetchInterval:60_000, queryFn: async()=>{ const {data,error}=await (supabase as any).from("known_issues").select("*").eq("public",true).is("archived_at",null).order("created_at",{ascending:false}); if(error) throw error; return data as any[]; }});
  return <div className="mx-auto max-w-4xl space-y-6"><header className="aurora rounded-3xl p-8"><Badge variant="secondary">{text("Productstatus","Product status")}</Badge><h1 className="mt-4 font-display text-3xl font-semibold">{text("Bekende problemen","Known issues")}</h1><p className="mt-2 text-sm opacity-85">{text("Problemen die we onderzoeken, gepland hebben of na een oplossing blijven volgen.","Issues we are investigating, have scheduled or continue monitoring after a fix.")}</p></header>
    {query.isLoading ? <p>{text("Laden…","Loading…")}</p> : query.isError ? <p>{text("De lijst kon niet worden geladen.","The list could not be loaded.")}</p> : !query.data?.length ? <Card><CardContent className="flex gap-3 p-6"><CheckCircle2 className="text-primary"/>{text("Er zijn momenteel geen openbare bekende problemen.","There are currently no public known issues.")}</CardContent></Card> : <div className="space-y-3">{query.data.map(issue=><Card key={issue.id}><CardContent className="p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500"/><div><div className="flex flex-wrap gap-2"><h2 className="font-semibold">{language==="nl"?issue.title_nl:issue.title_en}</h2><Badge>{issueCategoryLabel(issue.category,text)}</Badge><Badge variant="outline">{statusLabel(issue.status)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{language==="nl"?issue.description_nl:issue.description_en}</p></div></div></CardContent></Card>)}</div>}
  </div>;
}
