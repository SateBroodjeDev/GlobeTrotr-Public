import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card,CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="space-y-1.5"><Label>{label}</Label>{children}</label>}
export function Metric({icon:Icon,label,value,detail}:{icon:LucideIcon;label:string;value:string|number|undefined;detail?:string}){return <Card><CardContent className="flex items-start gap-3 p-5"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5"/></span><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value??"—"}</p>{detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div></CardContent></Card>}
export function statusLabel(value:string,text:(nl:string,en:string)=>string){return({new:text("Nieuw","New"),reviewing:text("In beoordeling","Reviewing"),planned:text("Gepland","Planned"),resolved:text("Opgelost","Resolved"),closed:text("Gesloten","Closed"),investigating:text("In onderzoek","Investigating"),monitoring:text("Wordt gemonitord","Monitoring")}[value]??value)}
export function severityLabel(value:string,text:(nl:string,en:string)=>string){return({low:text("Laag","Low"),medium:text("Gemiddeld","Medium"),high:text("Hoog","High"),critical:text("Kritiek","Critical")}[value]??value)}
