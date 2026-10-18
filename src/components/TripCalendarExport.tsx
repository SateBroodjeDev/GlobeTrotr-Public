import { useRef, useState } from "react";
import { CalendarDays, Copy, Download, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createCalendarFeed,
  getCalendarFeedStatus,
  revokeCalendarFeed,
} from "@/lib/calendar-feed.functions";
import { downloadTripCalendar } from "@/lib/exporters";
import { useLocale } from "@/lib/locale";
import { ownsTrip } from "@/lib/plans";
import type { Trip } from "@/lib/types";

type TripCalendarExportProps = { trip: Trip; paid: boolean };

export function TripCalendarExport(props: TripCalendarExportProps) {
  return <TripCalendarExportDialog key={props.trip.id} {...props} />;
}

function TripCalendarExportDialog({ trip, paid }: TripCalendarExportProps) {
  const { text, locale } = useLocale();
  const tripOwner = ownsTrip(trip.accessRole);
  const canManageLive = paid && tripOwner;
  const statusRequest = useRef(0);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(false),
    [createdAt, setCreatedAt] = useState<string | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [statusError, setStatusError] = useState(false);
  async function loadStatus() {
    if (!canManageLive) return;
    const request = ++statusRequest.current;
    setChecking(true);
    setStatusError(false);
    try {
      const status = await getCalendarFeedStatus({ data: { tripUuid: trip.id } });
      if (request === statusRequest.current) {
        setActive(Boolean(status));
        setCreatedAt(status?.created_at ?? null);
        if (!status) setUrl("");
      }
    } catch {
      if (request === statusRequest.current) setStatusError(true);
    } finally {
      if (request === statusRequest.current) setChecking(false);
    }
  }
  function opened(value: boolean) {
    setOpen(value);
    if (value) void loadStatus();
    else {
      statusRequest.current += 1;
      setChecking(false);
    }
  }
  async function create() {
    if (!canManageLive || checking || statusError) return;
    setBusy(true);
    try {
      const result = await createCalendarFeed({ data: { tripUuid: trip.id } });
      setUrl(result.url);
      setActive(true);
      setCreatedAt(new Date().toISOString());
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success(
          text(
            "Abonnementslink aangemaakt en gekopieerd.",
            "Subscription link created and copied.",
          ),
        );
      } catch {
        toast.success(
          text(
            "Abonnementslink aangemaakt. Kopieer de link hieronder.",
            "Subscription link created. Copy the link below.",
          ),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes("CALENDAR_FEED_ENDPOINT_UNAVAILABLE")
        ? active
          ? text("De live agenda is momenteel niet bereikbaar. Je bestaande link blijft actief; probeer het later opnieuw.", "The live calendar is currently unavailable. Your existing link remains active; try again later.")
          : text("De live agenda kon niet worden geactiveerd. Probeer het later opnieuw.", "The live calendar could not be activated. Try again later.")
        : text("De agendalink kon niet worden gemaakt.", "The calendar link could not be created."));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!canManageLive || checking || statusError) return;
    setBusy(true);
    try {
      await revokeCalendarFeed({ data: { tripUuid: trip.id } });
      setActive(false);
      setCreatedAt(null);
      setUrl("");
      toast.success(text("Agendalink ingetrokken.", "Calendar link revoked."));
    } catch {
      toast.error(text("De agendalink kon niet worden ingetrokken. Probeer het opnieuw; de link kan nog actief zijn.", "The calendar link could not be revoked. Try again; the link may still be active."));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(text("Agendalink gekopieerd.", "Calendar link copied."));
    } catch {
      toast.error(text(
        "Kopi\u00ebren lukt niet. Selecteer de link hieronder en kopieer hem handmatig.",
        "Copying failed. Select the link below and copy it manually.",
      ));
    }
  }
  return (
    <Dialog open={open} onOpenChange={opened}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <CalendarDays className="size-4" /> {text("Agenda", "Calendar")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text("Reisagenda gebruiken", "Use trip calendar")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-xl border p-4">
            <p className="font-medium">{text("Eenmalige export", "One-time export")}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {text("Download de planning zoals die nu is.", "Download the schedule as it is now.")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                downloadTripCalendar(trip);
                toast.success(text("Reisagenda gedownload", "Trip calendar downloaded"));
              }}
            >
              <Download className="size-4" /> ICS
            </Button>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">
              {text("Live abonnement · Pro", "Live subscription · Pro")}
            </p>
            <p className="mb-3 text-sm text-muted-foreground">
              {text(
                "Je agenda-app haalt wijzigingen automatisch op via een persoonlijke, alleen-lezen link. GlobeTrotr publiceert wijzigingen direct; je agenda-app bepaalt hoe vaak hij controleert.",
                "Your calendar app automatically retrieves changes through a personal read-only link. GlobeTrotr publishes changes immediately; your calendar app decides how often it checks.",
              )}
            </p>
            {canManageLive && !checking && !statusError && active && createdAt && (
              <p className="mb-3 text-xs text-muted-foreground">
                {text("Actieve link gemaakt op", "Active link created on")} {new Date(createdAt).toLocaleString(locale)}. {url
                  ? text("Bewaar deze persoonlijke URL veilig.", "Store this personal URL securely.")
                  : text(
                      "De geheime URL wordt niet opnieuw getoond. Maak alleen een nieuwe link als je de oude niet meer hebt.",
                      "The secret URL is not shown again. Create a new link only if you no longer have the old one.",
                    )}
              </p>
            )}
            {!tripOwner ? (
              <p className="text-sm text-muted-foreground">
                {text("Alleen de reiseigenaar kan een live agendalink beheren. Je kunt deze reis wel als ICS downloaden.", "Only the trip owner can manage a live calendar link. You can still download this trip as ICS.")}
              </p>
            ) : !paid ? (
              <p className="text-sm text-muted-foreground">
                {text("Beschikbaar met Pro of Agency.", "Available with Pro or Agency.")}
              </p>
            ) : checking ? (
              <p role="status" className="text-sm text-muted-foreground">
                {text("Agendalink controleren\u2026", "Checking calendar link\u2026")}
              </p>
            ) : statusError ? (
              <div className="grid gap-3">
                <p role="alert" className="text-sm text-destructive">
                  {text("De status van je agendalink kon niet worden gecontroleerd. Een bestaande link kan nog actief zijn.", "Your calendar link status could not be checked. An existing link may still be active.")}
                </p>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void loadStatus()}>
                  <RefreshCw className="size-4" /> {text("Opnieuw controleren", "Check again")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={create}>
                  <RefreshCw className="size-4" />
                  {active
                    ? text("Nieuwe link maken", "Create new link")
                    : text("Link maken", "Create link")}
                </Button>
                {url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.assign(url.replace(/^https:/, "webcal:"))}
                  >
                    <ExternalLink className="size-4" />
                    {text("Open in agenda-app", "Open in calendar app")}
                  </Button>
                )}
                {url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copy()}
                  >
                    <Copy className="size-4" />
                    {text("Kopiëren", "Copy")}
                  </Button>
                )}
                {active && (
                  <Button type="button" variant="ghost" disabled={busy} onClick={revoke}>
                    <Trash2 className="size-4" />
                    {text("Intrekken", "Revoke")}
                  </Button>
                )}
                {url && (
                  <input
                    aria-label={text("Persoonlijke agendalink", "Personal calendar link")}
                    className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
