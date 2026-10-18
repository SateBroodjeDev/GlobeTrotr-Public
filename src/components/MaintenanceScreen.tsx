import { Link } from "@tanstack/react-router";
import { Activity, CheckCircle2, Clock3, Languages, LogIn, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

type MaintenanceState = { reasonNl:string; reasonEn:string; endsAt:string|null; progressPercent:number; statusNl:string; statusEn:string };

export function MaintenanceScreen({state}:{state:MaintenanceState}) {
  const {text,locale,setLocale}=useLocale();
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1_000);return()=>clearInterval(id)},[]);
  const remaining=state.endsAt?Math.max(0,Date.parse(state.endsAt)-now):null;
  const countdown=remaining===null?text("Eindtijd volgt","End time to be confirmed"):format(remaining,locale==="en-GB");
  const progress=Math.max(0,Math.min(100,state.progressPercent));
  return <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-12">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,hsl(var(--primary)/.16),transparent_32%),radial-gradient(circle_at_85%_80%,hsl(var(--accent)/.28),transparent_38%)]"/>
    <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-xl border bg-card/95 p-1 shadow-sm backdrop-blur" aria-label={text("Taal kiezen","Choose language")}>
      <Languages className="mx-2 size-4 text-muted-foreground"/><Button size="sm" variant={locale==="nl-NL"?"secondary":"ghost"} aria-pressed={locale==="nl-NL"} onClick={()=>void setLocale("nl-NL")}>NL</Button><Button size="sm" variant={locale==="en-GB"?"secondary":"ghost"} aria-pressed={locale==="en-GB"} onClick={()=>void setLocale("en-GB")}>EN</Button>
    </div>
    <main className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border bg-card/95 shadow-2xl backdrop-blur"><div className="grid lg:grid-cols-[1.15fr_.85fr]">
      <section className="p-7 sm:p-10 lg:p-12"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Wrench className="size-6"/></span><p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-primary">GlobeTrotr · {text("gepland onderhoud","scheduled maintenance")}</p><h1 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">{text("Even in de werkplaats","Temporarily in the workshop")}</h1><p className="mt-5 max-w-xl text-lg leading-8">{locale==="en-GB"?state.reasonEn:state.reasonNl}</p>
        <div className="mt-7 rounded-2xl border bg-background/70 p-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-primary"/>{locale==="en-GB"?state.statusEn:state.statusNl}</span><strong className="tabular-nums">{progress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{width:`${progress}%`}}/></div></div>
        <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">{text("Je reisgegevens blijven veilig bewaard. Zodra het onderhoud klaar is, opent deze pagina automatisch weer.","Your trip data remains safely stored. Once maintenance is complete, this page will reopen automatically.")}</p><div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600"/>{text("Gegevens blijven veilig","Data remains safe")}</span><span className="flex items-center gap-2"><Activity className="size-4 text-primary"/>{text("Controle iedere 10 seconden","Checked every 10 seconds")}</span></div>
      </section>
      <aside className="border-t bg-muted/30 p-7 sm:p-10 lg:border-l lg:border-t-0"><p className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4 text-primary"/>{text("Verwachte resterende tijd","Estimated time remaining")}</p><p className="mt-3 font-display text-3xl font-semibold tabular-nums">{countdown}</p><div className="my-7 h-px bg-border"/><p className="text-sm leading-6 text-muted-foreground">{text("Werk je aan GlobeTrotr? Bevoegde beheerders kunnen tijdens het onderhoud blijven inloggen.","Working on GlobeTrotr? Authorised administrators can continue to sign in during maintenance.")}</p><Button asChild variant="outline" className="mt-5 w-full"><a href="/auth?redirect=%2Fcorporate-admin"><LogIn className="size-4"/>{text("Beheerder inloggen","Administrator sign in")}</a></Button><p className="mt-6 text-xs text-muted-foreground">{text("Vragen? Mail info@globetrotr.nl","Questions? Email info@globetrotr.nl")}</p></aside>
    </div></main>
  </div>;
}

function format(ms:number,english:boolean){const total=Math.ceil(ms/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;const hour=english?"h":"u";return days?`${days}d ${hours}${hour} ${minutes}m`:hours?`${hours}${hour} ${minutes}m ${seconds}s`:`${minutes}m ${seconds}s`;}
