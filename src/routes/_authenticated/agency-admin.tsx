import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bell, BookOpenCheck, BookTemplate, CreditCard, FileText, History, LayoutDashboard, ListTodo, Settings2, ShieldAlert, ShieldCheck, TrendingUp, Truck, Users } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { useLocale } from "@/lib/locale";
import { getMyAgencyAccess } from "@/lib/agency.functions";
import { getAgencyHostWorkspace } from "@/lib/agency-delivery.functions";
import type { AgencyPermission } from "@/lib/agency-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgencyOnboardingDialog } from "@/components/AgencyOnboardingDialog";

export const Route=createFileRoute("/_authenticated/agency-admin")({component:AgencyAdminLayout});
const items=[
 {to:"/agency-admin",nl:"Overzicht",en:"Overview",icon:LayoutDashboard,exact:true},
 {to:"/agency-admin/settings",nl:"Organisatie",en:"Organisation",icon:Settings2,permission:"branding_manage"},
 {to:"/agency-admin/permissions",nl:"Rollen en rechten",en:"Roles and permissions",icon:ShieldCheck,ownerOnly:true},
 {to:"/agency-admin/clients",nl:"Klanten",en:"Clients",icon:Users,permission:"members_manage"},
 {to:"/agency-admin/suppliers",nl:"Leveranciers",en:"Suppliers",icon:Truck,permission:"trips_view"},
 {to:"/agency-admin/operations",nl:"Operatie",en:"Operations",icon:BarChart3,permission:"analytics_view"},
 {to:"/agency-admin/reports",nl:"Rapportage",en:"Reporting",icon:TrendingUp,permission:"analytics_view"},
 {to:"/agency-admin/tasks",nl:"Taken",en:"Tasks",icon:ListTodo,permission:"trips_view"},
 {to:"/agency-admin/templates",nl:"Sjablonen",en:"Templates",icon:BookTemplate,permission:"trips_view"},
 {to:"/agency-admin/forms",nl:"Klantformulieren",en:"Client forms",icon:BookOpenCheck,permission:"members_manage"},
 {to:"/agency-admin/quotes",nl:"Offertes",en:"Quotes",icon:FileText,permission:"trips_view"},
 {to:"/agency-admin/invoices",nl:"Klantfacturen",en:"Customer invoices",icon:FileText,permission:"billing_manage"},
 {to:"/agency-admin/audit",nl:"Activiteit",en:"Activity",icon:History,ownerOnly:true},
 {to:"/agency-admin/security",nl:"Beveiliging",en:"Security",icon:ShieldAlert,ownerOnly:true},
 {to:"/agency-admin/notifications",nl:"Meldingen",en:"Notifications",icon:Bell},
 {to:"/agency-admin/subscription",nl:"Abonnement",en:"Plan",icon:CreditCard,permission:"billing_manage"},
] as const;
function AgencyAdminLayout(){
 const {state}=useWorkspace();const {text}=useLocale();const path=useRouterState({select:s=>s.location.pathname});
 const[hostname,setHostname]=useState("");
 useEffect(()=>setHostname(window.location.hostname.toLowerCase()),[]);
 const href=useRouterState({select:s=>s.location.href});
 const requestedWorkspace=new URL(href,"https://portal.globetrotr.nl").searchParams.get("workspace");
 const access=useQuery({queryKey:["my-agency-access"],queryFn:()=>getMyAgencyAccess(),retry:false});
 const hostBinding=useQuery({queryKey:["agency-host-workspace",hostname],queryFn:()=>getAgencyHostWorkspace({data:hostname}),enabled:Boolean(hostname),retry:false});
 if(access.isLoading||hostBinding.isLoading)return <p className="text-sm text-muted-foreground">{text("Agency-rechten laden…","Loading Agency permissions…")}</p>;
 if(!access.data)return <Card className="surface"><CardContent className="p-6"><h1 className="font-display text-xl font-semibold">{text("Geen Agency-toegang","No Agency access")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Je account heeft geen actieve rol binnen deze Agency-workspace.","Your account has no active role in this Agency workspace.")}</p></CardContent></Card>;
 if((requestedWorkspace&&requestedWorkspace!==access.data.workspaceId)||(hostBinding.data&&hostBinding.data.workspaceId!==access.data.workspaceId)||hostBinding.isError)return <Card className="surface"><CardContent className="p-6"><h1 className="font-display text-xl font-semibold">{text("Geen toegang tot dit Agency-domein","No access to this Agency domain")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Dit domein hoort bij een andere organisatie of is niet geverifieerd. Meld je aan met een account dat toegang heeft tot deze Agency.","This domain belongs to another organisation or has not been verified. Sign in with an account that has access to this Agency.")}</p></CardContent></Card>;
 const visibleItems=items.filter(item=>(!("ownerOnly" in item)||!item.ownerOnly||access.data.role==="owner")&&(!("permission" in item)||!item.permission||access.data.permissions[item.permission as AgencyPermission]));
 return <><AgencyOnboardingDialog enabled={access.data.role==="owner"}/><div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]"><aside className="h-fit lg:sticky lg:top-24"><div className="mb-3 hidden px-3 lg:block"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agency workspace</p><p className="mt-1 truncate font-display font-semibold">{access.data.brandName || state.branding.brandName}</p></div><nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible" aria-label="Agency Admin">{visibleItems.map(item=>{const active=("exact" in item&&item.exact)?path==="/agency-admin"||path==="/agency-admin/":path.startsWith(item.to);return <Button key={item.to} asChild variant={active?"secondary":"ghost"} className="shrink-0 justify-start"><Link to={item.to}><item.icon className="size-4"/>{text(item.nl,item.en)}</Link></Button>})}</nav></aside><main className="min-w-0"><Outlet/></main></div></>;
}
