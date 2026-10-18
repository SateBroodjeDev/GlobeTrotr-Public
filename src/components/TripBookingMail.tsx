import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock3, Copy, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createTripBookingMail,
  getTripBookingMail,
  reviewTripBookingMail,
  revokeTripBookingMail,
} from "@/lib/booking-mail.functions";
import {
  BOOKING_MAIL_FIELDS,
  bookingMailDate,
  bookingMailTravelItem,
  type BookingMailDraft,
} from "@/lib/booking-mail";

type Text = (nl: string, en: string) => string;
const types = [
  ["flight", "Vlucht", "Flight"],
  ["lodging", "Verblijf", "Accommodation"],
  ["transport", "Vervoer", "Transport"],
  ["car_rental", "Huurauto", "Rental car"],
  ["activity", "Activiteit", "Activity"],
] as const;

export function TripBookingMail({
  tripId,
  text,
  acceptDraft,
}: {
  tripId: string;
  text: Text;
  acceptDraft: (draft: BookingMailDraft) => Promise<void>;
}) {
  const [view, setView] = useState<"pending" | "reviewed">("pending");
  const [page, setPage] = useState(0);
  const [senders, setSenders] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [editedTypes, setEditedTypes] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["trip-booking-mail", tripId, view, page],
    queryFn: () => getTripBookingMail({ data: { tripId, view, page } }),
    retry: false,
    refetchInterval: busy ? false : 30_000,
  });
  const address = query.data?.address;
  const allowedSendersKey = Array.isArray(address?.allowed_senders)
    ? address.allowed_senders.join(", ")
    : "";
  useEffect(() => {
    setSenders(allowedSendersKey);
    if (address?.retention_days) setRetentionDays(Number(address.retention_days));
  }, [address?.id, allowedSendersKey, address?.retention_days]);
  useEffect(() => {
    setPage(0);
    setEdits({});
    setEditedTypes({});
  }, [tripId]);
  const pendingCount = query.data?.pendingCount || 0;
  const reviewedCount = query.data?.reviewedCount || 0;
  const total = view === "pending" ? pendingCount : reviewedCount;
  useEffect(() => {
    if (query.isSuccess && page > 0 && page * 25 >= total)
      setPage(Math.max(0, Math.ceil(total / 25) - 1));
  }, [page, query.isSuccess, total]);

  async function run(action: () => Promise<void>, failure: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(failure);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    const allowed = senders
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > 365 ||
      allowed.length > 30 ||
      allowed.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    ) {
      toast.error(
        text(
          "Vul geldige afzenders en een bewaartermijn van 1 tot 365 dagen in.",
          "Enter valid senders and a retention period of 1 to 365 days.",
        ),
      );
      return;
    }
    await run(
      async () => {
        await createTripBookingMail({ data: { tripId, retentionDays, allowedSenders: allowed } });
        await query.refetch();
        toast.success(text("Boekingsadres opgeslagen.", "Booking address saved."));
      },
      text(
        "Boekingsadres kon niet worden opgeslagen. Controleer of de gedeelde inbox gereed is.",
        "The booking address could not be saved. Check that the shared inbox is ready.",
      ),
    );
  }
  async function revoke() {
    if (
      !confirm(
        text(
          "Dit adres intrekken? Nieuwe mail wordt niet meer verwerkt. Bestaande concepten blijven tot hun vervaldatum bewaard.",
          "Revoke this address? New mail will no longer be processed. Existing drafts remain until their expiry date.",
        ),
      )
    )
      return;
    await run(
      async () => {
        await revokeTripBookingMail({ data: { tripId } });
        await query.refetch();
        toast.success(text("Boekingsadres ingetrokken.", "Booking address revoked."));
      },
      text("Adres kon niet worden ingetrokken.", "The address could not be revoked."),
    );
  }
  async function review(draft: BookingMailDraft, action: "accepted" | "rejected") {
    if (action === "accepted") {
      try {
        bookingMailTravelItem(draft, "");
      } catch {
        toast.error(
          text(
            "Kies een boekingstype en controleer de begin-/einddatum en tijden. Wijzigingen en annuleringen voeg je niet als nieuwe boeking toe.",
            "Choose a booking type and check the start/end dates and times. Changes and cancellations cannot be added as new bookings.",
          ),
        );
        return;
      }
    }
    await run(
      async () => {
        if (action === "accepted") await acceptDraft(draft);
        await reviewTripBookingMail({
          data: {
            tripId,
            draftId: draft.id,
            action,
            ...(action === "accepted"
              ? {
                  bookingType: draft.booking_type,
                  parsedData: Object.fromEntries(
                    BOOKING_MAIL_FIELDS.filter(
                      ([key]) => typeof draft.parsed_data[key] === "string",
                    ).map(([key]) => [key, draft.parsed_data[key]]),
                  ),
                }
              : {}),
          },
        });
        setEdits((current) => {
          const next = { ...current };
          delete next[draft.id];
          return next;
        });
        await query.refetch();
        toast.success(
          action === "accepted"
            ? text("Boeking toegevoegd.", "Booking added.")
            : text("Bericht afgehandeld.", "Message reviewed."),
        );
      },
      text(
        "Concept kon niet worden bijgewerkt. Opnieuw proberen voegt dezelfde boeking niet dubbel toe.",
        "The draft could not be updated. Retrying will not add the same booking twice.",
      ),
    );
  }

  if (query.isPending)
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5">
          <RefreshCw className="size-4 animate-spin" />
          {text("Reisinbox laden…", "Loading trip inbox…")}
        </CardContent>
      </Card>
    );
  if (query.isError)
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <p>
            {text(
              "De reisinbox kon niet worden geladen. Deze inbox is beschikbaar voor de reiseigenaar en bevoegde Agency-medewerkers.",
              "The trip inbox could not be loaded. This inbox is available to the trip owner and authorised Agency staff.",
            )}
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {text("Opnieuw proberen", "Retry")}
          </Button>
        </CardContent>
      </Card>
    );
  if (query.data?.available === false)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            {text("Reisinbox", "Trip inbox")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">
                {text("Tijdelijk niet beschikbaar", "Temporarily unavailable")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {text(
                  "De reisinbox wordt beschikbaar na de aflevercontrole van de mailserver. Bestaande boekingen en gewone GlobeTrotr-mail blijven werken.",
                  "The trip inbox will be available after the mail server delivery checks. Existing bookings and regular GlobeTrotr email continue to work.",
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            {text("Reisinbox", "Trip inbox")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {text(
              "Stuur of forward een boekingsbevestiging naar je reisadres. Controleer het concept voordat je het aan de reis toevoegt. Een wijziging of annulering pas je handmatig toe op de bestaande boeking.",
              "Send or forward a booking confirmation to your trip address. Review the draft before adding it to your trip. Apply changes or cancellations manually to the existing booking.",
            )}
          </p>
          {address?.active ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all rounded bg-muted px-3 py-2 text-sm">
                {address.address}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(address.address)
                    .then(() => toast.success(text("Adres gekopieerd.", "Address copied.")))
                    .catch(() =>
                      toast.error(
                        text("Kopieer het adres handmatig.", "Copy the address manually."),
                      ),
                    )
                }
              >
                <Copy className="mr-2 size-4" />
                {text("Kopiëren", "Copy")}
              </Button>
              <Badge variant="secondary">{text("Actief reisadres", "Active trip address")}</Badge>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => void revoke()}>
                {text("Intrekken", "Revoke")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {address && (
                <p className="text-sm text-muted-foreground">
                  {text(
                    "Dit adres is ingetrokken. Bij opnieuw activeren krijg je een nieuw reisadres.",
                    "This address has been revoked. Reactivating creates a new trip address.",
                  )}
                </p>
              )}
              <Button disabled={busy} onClick={() => void save()}>
                {text(
                  address ? "Nieuw reisadres maken" : "Maak reisadres",
                  address ? "Create new trip address" : "Create trip address",
                )}
              </Button>
            </div>
          )}
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
              <span>{text("Toegestane afzenders", "Allowed senders")}</span>
              <Input
                value={senders}
                disabled={busy}
                onChange={(event) => setSenders(event.target.value)}
                placeholder="booking@example.com"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span>{text("Concepten bewaren (dagen)", "Keep drafts (days)")}</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={retentionDays}
                disabled={busy}
                onChange={(event) => setRetentionDays(Number(event.target.value))}
              />
            </label>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              disabled={busy}
              onClick={() => void save()}
            >
              {text("Opslaan", "Save")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {text(
              "Optioneel, gescheiden door komma’s. Bij doorsturen is jouw e-mailadres de afzender. Dit filter bewijst niet de identiteit van een afzender.",
              "Optional, comma-separated. When forwarding, your email address is the sender. This filter does not prove a sender’s identity.",
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {text(
              "Alleen herkende tekstgegevens worden als concept bewaard. Bijlagen, PDF’s en de oorspronkelijke mail worden hier niet opgeslagen of automatisch uitgelezen. Toegevoegde boekingen blijven in de reis staan wanneer een concept vervalt. De originele mail blijft op de mailserver.",
              "Only recognised text fields are kept as drafts. Attachments, PDFs and the original email are not stored or automatically read here. Added bookings stay in the trip when a draft expires. The original email remains on the mail server.",
            )}
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={view === "pending" ? "default" : "outline"}
          disabled={busy}
          onClick={() => {
            setView("pending");
            setPage(0);
          }}
        >
          {text("Te controleren", "To review")} ({pendingCount})
        </Button>
        <Button
          variant={view === "reviewed" ? "default" : "outline"}
          disabled={busy}
          onClick={() => {
            setView("reviewed");
            setPage(0);
          }}
        >
          {text("Afgehandeld", "Reviewed")} ({reviewedCount})
        </Button>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          disabled={busy || query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          {text("Vernieuwen", "Refresh")}
        </Button>
      </div>
      {!query.data?.drafts.length && (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          {text(
            view === "pending"
              ? "Geen berichten om te controleren. Nieuwe mail verschijnt na de volgende synchronisatieronde."
              : "Nog geen afgehandelde berichten binnen de bewaartermijn.",
            view === "pending"
              ? "No messages to review. New email appears after the next sync round."
              : "No reviewed messages within the retention period yet.",
          )}
        </p>
      )}
      {(query.data?.drafts || []).map((draft: BookingMailDraft) => {
        const values = { ...draft.parsed_data, ...(edits[draft.id] || {}) };
        const reviewed = {
          ...draft,
          booking_type: editedTypes[draft.id] || draft.booking_type,
          parsed_data: values,
        };
        const isNew = values.changeKind === "new";
        const fields = (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <label className="space-y-1">
              <span>{text("Boekingstype", "Booking type")}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={reviewed.booking_type}
                disabled={busy || draft.status !== "pending" || !isNew}
                onChange={(event) =>
                  setEditedTypes((current) => ({ ...current, [draft.id]: event.target.value }))
                }
              >
                <option value="unknown">{text("Kies een type", "Choose a type")}</option>
                {types.map(([value, nl, en]) => (
                  <option key={value} value={value}>
                    {text(nl, en)}
                  </option>
                ))}
              </select>
            </label>
            {BOOKING_MAIL_FIELDS.map(([key, nl, en]) => (
              <label className="space-y-1" key={key}>
                <span className="text-muted-foreground">{text(nl, en)}</span>
                <Input
                  type={
                    key === "date" || key === "endDate"
                      ? "date"
                      : key === "startTime" || key === "endTime"
                        ? "time"
                        : "text"
                  }
                  maxLength={160}
                  disabled={busy || draft.status !== "pending"}
                  value={
                    key === "date" || key === "endDate"
                      ? bookingMailDate(values[key]) || ""
                      : String(values[key] || "")
                  }
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [draft.id]: { ...(current[draft.id] || {}), [key]: event.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        );
        return (
          <Card key={draft.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <strong className="break-words">
                    {draft.subject || text("Zonder onderwerp", "No subject")}
                  </strong>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {draft.sender_address}
                  </p>
                </div>
                <Badge variant="outline">
                  {text("Velden herkend", "Fields recognised")}:{" "}
                  {Math.round(Number(draft.confidence) * 100)}%
                </Badge>
              </div>
              {draft.status === "pending" ? (
                <>
                  {!isNew && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      {text(
                        "Dit is mogelijk een wijziging of annulering. Pas de bestaande boeking handmatig aan en sluit dit bericht als bekeken.",
                        "This may be a change or cancellation. Update the existing booking manually and close this message as reviewed.",
                      )}
                    </p>
                  )}
                  {fields}
                  <div className="flex flex-wrap gap-2">
                    {isNew && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void review(reviewed, "accepted")}
                      >
                        {text("Als boeking toevoegen", "Add as booking")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void review(draft, "rejected")}
                    >
                      {text(
                        isNew ? "Afwijzen" : "Als bekeken sluiten",
                        isNew ? "Reject" : "Close as reviewed",
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Badge variant="secondary">
                    {text(
                      draft.status === "accepted" ? "Toegevoegd aan reis" : "Gesloten",
                      draft.status === "accepted" ? "Added to trip" : "Closed",
                    )}
                  </Badge>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      {text("Gegevens bekijken", "View details")}
                    </summary>
                    <div className="mt-3">{fields}</div>
                  </details>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
      {total > 25 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={busy || page === 0}
            onClick={() => setPage((current) => current - 1)}
          >
            {text("Vorige", "Previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {Math.ceil(total / 25)}
          </span>
          <Button
            variant="outline"
            disabled={busy || (page + 1) * 25 >= total}
            onClick={() => setPage((current) => current + 1)}
          >
            {text("Volgende", "Next")}
          </Button>
        </div>
      )}
    </div>
  );
}
