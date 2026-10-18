import { CalendarClock, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale";

type ScheduledMaintenance = { scheduled?: boolean; startsAt: string|null; endsAt: string|null; reasonNl: string; reasonEn: string; updatedAt?: string|null };

export function ScheduledMaintenanceNotice({ state }: { state?: ScheduledMaintenance }) {
  const { locale, text } = useLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!state?.scheduled || !state.startsAt) return;
    const key = `maintenance-notice:${state.updatedAt ?? state.startsAt}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "shown");
    } catch { /* Show the announcement when session storage is unavailable. */ }
    setOpen(true);
  }, [state?.scheduled, state?.startsAt, state?.updatedAt]);
  if (!state?.scheduled || !state.startsAt) return null;
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-blue-500/30 bg-card/95 px-4 py-3 text-left shadow-xl backdrop-blur hover:bg-muted sm:max-w-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300"><CalendarClock className="size-5"/></span>
      <span className="min-w-0"><strong className="block text-sm">{text("Onderhoud gepland", "Maintenance scheduled")}</strong><span className="block truncate text-xs text-muted-foreground">{formatter.format(new Date(state.startsAt))}</span></span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{text("Gepland onderhoud", "Scheduled maintenance")}</DialogTitle><DialogDescription>{text("GlobeTrotr kan tijdens dit venster tijdelijk niet beschikbaar zijn.", "GlobeTrotr may be temporarily unavailable during this window.")}</DialogDescription></DialogHeader><div className="space-y-3 text-sm"><p className="leading-6">{locale==="en-GB"?state.reasonEn:state.reasonNl}</p><dl className="grid gap-2 rounded-xl border bg-muted/25 p-4"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">{text("Start", "Starts")}</dt><dd className="text-right font-medium">{formatter.format(new Date(state.startsAt))}</dd></div>{state.endsAt&&<div className="flex justify-between gap-4"><dt className="text-muted-foreground">{text("Verwacht einde", "Expected end")}</dt><dd className="text-right font-medium">{formatter.format(new Date(state.endsAt))}</dd></div>}</dl><Button asChild variant="outline" className="w-full"><Link to="/status" onClick={()=>setOpen(false)}>{text("Bekijk statuspagina", "View status page")}<ExternalLink className="size-4"/></Link></Button></div></DialogContent></Dialog>
  </>;
}
