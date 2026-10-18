import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Car,
  LockKeyhole,
  MapPin,
  Plane,
  Route as RouteIcon,
  Sparkles,
  Ticket,
  TrainFront,
  Wallet,
  BookHeart,
  Grid2X2,
  List,
  Radio,
  BellRing,
  Heart,
  MessageCircle,
} from "lucide-react";
import { getPublicTrip } from "@/lib/public.functions";
import { followPublicTrip, savePublicJournalReaction } from "@/lib/public-trip-follow.functions";
import type { PublicJournalEntry } from "@/lib/public.functions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import TripMap from "@/components/TripMap";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES, type Stop } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { localizeCountry } from "@/lib/localized-values";
import { WeatherWidget } from "@/components/WeatherWidget";

export const Route = createFileRoute("/reis/$token/$tripId")({
  head: () => ({
    meta: [
      { title: "Openbare reis — GlobeTrotr" },
      {
        name: "description",
        content: "Bekijk de route, dagplanning en bestemmingen van deze openbaar gedeelde reis.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Openbare reis — GlobeTrotr" },
      {
        property: "og:description",
        content: "Route, dagplanning en bestemmingen van een gedeelde GlobeTrotr-reis.",
      },
    ],
  }),
  component: PublicTrip,
});

export function PublicTrip() {
  const { locale, text } = useLocale();
  const { user, loading: authLoading } = useAuth();
  // Deze component wordt ook door de Engelstalige /trip-route gebruikt.
  // Een niet-strikte param-read voorkomt dat hij aan de Nederlandse alias vastzit.
  const { token, tripId } = useParams({ strict: false }) as { token: string; tripId: string };
  const [pin, setPin] = useState("");
  const [submittedPin, setSubmittedPin] = useState<string | undefined>();
  const [activeStopId, setActiveStopId] = useState<string>();
  const [showAllStops, setShowAllStops] = useState(false);
  const [journalView, setJournalView] = useState<"timeline" | "gallery">("timeline");
  const [followEmail, setFollowEmail] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [visitorToken,setVisitorToken]=useState("");
  useEffect(()=>{const key="globetrotr-public-visitor";let value:string=crypto.randomUUID();try{const existing=localStorage.getItem(key);if(existing&&/^[0-9a-f-]{36}$/i.test(existing))value=existing;}catch{/* Keep reactions usable for this visit when browser storage is blocked. */}setVisitorToken(value)},[]);
  const q = useQuery({
    queryKey: ["public-trip", token, tripId, submittedPin],
    queryFn: () => getPublicTrip({ data: { token, tripId, pin: submittedPin } }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  async function follow() {
    if (!/^\S+@\S+\.\S+$/.test(followEmail)) { toast.error(text("Vul een geldig e-mailadres in.", "Enter a valid email address.")); return; }
    setFollowBusy(true);
    try {
      await followPublicTrip({ data: { token, tripId, pin: submittedPin, email: followEmail, locale } });
      setFollowEmail("");
      toast.success(text("Controleer je e-mail om het volgen te bevestigen.", "Check your email to confirm following this trip."));
    } catch { toast.error(text("Volgen kon niet worden aangezet.", "Following could not be enabled.")); }
    finally { setFollowBusy(false); }
  }

  if (q.isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label={text("Reis laden", "Loading trip")}>
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }
  if (q.isError) {
    return <Card className="surface mx-auto max-w-lg"><CardContent className="space-y-4 p-8 text-center"><h1 className="font-display text-2xl font-semibold">{text("De reis kon niet worden geladen", "The trip could not be loaded")}</h1><p className="text-sm text-muted-foreground">{text("De verbinding of reisdienst is tijdelijk niet beschikbaar. Probeer dezelfde link opnieuw.", "The connection or trip service is temporarily unavailable. Try the same link again.")}</p><Button type="button" variant="outline" onClick={()=>void q.refetch()}>{text("Opnieuw proberen", "Try again")}</Button></CardContent></Card>;
  }
  if (q.data?.status === "pin_required") {
    return (
      <Card className="surface mx-auto max-w-md overflow-hidden">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold">
              {text("Deze reis is beveiligd", "This trip is protected")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {text(
                "Vraag de 6- tot 12-cijferige pincode aan de eigenaar van deze reis.",
                "Ask the trip owner for the 6 to 12 digit PIN.",
              )}
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedPin(pin);
            }}
          >
            <Input
              aria-label={text("Pincode voor deze reis", "PIN for this trip")}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength={6}
              maxLength={12}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              placeholder="PIN"
            />
            <Button type="submit">{text("Openen", "Open")}</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (q.data?.status !== "ok") {
    return (
      <Card className="surface mx-auto max-w-lg">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted">
            <MapPin className="size-6 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {text("Deze reis is niet (meer) openbaar", "This trip is no longer public")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {text(
              "De eigenaar heeft deze link mogelijk uitgeschakeld.",
              "The owner may have disabled this link.",
            )}
          </p>
          <Button asChild variant="outline">
            <Link to="/">{text("Terug naar home", "Back home")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const trip = q.data.trip;
  const template = TEMPLATES.find((item) => item.id === trip.template);
  const stops: Stop[] = trip.stops.map((stop, index) => ({ ...stop, id: `public-stop-${index}` }));
  type ScheduleEntry =
    | { kind: "plan"; item: (typeof trip.itinerary)[number] }
    | { kind: "booking"; item: (typeof trip.travelItems)[number] };
  const schedule = new Map<string, ScheduleEntry[]>();
  for (const item of trip.itinerary) {
    schedule.set(item.day, [...(schedule.get(item.day) ?? []), { kind: "plan", item }]);
  }
  for (const item of trip.travelItems ?? []) {
    schedule.set(item.date, [...(schedule.get(item.date) ?? []), { kind: "booking", item }]);
  }
  const scheduleDays = [...schedule.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dateRange = formatDateRange(trip.start, trip.end, locale);
  const visibleStops = showAllStops ? stops : stops.slice(0, 8);
  const weatherStop = stops.find((stop) => stop.id === activeStopId) ?? stops[0];
  const countryCount = new Set(stops.map((stop) => stop.country).filter(Boolean)).size;
  const tripBranding = trip.branding;
  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="aurora relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14" style={tripBranding?{background:`linear-gradient(135deg,hsl(${tripBranding.accent} 70% 45% / .20),transparent)`}:undefined}>
        {trip.coverUrl && <img src={trip.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20"/>}
        <div className="relative max-w-3xl">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Sparkles className="size-3" /> {text("Openbaar reisverhaal", "Public travel story")}
          </Badge>
          <div className="flex items-start gap-4">
            <span className="text-4xl sm:text-5xl" aria-hidden>
              {template?.emoji ?? "🌍"}
            </span>
            <div className="min-w-0">
              <h1 className="break-anywhere font-display text-3xl font-semibold leading-tight sm:text-5xl">
                {trip.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm opacity-90 sm:text-base">
                <CalendarDays className="size-4" /> {dateRange}
                <span aria-hidden>·</span> {text("gedeeld door", "shared by")} {trip.authorName}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl break-anywhere text-sm leading-relaxed opacity-90 sm:text-base">
            {trip.description ||
              (stops.length
                ? text(
                    `Een reis langs ${stops.length} ${stops.length === 1 ? "bestemming" : "bestemmingen"}${countryCount ? ` in ${countryCount} ${countryCount === 1 ? "land" : "landen"}` : ""}.`,
                    `A trip across ${stops.length} ${stops.length === 1 ? "destination" : "destinations"}${countryCount ? ` in ${countryCount} ${countryCount === 1 ? "country" : "countries"}` : ""}.`,
                  )
                : text(
                    "De route en dagplanning van deze reis worden hier gedeeld.",
                    "The route and daily itinerary for this trip are shared here.",
                  ))}
          </p>
          {tripBranding&&<p className="mt-5 text-xs opacity-75">{tripBranding.brandName} · {tripBranding.domain}</p>}
        </div>
      </header>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="surface min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RouteIcon className="size-4 text-primary" /> {text("De route", "The route")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            {stops.length > 0 ? (
              <TripMap stops={stops} activeStopId={activeStopId} onStopSelect={setActiveStopId} />
            ) : (
              <div className="grid h-72 place-items-center rounded-xl bg-muted/50 text-sm text-muted-foreground">
                {text("Nog geen bestemmingen gedeeld.", "No destinations shared yet.")}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="min-w-0 space-y-4 self-start lg:sticky lg:top-24">
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Radio className="size-4 animate-pulse" />{text("Live reisfeed", "Live travel feed")}</div>
              <h2 className="mt-2 font-display text-xl font-semibold">{text("Reis op afstand mee", "Follow the journey from afar")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text("Ontvang alleen herinneringen die de reiziger bewust verstuurt. Bevestig eerst je e-mailadres en meld je met één klik weer af.", "Receive only memories deliberately sent by the traveller. Confirm your email first and unsubscribe with one click.")}</p>
            </div>
            <form className="space-y-2" onSubmit={(event)=>{event.preventDefault();void follow();}}>
              <Input type="email" autoComplete="email" maxLength={254} value={followEmail} onChange={(event)=>setFollowEmail(event.target.value)} placeholder={text("jouw@email.nl", "you@email.com")} aria-label={text("E-mailadres voor reisupdates", "Email for travel updates")} />
              <Button className="w-full" disabled={followBusy || !followEmail.trim()}><BellRing className="size-4" />{followBusy?text("Versturen…","Sending…"):text("Deze reis volgen","Follow this trip")}</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="surface min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> {text("Bestemmingen", "Destinations")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stops.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {text("De route is nog leeg.", "The route is empty.")}
              </p>
            )}
            {visibleStops.map((stop) => {
              const index = stops.findIndex((item) => item.id === stop.id);
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => setActiveStopId(stop.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${activeStopId === stop.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{stop.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[
                        localizeCountry(stop.country, locale),
                        stop.arrive ? formatDate(stop.arrive, locale) : "",
                        stop.nights
                          ? `${stop.nights} ${text(stop.nights === 1 ? "nacht" : "nachten", stop.nights === 1 ? "night" : "nights")}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
            {stops.length > 8 && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setShowAllStops((current) => !current)}
              >
                {showAllStops
                  ? text("Minder bestemmingen", "Fewer destinations")
                  : text(`Alle ${stops.length} bestemmingen`, `All ${stops.length} destinations`)}
              </Button>
            )}
          </CardContent>
        </Card>
        </aside>
      </section>

      {trip.weatherEnabled && weatherStop && (
        <WeatherWidget
          stop={weatherStop}
          enabled
          publicAccess={{ token, tripId, ...(submittedPin ? { pin: submittedPin } : {}) }}
        />
      )}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {text("Van dag tot dag", "Day by day")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {text("Reisschema", "Trip itinerary")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {text("Dagplanning en bewust gedeelde reisonderdelen op datum. Privéboekingsgegevens blijven verborgen.", "Daily plans and intentionally shared bookings by date. Private booking details stay hidden.")}
          </p>
        </div>
        {scheduleDays.length === 0 ? (
          <Card className="surface"><CardContent className="py-8 text-center text-sm text-muted-foreground">
            {text("Nog geen reisschema gedeeld.", "No itinerary shared yet.")}
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {scheduleDays.map(([day, entries], dayIndex) => (
              <Card key={day} className="surface overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/30 pb-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {text("Dag", "Day")} {dayIndex + 1}
                  </p>
                  <CardTitle className="text-base">{formatDate(day, locale)}</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border pt-1">
                  {entries.map((entry, index) => {
                    if (entry.kind === "plan") return (
                      <div key={`plan-${index}`} className="py-3">
                        <p className="text-sm font-medium">{entry.item.title}</p>
                        {entry.item.notes && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.item.notes}</p>}
                      </div>
                    );
                    const item = entry.item;
                    const ItemIcon = item.type === "flight" ? Plane : item.type === "lodging" ? BedDouble : item.type === "car_rental" ? Car : item.type === "transport" ? TrainFront : Ticket;
                    const typeLabel = item.type === "flight" ? text("Vlucht", "Flight") : item.type === "lodging" ? text("Overnachting", "Accommodation") : item.type === "car_rental" ? text("Huurauto", "Rental car") : item.type === "transport" ? text("Vervoer", "Transport") : text("Activiteit", "Activity");
                    const location = item.departure?.name ? [item.departure.name, item.arrival?.name].filter(Boolean).join(" → ") : item.location?.name;
                    return (
                      <div key={`booking-${index}`} className="flex min-w-0 gap-3 py-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ItemIcon className="size-4" /></span>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium break-anywhere">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{typeLabel}{item.startTime ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ""}` : ""}{item.endDate && item.endDate !== item.date ? ` · ${formatDate(item.endDate, locale)}` : ""}</p>
                          {location && <p className="text-xs text-muted-foreground break-anywhere">{location}</p>}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {trip.journalSummary && <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{text("Reissamenvatting","Trip summary")}</p><h2 className="mt-2 font-display text-3xl font-semibold">{trip.journalSummary.title}</h2><p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">{trip.journalSummary.body}</p></section>}
      {trip.journal.length > 0 && <section className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{text("Herinneringen", "Memories")}</p><h2 className="mt-1 font-display text-2xl font-semibold">{text("Reisterugblik", "Travel story")}</h2><p className="mt-1 text-sm text-muted-foreground">{text("Alleen herinneringen die bewust voor de gedeelde reisgids zijn gekozen.", "Only memories deliberately selected for the shared trip guide.")}</p><div className="mt-3 flex gap-2"><Button size="sm" variant={journalView==="timeline"?"secondary":"outline"} onClick={()=>setJournalView("timeline")}><List className="size-4"/>{text("Tijdlijn","Timeline")}</Button><Button size="sm" variant={journalView==="gallery"?"secondary":"outline"} onClick={()=>setJournalView("gallery")}><Grid2X2 className="size-4"/>{text("Galerij","Gallery")}</Button></div></div><div className={journalView==="gallery"?"grid gap-5 sm:grid-cols-2 lg:grid-cols-3":"relative space-y-5 border-l border-border pl-5"}>{trip.journal.map((entry) => <article key={entry.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">{entry.photos[0] && <img src={entry.photos[0].url} alt={entry.photos[0].caption ?? ""} className="aspect-[16/10] w-full object-cover" loading="lazy" />}<div className="p-5"><p className="text-xs text-muted-foreground">{formatDate(entry.date, locale)}{entry.location ? ` · ${entry.location}` : ""}</p><h3 className="mt-1 flex items-center gap-2 text-xl font-semibold"><BookHeart className="size-5 text-primary"/>{entry.title}</h3>{entry.rating && <p className="mt-2 text-amber-600">{"★".repeat(entry.rating)}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6">{entry.body}</p>{entry.photos.length > 1 && <div className="mt-4 grid grid-cols-3 gap-2">{entry.photos.slice(1, 4).map((photo) => <img key={photo.url} src={photo.url} alt={photo.caption ?? ""} loading="lazy" className="aspect-square w-full rounded-lg object-cover"/>)}</div>}{entry.videos.map(video=><figure key={video.url} className="mt-4"><video controls preload="metadata" className="max-h-[32rem] w-full rounded-xl bg-black" src={video.url}/>{video.caption&&<figcaption className="mt-1 text-xs text-muted-foreground">{video.caption}</figcaption>}</figure>)}<JournalInteraction entry={entry} visitorToken={visitorToken} token={token} tripId={tripId} pin={submittedPin} text={text} saved={()=>void q.refetch()}/></div></article>)}</div></section>}

      {typeof trip.budget === "number" && (
        <Card className="surface overflow-hidden border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="size-4 text-primary" />{" "}
                {text("Gedeeld reisbudget", "Shared trip budget")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {text(
                  "De eigenaar heeft alleen het totaalbudget openbaar gemaakt.",
                  "The owner has only made the total budget public.",
                )}
              </p>
            </div>
            <p className="font-display text-2xl font-semibold">
              {formatMoney(trip.budget, trip.currency, locale)}
            </p>
          </CardContent>
        </Card>
      )}

      {!authLoading && (
        <Card className="surface overflow-hidden">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="font-display text-xl font-semibold">
                {text("Klaar voor je eigen avontuur?", "Ready for your own adventure?")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {text(
                  "Plan je route, dagprogramma en gezamenlijke kosten op één plek.",
                  "Plan your route, itinerary and shared expenses in one place.",
                )}
              </p>
            </div>
            <Button asChild>
              {user ? (
                <Link to="/dashboard">
                  {text("Naar mijn reizen", "View my trips")} <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link to="/auth">
                  {text("Gratis account maken", "Create free account")}{" "}
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JournalInteraction({entry,visitorToken,token,tripId,pin,text,saved}:{entry:PublicJournalEntry;visitorToken:string;token:string;tripId:string;pin?:string;text:(nl:string,en:string)=>string;saved:()=>void}){
  const storageKey=`globetrotr-liked-${entry.id}`;
  const [liked,setLiked]=useState(false),[name,setName]=useState(""),[comment,setComment]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{try{setLiked(localStorage.getItem(storageKey)==="true");}catch{setLiked(false);}},[storageKey]);
  async function submit(nextLiked=liked){setBusy(true);try{await savePublicJournalReaction({data:{token,tripId,...(pin?{pin}:{}),entryId:entry.id,visitorToken,liked:nextLiked,name,comment}});try{localStorage.setItem("globetrotr-public-visitor",visitorToken);localStorage.setItem(storageKey,String(nextLiked));}catch{/* Server save succeeded; browser persistence is optional. */}setLiked(nextLiked);setComment("");saved();toast.success(text("Reactie opgeslagen.","Reaction saved."));}catch{toast.error(text("Reactie kon niet worden opgeslagen. Probeer het rustig opnieuw.","Reaction could not be saved. Please try again shortly."));}finally{setBusy(false)}}
  return <div className="mt-5 space-y-3 border-t pt-4"><div className="flex items-center gap-3"><Button size="sm" variant={liked?"secondary":"outline"} disabled={busy||!visitorToken} onClick={()=>void submit(!liked)}><Heart className={`size-4 ${liked?"fill-current":""}`}/>{entry.likes} {text("likes","likes")}</Button><span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="size-4"/>{entry.comments.length} {text("reacties","comments")}</span></div>{entry.comments.length>0&&<div className="space-y-2">{entry.comments.map(item=><div key={item.id} className="rounded-lg bg-muted/40 p-3 text-sm"><strong>{item.name}</strong><p className="mt-1 whitespace-pre-wrap">{item.body}</p></div>)}</div>}<p className="text-xs leading-relaxed text-muted-foreground">{text("Je gekozen naam en reactie zijn zichtbaar voor bezoekers van dit reisverhaal. Na een succesvolle like of reactie onthouden we op dit apparaat je reactievoorkeur.", "Your chosen name and comment are visible to visitors of this trip story. After a successful like or comment we remember your reaction preference on this device.")} <a href="https://globetrotr.nl/privacy#browseropslag" className="underline">{text("Privacy en browseropslag", "Privacy and browser storage")}</a>.</p><form className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]" onSubmit={event=>{event.preventDefault();void submit()}}><Input aria-label={text("Naam bij je openbare reactie", "Name shown with your public comment")} maxLength={60} required value={name} onChange={event=>setName(event.target.value)} placeholder={text("Je naam","Your name")}/><Input aria-label={text("Reactie op het reisverhaal", "Comment on the trip story")} maxLength={500} required value={comment} onChange={event=>setComment(event.target.value)} placeholder={text("Schrijf een reactie","Write a comment")}/><Button disabled={busy||!visitorToken||!name.trim()||!comment.trim()}>{text("Plaatsen","Post")}</Button></form></div>
}

function formatDate(value: string, locale: "nl-NL" | "en-GB") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateRange(start: string, end: string, locale: "nl-NL" | "en-GB") {
  if (!start && !end)
    return locale === "nl-NL" ? "Reisdata nog niet bekend" : "Travel dates not available yet";
  if (start === end || !end) return formatDate(start, locale);
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}

function formatMoney(amount: number, currency = "EUR", locale: "nl-NL" | "en-GB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
