import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/lib/locale";
import { respondToTripInvitation } from "@/lib/invitation.functions";
import { respondToAgencyInvitation } from "@/lib/agency.functions";
import { notificationPreview } from "@/lib/notification-preview";
import { PushNotificationControl } from "@/components/PushNotificationControl";

const styles = {
  account: {
    emoji: "",
    label: "Account",
    color:
      "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100",
  },
  trip_change: {
    emoji: "",
    label: "Reiswijziging",
    color:
      "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
  },
  invitation: {
    emoji: "",
    label: "Uitnodiging",
    color:
      "border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  },
  membership: {
    emoji: "",
    label: "Reisdeelname",
    color:
      "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100",
  },
  feedback: {
    emoji: "",
    label: "Feedback",
    color:
      "border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100",
  },
  platform: {
    emoji: "",
    label: "GlobeTrotr",
    color:
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
  agency_quote: {
    emoji: "",
    label: "Offerte",
    color:
      "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100",
  },
  agency_access: {
    emoji: "",
    label: "Agency-toegang",
    color:
      "border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100",
  },
  agency_task: {
    emoji: "",
    label: "Agency-taak",
    color:
      "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
  },
  trip_document: {
    emoji: "",
    label: "Reisdocument",
    color:
      "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-100",
  },
  agency_client: {
    emoji: "",
    label: "Agency-klant",
    color:
      "border-lime-300 bg-lime-50 text-lime-950 dark:border-lime-800 dark:bg-lime-950/50 dark:text-lime-100",
  },
  trip_access: {
    emoji: "",
    label: "Reistoegang",
    color:
      "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100",
  },
  trip_booking: {
    emoji: "",
    label: "Boeking",
    color:
      "border-purple-300 bg-purple-50 text-purple-950 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-100",
  },
  trip_expense: {
    emoji: "",
    label: "Uitgave",
    color:
      "border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100",
  },
  trip_settlement: {
    emoji: "",
    label: "Verrekening",
    color:
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
  flight_alert: {
    emoji: "",
    label: "Vluchtwijziging",
    color:
      "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100",
  },
} as const;

export function NotificationPanel({ userId }: { userId: string }) {
  const { locale, text } = useLocale();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", userId];
  const notifications = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (error) throw error;
      return { items: data, count: count ?? data.length };
    },
    refetchInterval: 30_000,
    retry: 1,
  });
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (event) => {
          const item = event.new as {
            kind?: string;
            title?: string;
            body?: string;
            dismissed_at?: string | null;
            created_at?: string;
          };
          const previous = event.old as { dismissed_at?: string | null; created_at?: string };
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          const shouldToast = !item.dismissed_at && (
            event.eventType === "INSERT" ||
            (event.eventType === "UPDATE" &&
              !item.dismissed_at &&
              (Boolean(previous.dismissed_at) || previous.created_at !== item.created_at)));
          if (shouldToast) {
            const preview = notificationPreview(item, locale === "en-GB" ? "en" : "nl");
            toast(preview.title, {
              description: preview.description,
              action: { label: text("Bekijken", "View"), onClick: () => setOpen(true) },
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [locale, queryClient, text, userId]);
  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error || !data)
        throw (
          error ??
          new Error(
            text("Melding kon niet worden verwijderd.", "Notification could not be dismissed."),
          )
        );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () =>
      toast.error(
        text(
          "Melding kon niet worden weggeklikt. Probeer het opnieuw.",
          "The notification could not be dismissed. Please try again.",
        ),
      ),
  });
  const respondInvitation = useMutation({
    mutationFn: async ({
      notificationId,
      invitationId,
      response,
      agency,
    }: {
      notificationId: string;
      invitationId: string;
      response: "accept" | "decline";
      agency?: boolean;
    }) => {
      const result = agency
        ? await respondToAgencyInvitation({ data: { invitationId, response } })
        : await respondToTripInvitation({ data: { invitationId, response } });
      if (!["accepted", "already_member", "declined"].includes(result.status))
        throw new Error(result.status);
      const { error } = await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw error;
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(
        result.status === "declined"
          ? text("Uitnodiging geweigerd.", "Invitation declined.")
          : result.status === "already_member"
            ? text("Je neemt al deel aan deze reis.", "You already participate in this trip.")
            : text("Uitnodiging geaccepteerd.", "Invitation accepted."),
      );
      if (result.status !== "declined") window.location.assign("/dashboard");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("rpc-unavailable")
          ? text(
              "De uitnodigingsfunctie is nog niet beschikbaar in de database-API. Probeer het over een minuut opnieuw.",
              "The invitation function is not available in the database API yet. Try again in a minute.",
            )
          : message.includes("membership-conflict")
            ? text(
                "Dit account heeft al een conflicterende deelname. Open de uitnodigingslink voor meer informatie.",
                "This account already has a conflicting membership. Open the invitation link for more information.",
              )
            : text(
                "De uitnodiging kon niet worden verwerkt. Foutreferentie: invitation-response.",
                "The invitation could not be processed. Error reference: invitation-response.",
              ),
      );
    },
  });
  const count = notifications.data?.count ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11 sm:size-9"
          aria-label={`${text("Meldingen", "Notifications")}${count ? `: ${count} ${text("openstaand", "open")}` : ""}`}
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span
              className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
        aria-label={text("Meldingenpaneel", "Notifications panel")}
      >
        <div className="border-b p-4">
          <h2 className="font-semibold">
            {text("Meldingen", "Notifications")}
            {count > 0 ? ` (${count})` : ""}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {text(
              "Meldingen blijven staan totdat je ze met het kruisje wegklikt.",
              "Notifications remain here until you dismiss them.",
            )}
          </p>
        </div>
        <PushNotificationControl />
        <div
          className="max-h-[min(65dvh,32rem)] space-y-2 overflow-y-auto p-3"
          aria-busy={notifications.isPending}
        >
          {notifications.isPending && (
            <p role="status" className="p-3 text-sm text-muted-foreground">
              {text("Meldingen laden...", "Loading notifications...")}
            </p>
          )}
          {notifications.isError && (
            <div role="alert" className="space-y-2 p-3 text-sm">
              <p>
                {text(
                  "Meldingen zijn tijdelijk niet beschikbaar.",
                  "Notifications are temporarily unavailable.",
                )}
              </p>
              <Button size="sm" variant="outline" onClick={() => void notifications.refetch()}>
                {text("Opnieuw proberen", "Try again")}
              </Button>
            </div>
          )}
          {notifications.isSuccess && count === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              {text("Je hebt geen openstaande meldingen.", "You have no open notifications.")}
            </p>
          )}
          {notifications.data?.items.map((notification) => {
            const style = styles[notification.kind as keyof typeof styles] ?? styles.account;
            const storedLink = (notification as typeof notification & { link?: string | null })
              .link;
            const notificationLink =
              typeof storedLink === "string" &&
              storedLink.startsWith("/") &&
              !storedLink.startsWith("//")
                ? storedLink
                : null;
            const localizedPreview = notificationPreview(
              notification,
              locale === "en-GB" ? "en" : "nl",
            );
            const responseMatch = notification.event_key.match(
              /^invitation-response:(accepted|declined):/,
            );
            const responseParts = responseMatch ? notification.body.split("|") : [];
            const responseAccepted = responseMatch?.[1] === "accepted";
            const feedbackParts =
              notification.kind === "feedback" ? notification.body.split("|") : [];
            const platformParts =
              notification.kind === "platform" ? notification.body.split("|") : [];
            const quoteParts =
              notification.kind === "agency_quote" ? notification.body.split("|") : [];
            const accessParts =
              notification.kind === "agency_access" ? notification.body.split("|") : [];
            const taskParts =
              notification.kind === "agency_task" ? notification.body.split("|") : [];
            const documentParts =
              notification.kind === "trip_document" ? notification.body.split("|") : [];
            const clientParts =
              notification.kind === "agency_client" ? notification.body.split("|") : [];
            const tripAccessParts =
              notification.kind === "trip_access" ? notification.body.split("|") : [];
            const importantTripParts =
              notification.kind === "trip_change" &&
              notification.event_key.startsWith("trip-important:")
                ? notification.body.split("|")
                : [];
            const tripContentParts =
              notification.kind === "trip_booking" || notification.kind === "trip_expense"
                ? notification.body.split("|")
                : [];
            const accountParts =
              notification.kind === "account" ? notification.body.split("|") : [];
            const settlementParts =
              notification.kind === "trip_settlement" ? notification.body.split("|") : [];
            const isTripInvitation =
              notification.kind === "invitation" &&
              notification.event_key.startsWith("invitation:");
            const isAgencyInvitation =
              notification.kind === "invitation" &&
              notification.event_key.startsWith("workspace-invitation:");
            const invitationTripName = notification.body.startsWith("trip|")
              ? notification.body.slice(5)
              : notification.body.replace(/^Je bent uitgenodigd voor\s+/i, "").replace(/\.$/, "");
            const invitationAgencyName = notification.body.startsWith("agency|")
              ? notification.body.slice(7)
              : notification.body
                  .replace(/^Je bent uitgenodigd voor het team van\s+/i, "")
                  .replace(/\.$/, "");
            const accessRole =
              accessParts[2] === "finance"
                ? text("financieel medewerker", "finance member")
                : text("adviseur", "adviser");
            const feedbackStatus = (
              {
                reviewing: text("Wordt bekeken", "Under review"),
                planned: text("Gepland", "Planned"),
                resolved: text("Opgelost", "Resolved"),
                closed: text("Gesloten", "Closed"),
                new: text("Ontvangen", "Received"),
              } as Record<string, string>
            )[feedbackParts[0] ?? ""];
            const contentAction = (
              {
                added: text("toegevoegd", "added"),
                updated: text("gewijzigd", "updated"),
                removed: text("verwijderd", "removed"),
                multiple: text("meerdere wijzigingen", "multiple changes"),
              } as Record<string, string>
            )[tripContentParts[0] ?? ""];
            const notificationTitle = isTripInvitation
              ? text("Reisuitnodiging", "Trip invitation")
              : isAgencyInvitation
                ? text("Agency-uitnodiging", "Agency invitation")
                : notification.kind === "account" && accountParts[0] === "access"
                  ? accountParts[1] === "blocked"
                    ? text("Je account is geblokkeerd", "Your account has been blocked")
                    : text("Je account is hersteld", "Your account has been restored")
                  : notification.kind === "account" && accountParts[0] === "export"
                    ? text("Gegevensexport gereed", "Data export ready")
                    : notification.kind === "account" && accountParts[0] === "profile"
                      ? text("Account bijgewerkt", "Account updated")
                      : notification.kind === "account" && accountParts[0] === "plan"
                        ? text("Abonnement gewijzigd", "Subscription changed")
                        : settlementParts.length
                          ? settlementParts[0] === "completed"
                            ? text("Verrekening afgerond", "Settlement completed")
                            : text("Betaalverzoek", "Payment request")
                          : tripContentParts.length
                            ? notification.kind === "trip_expense"
                              ? text("Reisuitgaven gewijzigd", "Trip expenses changed")
                              : text("Boekingen gewijzigd", "Bookings changed")
                            : importantTripParts.length
                              ? importantTripParts[0] === "destinations"
                                ? text("Bestemmingen gewijzigd", "Destinations changed")
                                : text(
                                    "Belangrijke reisinstellingen gewijzigd",
                                    "Important trip settings changed",
                                  )
                              : notification.kind === "trip_access"
                                ? tripAccessParts[0] === "revoked"
                                  ? text("Reisuitnodiging ingetrokken", "Trip invitation revoked")
                                  : tripAccessParts[0] === "role"
                                    ? text("Je reisrol is gewijzigd", "Your trip role changed")
                                    : text(
                                        "Je reistoegang is gewijzigd",
                                        "Your trip access changed",
                                      )
                                : notification.kind === "agency_client"
                                  ? clientParts[0] === "created"
                                    ? text("Klant toegevoegd", "Client added")
                                    : clientParts[0] === "linked"
                                      ? text("Klant aan reis gekoppeld", "Client linked to trip")
                                      : clientParts[0] === "unlinked"
                                        ? text(
                                            "Klant van reis ontkoppeld",
                                            "Client unlinked from trip",
                                          )
                                        : clientParts[0] === "archived"
                                          ? text("Klant gearchiveerd", "Client archived")
                                          : clientParts[0] === "restored"
                                            ? text("Klant hersteld", "Client restored")
                                            : clientParts[0] === "removed"
                                              ? text("Klant verwijderd", "Client removed")
                                              : text("Klant bijgewerkt", "Client updated")
                                  : notification.kind === "trip_document"
                                    ? documentParts[0] === "expires"
                                      ? text(
                                          "Document verloopt binnenkort",
                                          "Document expires soon",
                                        )
                                      : documentParts[0] === "added"
                                        ? text("Reisdocument toegevoegd", "Trip document added")
                                        : documentParts[0] === "removed"
                                          ? text("Reisdocument verwijderd", "Trip document removed")
                                          : documentParts[0] === "expiry"
                                            ? text("Vervaldatum gewijzigd", "Expiry date changed")
                                            : text(
                                                "Reisdocument bijgewerkt",
                                                "Trip document updated",
                                              )
                                    : notification.kind === "agency_task"
                                      ? taskParts[0] === "due"
                                        ? text("Deadline nadert", "Deadline approaching")
                                        : taskParts[0] === "assigned"
                                          ? text("Nieuwe taak toegewezen", "New task assigned")
                                          : taskParts[0] === "unassigned"
                                            ? text("Taak overgedragen", "Task reassigned")
                                            : taskParts[0] === "deadline"
                                              ? text("Deadline gewijzigd", "Deadline changed")
                                              : taskParts[0] === "status"
                                                ? text(
                                                    "Taakstatus gewijzigd",
                                                    "Task status changed",
                                                  )
                                                : text("Taak bijgewerkt", "Task updated")
                                      : notification.kind === "agency_access"
                                        ? accessParts[0] === "role"
                                          ? text(
                                              "Je Agency-rol is gewijzigd",
                                              "Your Agency role changed",
                                            )
                                          : accessParts[0] === "member_permissions"
                                            ? text(
                                                "Je persoonlijke rechten zijn gewijzigd",
                                                "Your personal permissions changed",
                                              )
                                            : accessParts[0] === "branding"
                                              ? text(
                                                  "Agency-huisstijl gewijzigd",
                                                  "Agency branding changed",
                                                )
                                              : accessParts[0] === "trip_branding"
                                                ? text(
                                                    "Reishuisstijl gewijzigd",
                                                    "Trip branding changed",
                                                  )
                                                : text(
                                                    "De rechten van je Agency-rol zijn gewijzigd",
                                                    "Your Agency role permissions changed",
                                                  )
                                        : notification.kind === "agency_quote"
                                          ? quoteParts[0] === "expiry"
                                            ? text(
                                                "Offerte verloopt binnenkort",
                                                "Quote expires soon",
                                              )
                                            : quoteParts[0] === "accept"
                                              ? text("Offerte geaccepteerd", "Quote accepted")
                                              : quoteParts[0] === "converted"
                                                ? text("Offerte omgezet", "Quote converted")
                                                : quoteParts[0] === "shared"
                                                  ? text("Offerte gedeeld", "Quote shared")
                                                  : quoteParts[0] === "renewed"
                                                    ? text(
                                                        "Offertelink vernieuwd",
                                                        "Quote link renewed",
                                                      )
                                                    : quoteParts[0] === "revoked"
                                                      ? text(
                                                          "Offertelink ingetrokken",
                                                          "Quote link revoked",
                                                        )
                                                      : text("Offerte afgewezen", "Quote rejected")
                                          : notification.kind === "platform"
                                            ? locale.startsWith("nl")
                                              ? notification.title
                                              : platformParts[2] || notification.title
                                            : notification.kind === "feedback"
                                              ? text("Feedback bijgewerkt", "Feedback updated")
                                              : notification.kind === "membership"
                                                ? text("Uit reis verwijderd", "Removed from trip")
                                                : responseMatch
                                                  ? responseAccepted
                                                    ? text(
                                                        "Uitnodiging geaccepteerd",
                                                        "Invitation accepted",
                                                      )
                                                    : text(
                                                        "Uitnodiging geweigerd",
                                                        "Invitation declined",
                                                      )
                                                  : localizedPreview.title;
            const tripRole =
              (
                {
                  traveler: text("reiziger", "traveller"),
                  viewer: text("lezer", "viewer"),
                  advisor: text("adviseur", "adviser"),
                  finance: text("financieel beheerder", "finance manager"),
                  client: text("klant", "client"),
                } as Record<string, string>
              )[tripAccessParts[2] ?? ""] ?? tripAccessParts[2];
            const importantTripDetails = (importantTripParts[2] ?? "")
              .split(",")
              .filter(Boolean)
              .map(
                (detail) =>
                  ({
                    dates: text("reisdata", "travel dates"),
                    public: text("openbare status", "public visibility"),
                    pin: text("toegangscode", "access code"),
                    financials: text("gedeelde financiën", "shared financials"),
                  })[detail] ?? detail,
              )
              .join(", ");
            const notificationBody = isTripInvitation
              ? text(
                  `Je bent uitgenodigd voor ${invitationTripName}.`,
                  `You have been invited to ${invitationTripName}.`,
                )
              : isAgencyInvitation
                ? text(
                    `Je bent uitgenodigd voor het team van ${invitationAgencyName}.`,
                    `You have been invited to join the team at ${invitationAgencyName}.`,
                  )
                : settlementParts.length
                  ? settlementParts[0] === "completed"
                    ? text(
                        `De verrekening van ${settlementParts[1]} is afgerond.`,
                        `The settlement for ${settlementParts[1]} was completed.`,
                      )
                    : text(
                        `Betaal ${settlementParts[3]} ${settlementParts[4]} aan ${settlementParts[2]} voor ${settlementParts[1]}.`,
                        `Pay ${settlementParts[3]} ${settlementParts[4]} to ${settlementParts[2]} for ${settlementParts[1]}.`,
                      )
                  : notification.kind === "account" && accountParts[0] === "access"
                    ? accountParts[1] === "blocked"
                      ? text(
                          "Je account is door GlobeTrotr geblokkeerd. Neem voor hulp contact op via info@globetrotr.nl.",
                          "Your account has been blocked by GlobeTrotr. Contact info@globetrotr.nl for assistance.",
                        )
                      : text(
                          "Je account is hersteld en je kunt GlobeTrotr weer gebruiken.",
                          "Your account has been restored and you can use GlobeTrotr again.",
                        )
                    : notification.kind === "account" && accountParts[0] === "export"
                      ? text(
                          "Je gegevensexport is veilig aangemaakt en naar dit apparaat gedownload.",
                          "Your data export was created securely and downloaded to this device.",
                        )
                      : notification.kind === "account" && accountParts[0] === "profile"
                        ? text(
                            "Je profielgegevens zijn gewijzigd.",
                            "Your profile details changed.",
                          )
                        : notification.kind === "account" && accountParts[0] === "plan"
                          ? text(
                              `Je huidige abonnement is ${accountParts[1] ?? ""}.`,
                              `Your current subscription is ${accountParts[1] ?? ""}.`,
                            )
                          : tripContentParts.length
                            ? notification.kind === "trip_expense"
                              ? text(
                                  `Uitgaven van ${tripContentParts[1]}: ${contentAction}.`,
                                  `Expenses for ${tripContentParts[1]}: ${contentAction}.`,
                                )
                              : text(
                                  `Boekingen van ${tripContentParts[1]}: ${contentAction}.`,
                                  `Bookings for ${tripContentParts[1]}: ${contentAction}.`,
                                )
                            : importantTripParts.length
                              ? importantTripParts[0] === "destinations"
                                ? text(
                                    `De bestemmingen van ${importantTripParts[1]} zijn gewijzigd.`,
                                    `The destinations for ${importantTripParts[1]} changed.`,
                                  )
                                : text(
                                    `Belangrijke instellingen van ${importantTripParts[1]} zijn gewijzigd${importantTripDetails ? `: ${importantTripDetails}` : ""}.`,
                                    `Important settings for ${importantTripParts[1]} changed${importantTripDetails ? `: ${importantTripDetails}` : ""}.`,
                                  )
                              : notification.kind === "trip_access"
                                ? tripAccessParts[0] === "revoked"
                                  ? text(
                                      `De uitnodiging voor ${tripAccessParts[1]} is ingetrokken.`,
                                      `The invitation for ${tripAccessParts[1]} was revoked.`,
                                    )
                                  : tripAccessParts[0] === "role"
                                    ? text(
                                        `Je bent nu ${tripRole} binnen ${tripAccessParts[1]}.`,
                                        `You are now a ${tripRole} for ${tripAccessParts[1]}.`,
                                      )
                                    : text(
                                        `Je toegang tot ${tripAccessParts[1]} is gewijzigd.`,
                                        `Your access to ${tripAccessParts[1]} changed.`,
                                      )
                                : notification.kind === "agency_client"
                                  ? clientParts[2]
                                    ? text(
                                        `${clientParts[1]} · reis: ${clientParts[2]}`,
                                        `${clientParts[1]} · trip: ${clientParts[2]}`,
                                      )
                                    : clientParts[1]
                                  : notification.kind === "trip_document"
                                    ? `${documentParts[1]}${documentParts[2] ? ` · ${text("vervalt op", "expires on")} ${documentParts[2]}` : ""}`
                                    : notification.kind === "agency_task"
                                      ? taskParts[0] === "unassigned"
                                        ? text(
                                            `${taskParts[1]} is niet meer aan jou toegewezen.`,
                                            `${taskParts[1]} is no longer assigned to you.`,
                                          )
                                        : text(
                                            `${taskParts[1]}${taskParts[2] ? ` · ${text("deadline", "deadline")}: ${taskParts[2]}` : ""}`,
                                            `${taskParts[1]}${taskParts[2] ? ` · deadline: ${taskParts[2]}` : ""}`,
                                          )
                                      : notification.kind === "agency_access"
                                        ? accessParts[0] === "role"
                                          ? text(
                                              `Je bent nu ${accessRole} binnen ${accessParts[1]}.`,
                                              `You are now a ${accessRole} within ${accessParts[1]}.`,
                                            )
                                          : accessParts[0] === "branding"
                                            ? text(
                                                `De huisstijl van ${accessParts[1]} is bijgewerkt.`,
                                                `The branding of ${accessParts[1]} was updated.`,
                                              )
                                            : accessParts[0] === "trip_branding"
                                              ? text(
                                                  `De huisstijl van ${accessParts[2]} binnen ${accessParts[1]} is bijgewerkt.`,
                                                  `The branding of ${accessParts[2]} within ${accessParts[1]} was updated.`,
                                                )
                                              : text(
                                                  `Je toegang binnen ${accessParts[1]} is bijgewerkt.`,
                                                  `Your access within ${accessParts[1]} has been updated.`,
                                                )
                                        : notification.kind === "agency_quote"
                                          ? quoteParts[0] === "expiry"
                                            ? text(
                                                `${quoteParts[1]} is geldig tot ${quoteParts[2]}.`,
                                                `${quoteParts[1]} is valid until ${quoteParts[2]}.`,
                                              )
                                            : quoteParts[0] === "accept"
                                              ? text(
                                                  `${quoteParts[1]} accepteerde ${quoteParts[3]} voor ${quoteParts[2]}.`,
                                                  `${quoteParts[1]} accepted ${quoteParts[3]} for ${quoteParts[2]}.`,
                                                )
                                              : quoteParts[0] === "converted"
                                                ? text(
                                                    `${quoteParts[2]} voor ${quoteParts[1]} is omgezet naar ${quoteParts[3]}.`,
                                                    `${quoteParts[2]} for ${quoteParts[1]} was converted into ${quoteParts[3]}.`,
                                                  )
                                                : quoteParts[0] === "shared"
                                                  ? text(
                                                      `${quoteParts[2]} voor ${quoteParts[1]} is gedeeld.`,
                                                      `${quoteParts[2]} for ${quoteParts[1]} was shared.`,
                                                    )
                                                  : quoteParts[0] === "renewed"
                                                    ? text(
                                                        `De klantlink voor ${quoteParts[2]} is vernieuwd.`,
                                                        `The client link for ${quoteParts[2]} was renewed.`,
                                                      )
                                                    : quoteParts[0] === "revoked"
                                                      ? text(
                                                          `De klantlink voor ${quoteParts[2]} is ingetrokken.`,
                                                          `The client link for ${quoteParts[2]} was revoked.`,
                                                        )
                                                      : text(
                                                          `${quoteParts[1]} wees ${quoteParts[2]} af.`,
                                                          `${quoteParts[1]} rejected ${quoteParts[2]}.`,
                                                        )
                                          : notification.kind === "platform"
                                            ? locale.startsWith("nl")
                                              ? platformParts[3] || notification.body
                                              : platformParts[4] || notification.body
                                            : notification.kind === "feedback"
                                              ? text(
                                                  `Status: ${feedbackStatus}. ${feedbackParts.slice(1).join("|")}`,
                                                  `Status: ${feedbackStatus}. ${feedbackParts.slice(1).join("|")}`,
                                                )
                                              : notification.kind === "membership"
                                                ? text(
                                                    `Je bent verwijderd uit ${notification.body}.`,
                                                    `You have been removed from ${notification.body}.`,
                                                  )
                                                : responseMatch
                                                  ? responseAccepted
                                                    ? text(
                                                        `${responseParts[0]} neemt nu deel aan ${responseParts.slice(1).join("|")}.`,
                                                        `${responseParts[0]} has joined ${responseParts.slice(1).join("|")}.`,
                                                      )
                                                    : text(
                                                        `${responseParts[0]} heeft de uitnodiging voor ${responseParts.slice(1).join("|")} geweigerd.`,
                                                        `${responseParts[0]} declined the invitation for ${responseParts.slice(1).join("|")}.`,
                                                      )
                                                  : localizedPreview.description;
            const invitationId =
              notification.kind === "invitation" && notification.event_key.startsWith("invitation:")
                ? notification.event_key.slice("invitation:".length)
                : "";
            const agencyInvitationId =
              notification.kind === "invitation" &&
              notification.event_key.startsWith("workspace-invitation:")
                ? notification.event_key.slice("workspace-invitation:".length)
                : "";
            return (
              <article key={notification.id} className={`rounded-xl border p-3 ${style.color}`}>
                <div className="flex items-start gap-2">
                  <span className="text-xl" aria-hidden="true">
                    {style.emoji}
                  </span>
                  <div className="min-w-0 flex-1 break-words">
                    <p className="text-xs font-medium">
                      {text(
                        style.label,
                        notification.kind === "account"
                          ? "Account"
                          : notification.kind === "trip_change"
                            ? "Trip change"
                            : notification.kind === "invitation"
                              ? "Invitation"
                              : notification.kind === "membership"
                                ? "Trip membership"
                                : notification.kind === "feedback"
                                  ? "Feedback"
                                  : notification.kind === "agency_quote"
                                    ? "Quote"
                                    : notification.kind === "agency_access"
                                      ? "Agency access"
                                      : notification.kind === "agency_task"
                                        ? "Agency task"
                                        : notification.kind === "trip_document"
                                          ? "Trip document"
                                          : notification.kind === "agency_client"
                                            ? "Agency client"
                                            : notification.kind === "trip_access"
                                              ? "Trip access"
                                              : notification.kind === "trip_booking"
                                                ? "Booking"
                                                : notification.kind === "trip_expense"
                                                  ? "Expense"
                                                  : notification.kind === "trip_settlement"
                                                    ? "Settlement"
                                                    : "GlobeTrotr",
                      )}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{notificationTitle}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{notificationBody}</p>
                    <time
                      dateTime={notification.created_at}
                      className="mt-2 block text-xs opacity-75"
                    >
                      {new Date(notification.created_at).toLocaleString(locale, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {notificationLink && (
                      <a
                        href={notificationLink}
                        className="mt-2 inline-block text-xs font-medium underline"
                        onClick={() => setOpen(false)}
                      >
                        {text("Open bestemming", "Open destination")}
                      </a>
                    )}
                    {!notificationLink && notification.kind === "account" && (
                      <Link
                        to="/account"
                        className="mt-2 inline-block text-xs font-medium underline"
                        onClick={() => setOpen(false)}
                      >
                        {text("Naar account", "View account")}
                      </Link>
                    )}
                    {!notificationLink &&
                      (notification.kind === "trip_change" ||
                        notification.kind === "trip_booking" ||
                        notification.kind === "trip_expense" ||
                        notification.kind === "trip_settlement" ||
                        (notification.kind === "trip_access" &&
                          tripAccessParts[0] !== "revoked")) &&
                      notification.trip_uuid && (
                        <Link
                          to="/trips/$tripId"
                          params={{ tripId: notification.trip_uuid }}
                          className="mt-2 inline-block text-xs font-medium underline"
                          onClick={() => setOpen(false)}
                        >
                          {text("Bekijk reis", "View trip")}
                        </Link>
                      )}
                    {!notificationLink && responseMatch && notification.trip_uuid && (
                      <Link
                        to="/trips/$tripId"
                        params={{ tripId: notification.trip_uuid }}
                        className="mt-2 inline-block text-xs font-medium underline"
                        onClick={() => setOpen(false)}
                      >
                        {text("Bekijk reisgenoten", "View travellers")}
                      </Link>
                    )}
                    {(invitationId || agencyInvitationId) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={respondInvitation.isPending}
                          onClick={() =>
                            respondInvitation.mutate({
                              notificationId: notification.id,
                              invitationId: invitationId || agencyInvitationId,
                              response: "accept",
                              agency: Boolean(agencyInvitationId),
                            })
                          }
                        >
                          <Check className="size-4" />
                          {text("Accepteren", "Accept")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respondInvitation.isPending}
                          onClick={() =>
                            respondInvitation.mutate({
                              notificationId: notification.id,
                              invitationId: invitationId || agencyInvitationId,
                              response: "decline",
                              agency: Boolean(agencyInvitationId),
                            })
                          }
                        >
                          <X className="size-4" />
                          {text("Weigeren", "Decline")}
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 text-inherit hover:bg-black/10 hover:text-inherit dark:hover:bg-white/10"
                    aria-label={`${text("Melding wegklikken", "Dismiss notification")}: ${notification.title}`}
                    disabled={dismiss.isPending}
                    onClick={() => dismiss.mutate(notification.id)}
                  >
                    {dismiss.isPending && dismiss.variables === notification.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
          {count > 50 && (
            <p className="p-2 text-xs text-muted-foreground">
              {text(
                "De nieuwste 50 meldingen worden getoond. Klik meldingen weg om oudere te zien.",
                "The latest 50 notifications are shown. Dismiss notifications to see older ones.",
              )}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
