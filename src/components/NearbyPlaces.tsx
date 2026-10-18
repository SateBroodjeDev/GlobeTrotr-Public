import { useState } from "react";
import { ExternalLink, Loader2, MapPin, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Trip } from "@/lib/types";
import { searchNearbyPlaces, type NearbyPlace, type NearbyPlaceCategory } from "@/lib/nearby-places.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale";

const CATEGORIES: NearbyPlaceCategory[] = ["food", "sights", "activities", "practical"];

export function NearbyPlaces({trip,editable,onAdd}:{trip:Trip;editable:boolean;onAdd:(item:{day:string;title:string;notes?:string})=>Promise<void>}) {
  const {text}=useLocale();
  const [stopId,setStopId]=useState(trip.stops[0]?.id??"");
  const [category,setCategory]=useState<NearbyPlaceCategory>("sights");
  const [radiusKm,setRadiusKm]=useState(15);
  const [results,setResults]=useState<NearbyPlace[]>([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<NearbyPlace>();
  const stop=trip.stops.find((item)=>item.id===stopId);
  const [day,setDay]=useState(stop?.arrive??trip.start);

  async function search(){if(!stop)return;setResults([]);setSelected(undefined);setLoading(true);try{const response=await searchNearbyPlaces({data:{tripId:trip.id,lat:stop.lat,lon:stop.lon,category,radiusKm}});setResults(response.results);if(!response.results.length)toast.info(text(`Geen passende plaatsen binnen ${radiusKm} km gevonden. Kies een grotere straal of een andere routeplaats.`,`No matching places found within ${radiusKm} km. Choose a larger radius or another route stop.`));}catch(error){const code=error instanceof Error?error.message:"";toast.error(code.includes("NEARBY_SEARCH_RATE_LIMIT")?text("Je zoekt te snel. Probeer het over een minuut opnieuw.","You are searching too quickly. Try again in a minute."):code.includes("TRIP_NOT_FOUND")||code.includes("TRIP_ACCESS")||code.includes("AGENCY_PERMISSION")?text("Je hebt geen toegang om voor deze reis plaatsen te zoeken.","You do not have access to search for places for this trip."):text("De kaartproviders reageerden niet op tijd. Probeer het opnieuw of kies een andere routeplaats.","The map providers did not respond in time. Try again or choose another route stop."));}finally{setLoading(false)}}
  async function add(){if(!selected||!day)return;try{await onAdd({day,title:selected.name,notes:[categoryLabel(selected.category,text),`${selected.distanceKm} km`,selected.openingHours?`${text("Openingstijden","Opening hours")}: ${selected.openingHours}`:undefined,selected.osmUrl].filter(Boolean).join(" · ")});setSelected(undefined);toast.success(text("Plaats aan de dagplanning toegevoegd.","Place added to the itinerary."));}catch{/* parent shows save error */}}

  if(!trip.stops.length)return null;
  return <Card className="surface"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><MapPin className="size-4"/>{text("Plaatsen rond de route","Places near the route")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">{text("Zoek bewust rond één routeplaats. Resultaten komen uit OpenStreetMap en worden pas na jouw bevestiging aan de planning toegevoegd.","Search deliberately around one route stop. Results come from OpenStreetMap and are only added to the itinerary after your confirmation.")}</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]"><select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={stopId} onChange={(event)=>{const next=trip.stops.find((item)=>item.id===event.target.value);setStopId(event.target.value);setDay(next?.arrive??trip.start);setResults([])}}>{trip.stops.map((item)=><option key={item.id} value={item.id}>{item.name}{item.country?` · ${item.country}`:""}</option>)}</select><select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event)=>{setCategory(event.target.value as NearbyPlaceCategory);setResults([])}}>{CATEGORIES.map((item)=><option key={item} value={item}>{categoryLabel(item,text)}</option>)}</select><select aria-label={text("Zoekstraal","Search radius")} className="h-10 rounded-md border bg-background px-3 text-sm" value={radiusKm} onChange={(event)=>{setRadiusKm(Number(event.target.value));setResults([])}}>{[5,10,15,20].map((radius)=><option key={radius} value={radius}>{radius} km</option>)}</select><Button type="button" disabled={loading||!stop} onClick={()=>void search()}>{loading?<Loader2 className="size-4 animate-spin"/>:<Search className="size-4"/>}{text("Zoeken","Search")}</Button></div>
    {results.length>0&&<div className="grid gap-2 md:grid-cols-2">{results.map((item)=><div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.kind.replaceAll("_"," ")} · {item.distanceKm} km</p>{item.openingHours&&<p className="mt-1 break-words text-xs text-muted-foreground">{text("Openingstijden","Opening hours")}: {item.openingHours}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><a href={item.website??item.osmUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4"/>{text("Bron bekijken","View source")}</a></Button><Button size="sm" disabled={!editable} onClick={()=>setSelected(item)}><Plus className="size-4"/>{text("Aan planning","Add to itinerary")}</Button></div></div>)}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open)=>{if(!open)setSelected(undefined)}}><DialogContent><DialogHeader><DialogTitle>{text("Aan dagplanning toevoegen","Add to itinerary")}</DialogTitle><DialogDescription>{selected?.name}. {text("Controleer de datum. Openingstijden uit OpenStreetMap kunnen verouderd zijn.","Check the date. Opening hours from OpenStreetMap may be outdated.")}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="nearby-day">{text("Datum","Date")}</Label><Input id="nearby-day" type="date" min={trip.start} max={trip.end} value={day} onChange={(event)=>setDay(event.target.value)}/></div><DialogFooter><Button variant="outline" onClick={()=>setSelected(undefined)}>{text("Annuleren","Cancel")}</Button><Button disabled={!day||day<trip.start||day>trip.end} onClick={()=>void add()}>{text("Bevestigen en toevoegen","Confirm and add")}</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>;
}

function categoryLabel(category:NearbyPlaceCategory,text:(nl:string,en:string)=>string){return({food:text("Eten en drinken","Food and drink"),sights:text("Bezienswaardigheden","Sights"),activities:text("Activiteiten en parken","Activities and parks"),practical:text("Praktische voorzieningen","Practical services")})[category]}
