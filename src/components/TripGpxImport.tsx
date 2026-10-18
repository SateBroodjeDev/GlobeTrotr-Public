import { useRef, useState } from "react";
import { FileUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isDuplicateGpxPoint, parseGpx, type GpxImportPoint } from "@/lib/gpx-import";
import type { Stop } from "@/lib/types";

type Text = (nl: string, en: string) => string;

export function TripGpxImport({ stops, onImport, text }: { stops: Stop[]; onImport: (points: GpxImportPoint[]) => Promise<void>; text: Text }) {
  const [inputKey, setInputKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<GpxImportPoint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selectable = () => points.map((point, index) => isDuplicateGpxPoint(point, stops) ? -1 : index).filter((index) => index >= 0);

  async function load(file?: File) {
    if (!file) return;
    if (!/\.(gpx|xml)$/i.test(file.name)) {
      toast.error(text("Kies een GPX-bestand.", "Choose a GPX file."));
      return;
    }
    try {
      const parsed = parseGpx(await file.text());
      setPoints(parsed);
      setSelected(new Set(parsed.map((point, index) => isDuplicateGpxPoint(point, stops) ? -1 : index).filter((index) => index >= 0)));
    } catch (error) {
      const code = error instanceof Error ? error.message : "GPX_INVALID";
      const messages: Record<string, [string, string]> = {
        GPX_TOO_LARGE: ["Het bestand is groter dan 2 MB.", "The file is larger than 2 MB."],
        GPX_TOO_MANY_POINTS: ["Het bestand bevat meer dan 500 routepunten.", "The file contains more than 500 route points."],
        GPX_UNSAFE_XML: ["Dit GPX-bestand bevat niet-toegestane XML.", "This GPX file contains unsupported XML."],
        GPX_NO_VALID_POINTS: ["Geen geldige routepunten gevonden.", "No valid route points found."],
      };
      const copy = messages[code] ?? ["Het GPX-bestand kon niet worden gelezen.", "The GPX file could not be read."];
      toast.error(text(copy[0], copy[1])); setPoints([]); setSelected(new Set());
    }
  }

  async function apply() {
    const chosen = points.filter((_, index) => selected.has(index));
    if (!chosen.length) return;
    setBusy(true);
    try {
      await onImport(chosen);
      toast.success(text(`${chosen.length} routepunten toegevoegd.`, `${chosen.length} route points added.`));
      setOpen(false); setPoints([]); setSelected(new Set()); setInputKey((value) => value + 1);
    } catch { toast.error(text("De routepunten konden niet worden toegevoegd.", "The route points could not be added.")); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="outline"><FileUp className="size-4" />{text("GPX importeren", "Import GPX")}</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{text("Route uit GPX importeren", "Import route from GPX")}</DialogTitle><DialogDescription>{text("Controleer de route en kies welke punten je als bestemmingen toevoegt. Het bestand blijft in je browser.", "Review the route and choose which points to add as destinations. The file stays in your browser.")}</DialogDescription></DialogHeader>
    <input key={inputKey} ref={input} type="file" accept=".gpx,.xml,application/gpx+xml,text/xml,application/xml" className="hidden" onChange={(event) => void load(event.target.files?.[0])} />
    <Button type="button" variant="outline" className="w-full" onClick={() => input.current?.click()}><FileUp className="size-4" />{points.length ? text("Ander bestand kiezen", "Choose another file") : text("GPX-bestand kiezen (max. 2 MB)", "Choose GPX file (max. 2 MB)")}</Button>
    {points.length > 0 && <><GpxPreview points={points} selected={selected} text={text} /><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{text(`${points.length} geldige punten · ${selectable().length} nieuw`, `${points.length} valid points · ${selectable().length} new`)}</p><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setSelected(new Set(selectable()))}>{text("Nieuwe selecteren", "Select new")}</Button><Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{text("Geen", "None")}</Button></div></div>
      <div className="max-h-[32vh] space-y-2 overflow-y-auto pr-1">{points.map((point, index) => { const duplicate = isDuplicateGpxPoint(point, stops); return <label key={`${point.lat}-${point.lon}-${index}`} className={`flex min-h-12 items-start gap-3 rounded-lg border p-3 ${duplicate ? "opacity-60" : "cursor-pointer"}`}><Checkbox checked={selected.has(index)} disabled={duplicate} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(index); else next.delete(index); return next; })} /><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{point.name}</span><span className="text-xs text-muted-foreground">{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</span></span><Badge variant="outline">{duplicate ? text("Bestaat al", "Existing") : point.source}</Badge></label>; })}</div></>}
    <DialogFooter><Button type="button" disabled={busy || selected.size === 0} onClick={() => void apply()}>{text(`${selected.size} toevoegen`, `Add ${selected.size}`)}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function GpxPreview({ points, selected, text }: { points: GpxImportPoint[]; selected: Set<number>; text: Text }) {
  const minLat = Math.min(...points.map((point) => point.lat)), maxLat = Math.max(...points.map((point) => point.lat));
  const minLon = Math.min(...points.map((point) => point.lon)), maxLon = Math.max(...points.map((point) => point.lon));
  const project = (point: GpxImportPoint) => ({ x: 12 + ((point.lon - minLon) / (maxLon - minLon || 1)) * 376, y: 148 - ((point.lat - minLat) / (maxLat - minLat || 1)) * 136 });
  const projected = points.map(project);
  return <figure className="overflow-hidden rounded-xl border bg-muted/30 p-2"><svg viewBox="0 0 400 160" className="h-40 w-full" role="img" aria-label={text("Voorbeeld van de GPX-route", "GPX route preview")}><polyline points={projected.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" />{projected.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r={selected.has(index) ? 4 : 2.5} className={selected.has(index) ? "fill-primary" : "fill-muted-foreground"} />)}</svg><figcaption className="px-2 pb-1 text-xs text-muted-foreground">{text("Routevolgorde uit het bestand; geselecteerde punten zijn gemarkeerd.", "Route order from the file; selected points are highlighted.")}</figcaption></figure>;
}
