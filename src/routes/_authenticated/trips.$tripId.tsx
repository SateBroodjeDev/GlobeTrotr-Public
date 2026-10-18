import { tripSection } from "@/lib/trip-section";
import { DeleteTripButton } from "@/components/DeleteTripButton";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Backpack,
  BarChart3,
  BookOpen,
  BookHeart,
  Calculator,
  CalendarDays,
  Compass,
  Copy,
  FileDown,
  Download,
  FileText,
  FolderLock,
  Globe2,
  Paperclip,
  ImagePlus,
  Mail,
  Map,
  Menu,
  Pencil,
  Plus,
  Route as RouteIcon,
  Scale,
  Settings2,
  Share2,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { canManageTripMoney, canPlanTrip, hasFeature, ownsTrip } from "@/lib/plans";
import { resolveTripCapability } from "@/lib/agency-permissions";
import {
  CATEGORIES,
  isRoutePlanningItem,
  TEMPLATES,
  tripStatus,
  type Expense,
  type ExpenseCategory,
  type Trip,
  type TravelItem,
  type ItineraryItem,
} from "@/lib/types";
import { CURRENCIES, convert, formatMoney } from "@/lib/services";
import type { GeoResult } from "@/lib/services";
import { downloadCsv, downloadJson, downloadTripGpx, openGuide, openPdf } from "@/lib/exporters";
import { TripCalendarExport } from "@/components/TripCalendarExport";
import { uid } from "@/lib/workspace";
import {
  normalizeExpenseParticipants,
  ownerParticipantId,
  participantName,
  participantsOf,
  resolveParticipantId,
} from "@/lib/settle";
import { PlaceSearch } from "@/components/PlaceSearch";
import { FavoritePlaces } from "@/components/FavoritePlaces";
import { WeatherWidget } from "@/components/WeatherWidget";
import { CurrencyConverter, FuelCalculator } from "@/components/TripTools";
import { Settlement } from "@/components/Settlement";
import { Packing } from "@/components/Packing";
import { Countdown } from "@/components/Countdown";
import { TripBookings } from "@/components/TripBookings";
import { TripMembers } from "@/components/TripMembers";
import { TripTimeline } from "@/components/TripTimeline";
import { TripBrandingSettings } from "@/components/TripBrandingSettings";
import { TripNotificationPreferences } from "@/components/TripNotificationPreferences";
import { TripDocuments } from "@/components/TripDocuments";
import { TripTemplateApply } from "@/components/TripTemplateApply";
import { TripInsights, TripInsightsSummary } from "@/components/TripInsights";
import { TripTasks } from "@/components/TripTasks";
import { TripToday } from "@/components/TripToday";
import { TripOfflinePack } from "@/components/TripOfflinePack";
import { mergeOfflineExpenses } from "@/lib/offline-trip";
import { TripCover } from "@/components/TripCover";
import { TripOptions } from "@/components/TripOptions";
import { HotelGapFinder } from "@/components/HotelGapFinder";
import { findTripHotelGaps } from "@/lib/hotel-gaps";
import { NearbyPlaces } from "@/components/NearbyPlaces";
import { TripBookingMail } from "@/components/TripBookingMail";
import { bookingMailTravelItem } from "@/lib/booking-mail";
import { TripGpxImport } from "@/components/TripGpxImport";
import { TripDateShift } from "@/components/TripDateShift";
import { TripRouteOptimizer } from "@/components/TripRouteOptimizer";
import { TripRouteLegModes } from "@/components/TripRouteLegModes";
import { bookingMapGrouping, routePlaceName, tripRouteStops, pruneRoutePlan } from "@/lib/route-map";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale";
import { localizeCountry } from "@/lib/localized-values";
import { TRIP_DESCRIPTION_MAX_LENGTH, TRIP_NAME_MAX_LENGTH } from "@/lib/trip-limits";
import { buildTripDuplicate, duplicateTripName } from "@/lib/duplicate-trip";
import { resolveBranding } from "@/lib/branding";
import { getMyAgencyAccess } from "@/lib/agency.functions";
import { getPublicTripShareDetails } from "@/lib/public-trip-follow.functions";
import {
  fuelEstimateFor,
  fuelTravelItemIdForExpense,
  linkFuelExpense,
  remainingFuelEstimate,
} from "@/lib/fuel-costs";

const TripMap = lazy(() => import("@/components/TripMap"));

type TripSettingsDraft = {
  name: string;
  description: string;
  start: string;
  end: string;
  budget: string;
  template: Trip["template"];
};

function settingsFromTrip(trip: Trip): TripSettingsDraft {
  return {
    name: trip.name,
    description: trip.description ?? "",
    start: trip.start,
    end: trip.end,
    budget: String(trip.budget),
    template: trip.template,
  };
}

function secondaryTripSectionLabel(value: string, text: (nl: string, en: string) => string) {
  const labels: Record<string, [string, string]> = {
    discover: ["Ontdekken", "Discover"],
    "plan-edit": ["Boekingen beheren", "Manage bookings"],
    options: ["Reisvergelijker", "Trip comparison"],
    "booking-mail": ["Boekingsmail", "Booking email"],
    packing: ["Paklijsten", "Packing lists"],
    documents: ["Documenten", "Documents"],
    money: ["Geld-tools", "Money tools"],
    insights: ["Reisstatistieken", "Trip insights"],
    settings: ["Reisinstellingen", "Trip settings"],
  };
  const label = labels[value];
  return label ? text(label[0], label[1]) : null;
}

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  validateSearch: (search: Record<string, unknown>): { section?: string } => ({ section: tripSection(search.section) }),
  head: () => ({
    meta: [
      { title: "Reisdetail — GlobeTrotr" },
      {
        name: "description",
        content: "Routekaart, dagplanning en multi-valuta uitgaven van deze reis.",
      },
      { property: "og:title", content: "Reisdetail — GlobeTrotr" },
      {
        property: "og:description",
        content: "Routekaart, dagplanning en multi-valuta uitgaven van deze reis.",
      },
    ],
  }),
  component: TripDetail,
  notFoundComponent: () => (
    <p className="text-sm text-muted-foreground">
      Reis niet gevonden.{" "}
      <Link to="/dashboard" className="underline">
        Terug naar overzicht
      </Link>
    </p>
  ),
});

function TripDetail() {
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const { tripId } = Route.useParams();
  const { state, addTrip, saveTripNow, removeTrip, rates, ratesLive } = useWorkspace();
  const navigate = useNavigate();
  const found = state.trips.find((t) => t.id === tripId);
  if (!found) throw notFound();
  const trip = found;
  const hotelGaps = findTripHotelGaps(trip);
  const missingHotelNights = hotelGaps.reduce((sum, gap) => sum + gap.nights, 0);
  const tripIsCurrent = tripStatus(trip) === "current";
  const { section } = Route.useSearch();
  const activeTab = section || (tripIsCurrent ? "today" : "route");
  const setActiveTab = (value: string) => {
    void navigate({
      to: "/trips/$tripId",
      params: { tripId },
      search: (previous) => ({ ...previous, section: tripSection(value) }),
      replace: true,
      resetScroll: false,
    });
  };

  const base = state.baseCurrency;
  const { user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["profile-owner-name", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.display_name as string | null | undefined;
    },
  });
  const currentAccountName =
    profileQuery.data?.trim() ||
    String(user?.user_metadata.full_name ?? user?.email?.split("@")[0] ?? "Jij");
  const accessRole = trip.accessRole ?? "owner";
  const agencyAccessQuery = useQuery({
    queryKey: ["trip-agency-access", user?.id, trip.id],
    enabled: Boolean(user && state.plan === "agency" && accessRole !== "owner"),
    queryFn: () => getMyAgencyAccess(),
    retry: false,
  });
  const agencyPermissions = agencyAccessQuery.data?.permissions;
  const agencyAccessPending = agencyAccessQuery.isLoading && accessRole !== "owner";
  const [sharingSaving, setSharingSaving] = useState(false);
  const publicShareQuery = useQuery({
    queryKey: ["public-trip-share-details", user?.id, trip.id, trip.public],
    enabled: Boolean(user && trip.public && !trip.archived && !sharingSaving),
    queryFn: () => getPublicTripShareDetails({ data: { tripId: trip.id } }),
    retry: false,
  });
  const publicShare = publicShareQuery.data?.public ? publicShareQuery.data : null;
  const mayManageMembers =
    accessRole === "owner" ||
    resolveTripCapability(agencyAccessPending, agencyPermissions, "members_manage", false);
  const ownerName = accessRole === "owner" ? currentAccountName : text("Eigenaar", "Owner");
  const ownerParticipant = {
    id: ownerParticipantId(trip.ownerId ?? (accessRole === "owner" ? user?.id : undefined)),
    name: ownerName,
  };
  const financialParticipants = participantsOf(trip, ownerParticipant);
  const editable = resolveTripCapability(
    agencyAccessPending,
    agencyPermissions,
    "trips_plan",
    canPlanTrip(accessRole),
  );
  const moneyEditable = resolveTripCapability(
    agencyAccessPending,
    agencyPermissions,
    "expenses_manage",
    canManageTripMoney(accessRole),
  );
  const tripOwner = ownsTrip(accessRole);
  const settingsEditable =
    tripOwner ||
    resolveTripCapability(agencyAccessPending, agencyPermissions, "trip_settings_manage", false);
  const [exportBrandingOverride, setExportBrandingOverride] = useState(trip.branding);
  const exportBranding = resolveBranding(state.plan, null, state.branding, exportBrandingOverride);
  const [editingBooking, setEditingBooking] = useState<TravelItem | null>(null);
  async function updateItineraryItem(item: ItineraryItem) {
    if (!editable) return;
    try {
      await saveTripNow(trip.id, (current) => ({
        ...current,
        itinerary: current.itinerary
          .map((existing) =>
            existing.id === item.id
              ? { ...existing, day: item.day, title: item.title, notes: item.notes ?? "" }
              : existing,
          )
          .sort((a, b) => a.day.localeCompare(b.day)),
      }));
      toast.success(text("Programma-item gewijzigd.", "Itinerary item updated."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text(
              "Programma-item kon niet worden gewijzigd.",
              "Itinerary item could not be updated.",
            ),
      );
      throw error;
    }
  }
  async function addItineraryItem(item: Omit<ItineraryItem, "id">) {
    try {
      await saveTripNow(trip.id, (current) => ({
        ...current,
        itinerary: [...current.itinerary, { id: uid(), ...item }].sort((a, b) => a.day.localeCompare(b.day)),
      }));
      toast.success(text("Programma-item opgeslagen.", "Itinerary item saved."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text("Programma-item kon niet worden opgeslagen.", "Itinerary item could not be saved."));
      throw error;
    }
  }
  async function removeItineraryItem(id: string) {
    try {
      await saveTripNow(trip.id, (current) => ({
        ...current,
        itinerary: current.itinerary.filter((item) => item.id !== id),
      }));
      toast.success(text("Programma-item verwijderd.", "Itinerary item deleted."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text("Programma-item kon niet worden verwijderd.", "Itinerary item could not be deleted."));
      throw error;
    }
  }
  const canMarkBillable = moneyEditable && hasFeature(state.plan, "billable_expenses");
  const canManageReceipts = moneyEditable && hasFeature(state.plan, "receipts");
  const spent = trip.expenses.reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0);
  const billable = trip.expenses
    .filter((e) => e.billable)
    .reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0);
  const fuelTravelItems = (trip.travelItems ?? []).filter(
    (travelItem) => travelItem.type === "transport" && fuelEstimateFor(travelItem) > 0,
  );
  const estimatedFuel = remainingFuelEstimate(trip.travelItems ?? [], trip.expenses, base, rates);

  const [draft, setDraft] = useState<Omit<Expense, "id">>({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    category: "food",
    amount: 0,
    currency: "EUR",
    paidBy: ownerParticipant.id,
    billable: false,
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string>();
  const [fuelTravelItemId, setFuelTravelItemId] = useState<string>();
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<"all" | ExpenseCategory>(
    "all",
  );
  const [expensePayerFilter, setExpensePayerFilter] = useState("all");
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string>();
  const [sharePin, setSharePin] = useState("");
  const [settings, setSettings] = useState<TripSettingsDraft>(() => settingsFromTrip(trip));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantSaving, setVariantSaving] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);
  const [pendingStop, setPendingStop] = useState<GeoResult>();
  const [pendingStopOvernight, setPendingStopOvernight] = useState(false);
  const [pendingStopArrival, setPendingStopArrival] = useState("");
  const [pendingStopNights, setPendingStopNights] = useState("1");
  const [pendingStopIndex, setPendingStopIndex] = useState(trip.stops.length);
  const [pendingStopSaving, setPendingStopSaving] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [activeStopId, setActiveStopId] = useState<string>();
  const routeStops = tripRouteStops(trip);
  const visibleStops = showAllStops ? routeStops : routeStops.slice(0, 4);
  const visibleExpenses = trip.expenses.filter(
    (expense) =>
      (expenseCategoryFilter === "all" || expense.category === expenseCategoryFilter) &&
      (expensePayerFilter === "all" ||
        resolveParticipantId(expense.paidBy, financialParticipants) === expensePayerFilter) &&
      (!expenseSearch.trim() ||
        `${expense.title} ${expense.notes ?? ""}`
          .toLocaleLowerCase(locale)
          .includes(expenseSearch.trim().toLocaleLowerCase(locale))),
  );
  const selectStop = useCallback((id: string) => setActiveStopId(id), []);

  useEffect(() => {
    setSettings(settingsFromTrip(trip));
    // Reset only when fields used by settingsFromTrip change, not on unrelated trip edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, trip.name, trip.description, trip.start, trip.end, trip.budget, trip.template]);

  async function saveTripSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsEditable) return;
    const name = settings.name.trim();
    const budget = Number(settings.budget);
    if (!name) {
      toast.error(text("Een reisnaam is verplicht.", "A trip name is required."));
      return;
    }
    if (name.length > TRIP_NAME_MAX_LENGTH) {
      toast.error(
        text(
          `De reisnaam mag maximaal ${TRIP_NAME_MAX_LENGTH} tekens bevatten.`,
          `The trip name can contain up to ${TRIP_NAME_MAX_LENGTH} characters.`,
        ),
      );
      return;
    }
    if (settings.description.trim().length > TRIP_DESCRIPTION_MAX_LENGTH) {
      toast.error(
        text(
          `De reisomschrijving mag maximaal ${TRIP_DESCRIPTION_MAX_LENGTH} tekens bevatten.`,
          `The trip description can contain up to ${TRIP_DESCRIPTION_MAX_LENGTH} characters.`,
        ),
      );
      return;
    }
    if (!settings.start || !settings.end) {
      toast.error(text("Vul een start- en einddatum in.", "Enter a start and end date."));
      return;
    }
    if (settings.end < settings.start) {
      toast.error(
        text(
          "De einddatum kan niet vóór de startdatum liggen.",
          "The end date cannot be before the start date.",
        ),
      );
      return;
    }
    if (!settings.budget.trim() || !Number.isFinite(budget) || budget < 0) {
      toast.error(text("Vul een budget van nul of hoger in.", "Enter a budget of zero or more."));
      return;
    }

    setSettingsSaving(true);
    try {
      await saveTripNow(trip.id, (current) => ({
        ...current,
        name,
        description: settings.description.trim() || undefined,
        start: settings.start,
        end: settings.end,
        budget,
        template: settings.template,
      }));
      setSettings((current) => ({ ...current, name, budget: String(budget) }));
      toast.success(text("Reisinstellingen opgeslagen.", "Trip settings saved."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text(
              "Reisinstellingen konden niet worden opgeslagen.",
              "Trip settings could not be saved.",
            ),
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveSharing(
    changes: Partial<{
      isPublic: boolean;
      shareFinancials: boolean;
      sharePinHash: string | undefined;
    }>,
    successMessage: string,
  ) {
    if (!settingsEditable) return;
    setSharingSaving(true);
    try {
      await saveTripNow(trip.id, (current) => {
        const updated = {
          ...current,
          public: changes.isPublic ?? current.public ?? false,
          shareFinancials: changes.shareFinancials ?? current.shareFinancials ?? false,
        };
        if (!("sharePinHash" in changes)) return updated;
        if (changes.sharePinHash) return { ...updated, sharePinHash: changes.sharePinHash };
        const { sharePinHash: _sharePinHash, ...withoutPin } = updated;
        return withoutPin;
      });
      // Public state is optimistic. Discard any pre-save lookup only after the
      // server has committed the sharing change; enabling the query then reloads it.
      await queryClient.invalidateQueries({ queryKey: ["public-trip-share-details", user?.id, trip.id] });
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wijziging kon niet worden opgeslagen.");
    } finally {
      setSharingSaving(false);
    }
  }

  async function addExpense() {
    if (!draft.title.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0) {
      toast.error("Vul een omschrijving en bedrag groter dan nul in.");
      return;
    }
    setExpenseSaving(true);
    try {
      const expenseId = editingExpenseId ?? uid();
      await saveTripNow(trip.id, (t) => ({
        ...t,
        expenses: editingExpenseId
          ? t.expenses.map((expense) =>
              expense.id === editingExpenseId
                ? { ...draft, billable: canMarkBillable && draft.billable, id: editingExpenseId }
                : expense,
            )
          : [
              ...t.expenses,
              { ...draft, billable: canMarkBillable && draft.billable, id: expenseId },
            ],
        travelItems: linkFuelExpense(
          editingExpenseId
            ? (t.travelItems ?? []).map((travelItem) =>
                travelItem.expenseId === editingExpenseId
                  ? {
                      ...travelItem,
                      title: draft.title.trim(),
                      date: draft.date,
                      amount: draft.amount,
                      currency: draft.currency,
                    }
                  : travelItem,
              )
            : (t.travelItems ?? []),
          expenseId,
          fuelTravelItemId,
        ),
      }));
      setDraft({ ...draft, title: "", amount: 0, notes: undefined, splitWith: undefined });
      setEditingExpenseId(undefined);
      setFuelTravelItemId(undefined);
      toast.success(
        editingExpenseId
          ? text("Uitgave bijgewerkt", "Expense updated")
          : text("Uitgave geboekt", "Expense added"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Uitgave kon niet worden opgeslagen.", "Expense could not be saved."),
      );
    } finally {
      setExpenseSaving(false);
    }
  }

  async function saveTravelItem(
    item: TravelItem,
    _locations: GeoResult[],
    paidBy: string,
    previousId?: string,
  ) {
    const previous = previousId
      ? (trip.travelItems ?? []).find((current) => current.id === previousId)
      : undefined;
    const expenseId = item.amount ? (previous?.expenseId ?? uid()) : undefined;
    const category: ExpenseCategory =
      item.type === "lodging" ? "lodging" : item.type === "activity" ? "activities" : "transport";
    try {
      await saveTripNow(trip.id, (current) => {
        return pruneRoutePlan({
          ...current,
          travelItems: previousId
            ? (current.travelItems ?? []).map((travelItem) =>
                travelItem.id === previousId ? { ...item, expenseId } : travelItem,
              )
            : [...(current.travelItems ?? []), { ...item, expenseId }],
          itinerary: current.itinerary,
          expenses:
            item.amount && expenseId
              ? [
                  ...current.expenses.filter((expense) => expense.id !== expenseId),
                  {
                    ...current.expenses.find((expense) => expense.id === expenseId),
                    id: expenseId,
                    date: item.date,
                    title: item.title,
                    category,
                    amount: item.amount,
                    currency: item.currency ?? base,
                    paidBy,
                    billable:
                      current.expenses.find((expense) => expense.id === expenseId)?.billable ??
                      false,
                  },
                ]
              : previous?.expenseId
                ? current.expenses.filter((expense) => expense.id !== previous.expenseId)
                : current.expenses,
        });
      });
      toast.success(
        item.amount
          ? previousId
            ? text("Onderdeel en gekoppelde kosten bijgewerkt.", "Item and linked expense updated.")
            : text(
                "Onderdeel, kaartlocatie en kosten opgeslagen.",
                "Item, map location and expense saved.",
              )
          : previousId
            ? text("Reisonderdeel bijgewerkt.", "Travel item updated.")
            : text("Onderdeel en kaartlocatie opgeslagen.", "Item and map location saved."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Reisonderdeel kon niet worden opgeslagen.", "Travel item could not be saved."),
      );
      throw error;
    }
  }

  async function removeTravelItem(id: string) {
    const item = (trip.travelItems ?? []).find((current) => current.id === id);
    try {
      await saveTripNow(trip.id, (current) => pruneRoutePlan({
        ...current,
        travelItems: (current.travelItems ?? []).filter((travelItem) => travelItem.id !== id),
        itinerary: current.itinerary.filter(
          (planningItem) =>
            planningItem.sourceTravelItemId !== id &&
            !(planningItem.day === item?.date && planningItem.title === item?.title),
        ),
        expenses: item?.expenseId
          ? current.expenses.filter((expense) => expense.id !== item.expenseId)
          : current.expenses,
      }));
      toast.success(
        item?.expenseId
          ? text("Onderdeel en gekoppelde kosten verwijderd.", "Item and linked expense deleted.")
          : text("Onderdeel verwijderd.", "Item deleted."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Reisonderdeel kon niet worden verwijderd.", "Travel item could not be deleted."),
      );
      throw error;
    }
  }

  async function addStop(location: GeoResult, overnight: boolean, arrive: string, nights: number, position?: number) {
    const stopId = uid();
    setPendingStopSaving(true);
    try {
      await saveTripNow(trip.id, (current) => {
        const stops = [...current.stops];
        const insertAt = Math.max(0, Math.min(position ?? stops.length, stops.length));
        stops.splice(insertAt, 0, {
          id: stopId,
          ...location,
          nights: overnight ? nights : 0,
          ...(overnight ? { arrive } : {}),
        });
        return pruneRoutePlan({ ...current, stops });
      });
      setActiveStopId(stopId);
      setPendingStop(undefined);
      toast.success(text(`${location.name} toegevoegd.`, `${location.name} added.`));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Bestemming kon niet worden opgeslagen.", "Destination could not be saved."),
      );
      return false;
    } finally {
      setPendingStopSaving(false);
    }
  }

  async function removeStop(stopId: string) {
    if (
      !window.confirm(
        text(
          "Deze bestemming van de routekaart verwijderen?",
          "Remove this destination from the route map?",
        ),
      )
    )
      return;
    try {
      await saveTripNow(trip.id, (current) => pruneRoutePlan({
        ...current,
        stops: current.stops.filter((stop) => stop.id !== stopId),
      }));
      if (activeStopId === stopId) setActiveStopId(undefined);
      toast.success(text("Bestemming verwijderd.", "Destination deleted."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Bestemming kon niet worden verwijderd.", "Destination could not be deleted."),
      );
    }
  }

  async function moveStop(stopId: string, direction: -1 | 1) {
    try {
      await saveTripNow(trip.id, (current) => {
        const from = current.stops.findIndex((stop) => stop.id === stopId);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= current.stops.length) return current;
        const stops = [...current.stops];
        const [moved] = stops.splice(from, 1);
        stops.splice(to, 0, moved!);
        return pruneRoutePlan({ ...current, stops });
      });
    } catch {
      toast.error(text("De volgorde kon niet worden aangepast.", "The order could not be changed."));
    }
  }

  async function toggleArchive() {
    if (!settingsEditable) return;
    if (
      !window.confirm(
        trip.archived
          ? text("Deze reis weer actief maken?", "Reactivate this trip?")
          : text("Deze reis archiveren?", "Archive this trip?"),
      )
    ) {
      return;
    }
    try {
      await saveTripNow(trip.id, (current) => ({ ...current, archived: !current.archived }));
      toast.success(
        trip.archived
          ? text("Reis heractiveerd.", "Trip reactivated.")
          : text("Reis gearchiveerd.", "Trip archived."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Reisstatus kon niet worden opgeslagen.", "Trip status could not be saved."),
      );
    }
  }

  function openVariantDialog() {
    setVariantName(duplicateTripName(trip.name, text("variant", "variant"), TRIP_NAME_MAX_LENGTH));
    setVariantOpen(true);
  }

  async function createTripVariant() {
    const name = variantName.trim();
    if (!name || name.length > TRIP_NAME_MAX_LENGTH) {
      toast.error(text(`Gebruik een naam van maximaal ${TRIP_NAME_MAX_LENGTH} tekens.`, `Use a name of no more than ${TRIP_NAME_MAX_LENGTH} characters.`));
      return;
    }
    let newId: string | undefined;
    setVariantSaving(true);
    try {
      newId = await addTrip(name, trip.template);
      await saveTripNow(newId, (created) => ({
        ...buildTripDuplicate(trip, created, () => crypto.randomUUID()),
        name,
      }));
      toast.success(text("Veilige reisvariant aangemaakt.", "Safe trip variant created."));
      setVariantOpen(false);
      navigate({ to: "/trips/$tripId", params: { tripId: newId } });
    } catch (error) {
      if (newId) await removeTrip(newId).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : text("De reisvariant kon niet worden gemaakt.", "The trip variant could not be created."));
    } finally {
      setVariantSaving(false);
    }
  }

  async function removeExpense(expenseId: string) {
    if (
      !window.confirm(
        text(
          "Deze uitgave verwijderen? De koppeling met een eventueel reisonderdeel wordt losgemaakt.",
          "Delete this expense? Any link to a travel item will be removed.",
        ),
      )
    ) {
      return;
    }
    try {
      await saveTripNow(trip.id, (current) => ({
        ...current,
        expenses: current.expenses.filter((expense) => expense.id !== expenseId),
        travelItems: linkFuelExpense(
          (current.travelItems ?? []).map((travelItem) =>
            travelItem.expenseId === expenseId
              ? { ...travelItem, expenseId: undefined, amount: undefined }
              : travelItem,
          ),
          expenseId,
        ),
      }));
      toast.success(text("Uitgave verwijderd.", "Expense deleted."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Uitgave kon niet worden verwijderd.", "Expense could not be deleted."),
      );
    }
  }

  async function uploadReceipt(expense: Expense, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!canManageReceipts) {
      toast.error(
        text(
          "Bonnetjes koppelen is beschikbaar in het Agency-plan.",
          "Attaching receipts is available with the Agency plan.",
        ),
      );
      event.target.value = "";
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error(
        text(
          "Kies een PDF, JPG, PNG of WebP tot 10 MB.",
          "Choose a PDF, JPG, PNG or WebP file up to 10 MB.",
        ),
      );
      event.target.value = "";
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "file";
    const storagePath = `${user.id}/${trip.id}/${expense.id}/${crypto.randomUUID()}.${extension}`;
    setUploadingReceiptId(expense.id);
    try {
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      try {
        await saveTripNow(trip.id, (current) => ({
          ...current,
          expenses: current.expenses.map((item) =>
            item.id === expense.id
              ? { ...item, receiptPath: storagePath, receiptName: file.name }
              : item,
          ),
        }));
      } catch (error) {
        await supabase.storage.from("receipts").remove([storagePath]);
        throw error;
      }
      toast.success(text("Bon gekoppeld aan de uitgave.", "Receipt attached to the expense."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Bon kon niet worden geüpload.", "Receipt could not be uploaded."),
      );
    } finally {
      setUploadingReceiptId(undefined);
      event.target.value = "";
    }
  }

  async function openReceipt(expense: Expense) {
    if (!expense.receiptPath) return;
    if (!canManageReceipts) {
      toast.error(
        text(
          "Bonnetjes bekijken is beschikbaar in het Agency-plan.",
          "Viewing receipts is available with the Agency plan.",
        ),
      );
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(expense.receiptPath, 60 * 5);
      if (error) throw error;
      if (!data?.signedUrl)
        throw new Error(text("Bon kon niet worden geopend.", "Receipt could not be opened."));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Bon kon niet worden geopend.", "Receipt could not be opened."),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:underline">
            ← {text("Alle reizen", "All trips")}
          </Link>
          <h1 className="break-anywhere font-display text-2xl font-semibold">{trip.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{tripStatusLabel(tripStatus(trip), text)}</Badge>
            {trip.start} → {trip.end} · {trip.stops.length}{" "}
            {text(
              trip.stops.length === 1 ? "bestemming" : "bestemmingen",
              trip.stops.length === 1 ? "destination" : "destinations",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/journal" search={{ trip: trip.id }}>
              <BookHeart className="size-4" /> {text("Dagboek", "Journal")}
            </Link>
          </Button>
          <Button type="button" variant={activeTab === "offline" ? "secondary" : "outline"} onClick={() => setActiveTab("offline")}>
            <Download className="size-4" /> {text("Offline", "Offline")}
          </Button>
          <TripCalendarExport trip={trip} paid={state.plan === "pro" || state.plan === "agency"} />
        </div>
      </div>

      {tripStatus(trip) === "upcoming" && (
        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {text("Aftellen tot vertrek", "Countdown to departure")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Countdown date={trip.start} />
          </CardContent>
        </Card>
      )}

      {missingHotelNights > 0 && (
        <button type="button" onClick={() => {
          setActiveTab("discover");
          window.setTimeout(() => document.getElementById("hotelcontrole")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        }} className="flex w-full items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15">
          <span><strong className="block text-amber-800 dark:text-amber-200">{text(`${missingHotelNights} ${missingHotelNights === 1 ? "nacht mist" : "nachten missen"} een verblijf`, `${missingHotelNights} ${missingHotelNights === 1 ? "night has" : "nights have"} no accommodation`)}</strong><span className="mt-1 block text-sm text-muted-foreground">{text("Controleer de nachten onder Ontdekken en zoek daar direct een passend verblijf.","Review the nights under Discover and search for suitable accommodation there.")}</span></span>
          <Compass className="size-5 shrink-0 text-amber-700 dark:text-amber-300" />
        </button>
      )}

      <div
        className={`grid gap-4 ${canMarkBillable || estimatedFuel > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <Stat label={text("Uitgegeven", "Spent")} value={formatMoney(spent, base)} />
        <Stat label="Budget" value={formatMoney(trip.budget, base)} />
        {estimatedFuel > 0 && (
          <Stat
            label={text("Brandstofprognose", "Fuel estimate")}
            value={formatMoney(estimatedFuel, base)}
          />
        )}
        {canMarkBillable && (
          <Stat label={text("Declarabel", "Billable")} value={formatMoney(billable, base)} />
        )}
      </div>
      <Progress value={trip.budget ? Math.min(100, (spent / trip.budget) * 100) : 0} />
      <TripInsightsSummary trip={trip} base={base} rates={rates} text={text} onOpen={() => setActiveTab("insights")} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sticky top-2 z-20 rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <TabsList className="grid h-auto w-full grid-cols-5 bg-transparent p-0">
            <TabsTrigger value="today" className="min-w-0 flex-col gap-1 px-1 py-2 sm:flex-row sm:px-3"><CalendarDays className="size-4"/><span className="text-[11px] sm:text-sm">{text("Vandaag","Today")}</span></TabsTrigger>
            <TabsTrigger value="route" className="min-w-0 flex-col gap-1 px-1 py-2 sm:flex-row sm:px-3"><Map className="size-4"/><span className="text-[11px] sm:text-sm">{text("Route","Route")}</span></TabsTrigger>
            <TabsTrigger value="plan" className="min-w-0 flex-col gap-1 px-1 py-2 sm:flex-row sm:px-3"><RouteIcon className="size-4"/><span className="text-[11px] sm:text-sm">{text("Schema","Schedule")}</span></TabsTrigger>
            <TabsTrigger value="expenses" className="min-w-0 flex-col gap-1 px-1 py-2 sm:flex-row sm:px-3"><WalletCards className="size-4"/><span className="text-[11px] sm:text-sm">{text("Uitgaven","Expenses")}</span></TabsTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" aria-label={text("Meer reisonderdelen openen","Open more trip sections")} variant={["today","route","plan","expenses","offline"].includes(activeTab)?"ghost":"secondary"} className="h-full min-w-0 flex-col gap-1 px-1 py-2 sm:flex-row sm:px-3"><Menu className="size-4"/><span className="max-w-full truncate text-[11px] sm:text-sm">{secondaryTripSectionLabel(activeTab,text)??text("Meer","More")}</span></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>{text("Plannen en ontdekken","Plan and discover")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={()=>setActiveTab("discover")}><Compass/>{text("Ontdekken","Discover")}</DropdownMenuItem>
                {editable&&<DropdownMenuItem onSelect={()=>setActiveTab("plan-edit")}><Pencil/>{text("Boekingen beheren","Manage bookings")}</DropdownMenuItem>}
                <DropdownMenuItem onSelect={()=>setActiveTab("options")}><Scale/>{text("Reisvergelijker","Trip comparison")}</DropdownMenuItem>
                {editable&&<DropdownMenuItem onSelect={()=>setActiveTab("booking-mail")}><Mail/>{text("Boekingsmail","Booking email")}</DropdownMenuItem>}
                <DropdownMenuSeparator/>
                <DropdownMenuLabel>{text("Voorbereiden","Prepare")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={()=>setActiveTab("packing")}><Backpack/>{text("Paklijsten","Packing lists")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={()=>setActiveTab("documents")}><FolderLock/>{text("Documenten","Documents")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={()=>setActiveTab("money")}><Calculator/>{text("Geld-tools","Money tools")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={()=>setActiveTab("insights")}><BarChart3/>{text("Reisstatistieken","Trip insights")}</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuLabel>{text("Beheer","Management")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={()=>setActiveTab("settings")}><Settings2/>{text("Reisinstellingen","Trip settings")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>
          {secondaryTripSectionLabel(activeTab,text)&&<div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground"><span>{text("Geopend onderdeel","Open section")}: <strong className="text-foreground">{secondaryTripSectionLabel(activeTab,text)}</strong></span><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={()=>setActiveTab("today")}>{text("Terug naar Vandaag","Back to Today")}</Button></div>}
        </div>

        <TabsContent value="today" className="space-y-4">
          <TripToday
            trip={trip}
            editable={editable}
            weatherEnabled={hasFeature(state.plan, "weather")}
            text={text}
          />
        </TabsContent>

        <TabsContent value="offline" className="space-y-4">
          <div className="mx-auto max-w-3xl">
            <TripOfflinePack
              trip={trip}
              text={text}
              canManageExpenses={moneyEditable}
              payers={financialParticipants}
              syncExpenses={(expenses) => saveTripNow(trip.id, (current) => ({ ...current, expenses: mergeOfflineExpenses(current.expenses, expenses) }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          <TripOptions
            trip={trip}
            editable={editable}
            base={base}
            rates={rates}
            save={(fn) => saveTripNow(trip.id, fn)}
            text={text}
          />
        </TabsContent>


        {editable && <TabsContent value="booking-mail" className="space-y-4">
          <TripBookingMail tripId={trip.id} text={text} acceptDraft={async (draft) => {
            const item = bookingMailTravelItem(draft, text("Gecontroleerd boekingsmailconcept", "Reviewed booking email draft"));
            await saveTripNow(trip.id, (current) => ({ ...current,
              travelItems: (current.travelItems || []).some((existing) => existing.id === item.id)
                ? current.travelItems : [...(current.travelItems || []), item],
            }));
          }} />
        </TabsContent>}

        <TabsContent value="settings" className="space-y-4">
          <Tabs defaultValue="general">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="general">{text("Algemeen", "General")}</TabsTrigger>
              <TabsTrigger value="exports">{text("Export en import", "Export and import")}</TabsTrigger>
              <TabsTrigger value="notifications">{text("Meldingen", "Notifications")}</TabsTrigger>
              {state.plan === "agency" && (
                <TabsTrigger value="branding">{text("Huisstijl", "Branding")}</TabsTrigger>
              )}
              <TabsTrigger value="sharing">{text("Delen", "Sharing")}</TabsTrigger>
              <TabsTrigger value="members">{text("Reisgenoten", "Travellers")}</TabsTrigger>
              <TabsTrigger value="danger">{text("Beheer", "Management")}</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-4">
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <Card className="surface">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Settings2 className="size-4" /> {text("Reisinstellingen", "Trip settings")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveTripSettings}>
                      <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="text-muted-foreground">
                          {text("Reisnaam", "Trip name")}
                        </span>
                        <Input
                          value={settings.name}
                          maxLength={TRIP_NAME_MAX_LENGTH}
                          disabled={!settingsEditable || settingsSaving}
                          required
                          onChange={(event) =>
                            setSettings((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                        <span className="block text-right text-xs text-muted-foreground">
                          {settings.name.length}/{TRIP_NAME_MAX_LENGTH}
                        </span>
                      </label>
                      <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="text-muted-foreground">
                          {text("Reisomschrijving", "Trip description")}
                        </span>
                        <Textarea
                          value={settings.description}
                          disabled={!settingsEditable || settingsSaving}
                          maxLength={TRIP_DESCRIPTION_MAX_LENGTH}
                          rows={4}
                          placeholder={text(
                            "Vertel kort wat deze reis bijzonder maakt. Deze tekst verschijnt ook op de publieke reispagina.",
                            "Briefly describe what makes this trip special. This text also appears on the public trip page.",
                          )}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                        <span className="block text-right text-xs text-muted-foreground">
                          {settings.description.length}/{TRIP_DESCRIPTION_MAX_LENGTH}
                        </span>
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="text-muted-foreground">
                          {text("Startdatum", "Start date")}
                        </span>
                        <Input
                          type="date"
                          value={settings.start}
                          disabled={!settingsEditable || settingsSaving}
                          required
                          onChange={(event) => {
                            const start = event.target.value;
                            setSettings((current) => ({
                              ...current,
                              start,
                              end: current.end && current.end < start ? start : current.end,
                            }));
                          }}
                        />
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="text-muted-foreground">
                          {text("Einddatum", "End date")}
                        </span>
                        <Input
                          type="date"
                          value={settings.end}
                          min={settings.start || undefined}
                          disabled={!settingsEditable || settingsSaving}
                          required
                          onChange={(event) =>
                            setSettings((current) => ({ ...current, end: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="text-muted-foreground">Budget ({base})</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={settings.budget}
                          disabled={!settingsEditable || settingsSaving}
                          required
                          onChange={(event) =>
                            setSettings((current) => ({ ...current, budget: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="text-muted-foreground">
                          {text("Reistemplate", "Trip template")}
                        </span>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={settings.template}
                          disabled={!settingsEditable || settingsSaving}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              template: event.target.value as Trip["template"],
                            }))
                          }
                        >
                          {TEMPLATES.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.emoji} {template.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-2 flex items-end sm:col-span-2">
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={!settingsEditable || settingsSaving}>
                            {settingsSaving
                              ? text("Opslaan…", "Saving…")
                              : text("Wijzigingen opslaan", "Save changes")}
                          </Button>
                          <TripDateShift
                            trip={trip}
                            disabled={!settingsEditable || settingsSaving}
                            save={(update) => saveTripNow(trip.id, update)}
                            text={text}
                          />
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
                <Card className="surface">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ImagePlus className="size-4" />
                      {text("Uitstraling", "Appearance")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TripCover
                      tripId={trip.id}
                      editable={editable}
                      text={text}
                      onUrlChange={setCoverUrl}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="exports" className="mt-4">
              <Card className="surface">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{text("Bestanden en gegevens", "Files and data")}</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!moneyEditable} onClick={() => { downloadCsv(trip, base, rates, locale); toast.success(text("CSV geëxporteerd", "CSV exported")); }}><FileDown className="size-4" />CSV</Button>
                  <Button variant="outline" onClick={() => { if (downloadTripGpx(trip)) toast.success(text("GPX-route gedownload", "GPX route downloaded")); else toast.error(text("Voeg eerst een bestemming met kaartcoördinaten toe.", "Add a destination with map coordinates first.")); }}><Download className="size-4" />GPX</Button>
                  {editable && <TripGpxImport stops={trip.stops} text={text} onImport={async(points) => { await saveTripNow(trip.id, (current) => ({ ...current, stops: [...current.stops, ...points.map((point) => ({ id: uid(), name: point.name, country: "", lat: point.lat, lon: point.lon, nights: 0 }))] })); }} />}
                  <Button variant="outline" onClick={() => void (async()=>{const{data}=await (supabase as any).from("trip_journal_entries").select("entry_date,title,body,location_name,rating,photo_path,photo_paths,photo_captions").eq("trip_uuid",trip.id).eq("visibility","public").order("entry_date");const journal=await Promise.all((data??[]).map(async(entry:any)=>{const paths=[...new Set([...(entry.photo_paths??[]),...(entry.photo_path?[entry.photo_path]:[])])] as string[];const signed=paths.length?await supabase.storage.from("trip-journal").createSignedUrls(paths,3600):{data:[]};return{...entry,photo_urls:(signed.data??[]).flatMap(item=>item.signedUrl?[item.signedUrl]:[]),photo_captions:paths.map(path=>entry.photo_captions?.[path]??"")}}));openGuide(trip,base,rates,exportBranding,locale,coverUrl,journal);toast.success(text("Reisgids gedownload","Trip guide downloaded"))})()}><BookOpen className="size-4" />{text("Reisgids", "Trip guide")}</Button>
                  <Button disabled={!moneyEditable} onClick={() => { if (!hasFeature(state.plan, "pdf_export")) { toast.error(text("PDF-declaraties zitten in Pro en hoger.", "PDF expense reports are available on Pro and above.")); return; } if (!openPdf(trip, base, rates, exportBranding, locale)) toast.error(text("Sta pop-ups toe om de PDF te genereren.", "Allow pop-ups to generate the PDF.")); }}><FileText className="size-4" />PDF {text("declaratie", "expense report")}</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              <TripNotificationPreferences tripId={trip.id} />
            </TabsContent>

            {state.plan === "agency" && (
              <TabsContent value="branding" className="mt-4 space-y-4">
                <TripTemplateApply
                  trip={trip}
                  editable={editable}
                  save={(fn) => saveTripNow(trip.id, fn)}
                />
                <TripBrandingSettings
                  tripId={trip.id}
                  agencyBranding={state.branding}
                  onSaved={setExportBrandingOverride}
                />
              </TabsContent>
            )}

            <TabsContent value="sharing" className="mt-4">
              <Card className="surface">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe2 className="size-4" /> {text("Openbaar delen", "Public sharing")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ToggleSetting
                    label={text("Reis openbaar maken", "Make trip public")}
                    description={text(
                      "Maak een deelbare reispagina met route en schema, inclusief schemanotities. Verwijder vertrouwelijke informatie voordat je deelt. De reis verschijnt niet automatisch op de homepage.",
                      "Create a shareable trip page with the route and itinerary, including itinerary notes. Remove confidential information before sharing. The trip is not automatically listed on the homepage.",
                    )}
                    checked={trip.public ?? false}
                    disabled={!settingsEditable || sharingSaving}
                    onChange={(checked) =>
                      void saveSharing(
                        { isPublic: checked },
                        checked
                          ? text("Reis is openbaar gemaakt.", "Trip is now public.")
                          : text("Reis is privé gemaakt.", "Trip is now private."),
                      )
                    }
                  />
                  {trip.public && (
                    <>
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                        <p className="font-medium">{text("Deel deze reis", "Share this trip")}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {text(
                            "Iedere actieve reisgenoot kan deze openbare link delen. Ontvangers hebben geen account nodig en kunnen zichzelf aanmelden voor bewuste reisupdates.",
                            "Every active trip member can share this public link. Recipients do not need an account and can subscribe to deliberate travel updates.",
                          )}
                        </p>
                        {trip.archived ? (
                          <p className="mt-3 text-xs text-muted-foreground">{text("Gearchiveerde reizen hebben geen actieve openbare deellink.", "Archived trips do not have an active public share link.")}</p>
                        ) : sharingSaving || publicShareQuery.isFetching ? (
                          <p className="mt-3 text-xs text-muted-foreground">{text("Deellink ophalen…", "Loading share link…")}</p>
                        ) : publicShare ? (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input readOnly value={publicShare.url} aria-label={text("Openbare reislink", "Public trip link")} />
                              <Button type="button" variant="outline" onClick={async()=>{await navigator.clipboard.writeText(publicShare.url);toast.success(text("Reislink gekopieerd.","Trip link copied."));}}><Copy className="size-4"/>{text("Kopiëren","Copy")}</Button>
                              <Button type="button" onClick={async()=>{const share={title:publicShare.name,text:text(`Volg onze reis “${publicShare.name}”.`,`Follow our trip “${publicShare.name}”.`),url:publicShare.url};if(navigator.share){try{await navigator.share(share);}catch{return;}}else{await navigator.clipboard.writeText(publicShare.url);toast.success(text("Reislink gekopieerd.","Trip link copied."));}}}><Share2 className="size-4"/>{text("Delen","Share")}</Button>
                            </div>
                            {publicShare.pinProtected && <p className="text-xs text-amber-700 dark:text-amber-300">{text("Deze reis is met een PIN beveiligd. Deel de PIN apart en alleen met de gewenste ontvangers; GlobeTrotr kan de ingestelde PIN niet terugtonen.","This trip is protected by a PIN. Share the PIN separately and only with intended recipients; GlobeTrotr cannot display the saved PIN.")}</p>}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-destructive">{text("De openbare deellink kon niet worden opgehaald.", "The public share link could not be loaded.")}</p>
                            <Button type="button" variant="outline" onClick={() => void publicShareQuery.refetch()}>{text("Opnieuw proberen", "Try again")}</Button>
                          </div>
                        )}
                      </div>
                      <ToggleSetting
                        label={text("Budget delen", "Share budget")}
                        description={text(
                          "Toon het budget op de openbare reispagina.",
                          "Show the budget on the public trip page.",
                        )}
                        checked={trip.shareFinancials ?? false}
                        disabled={!settingsEditable || sharingSaving}
                        onChange={(checked) =>
                          void saveSharing(
                            { shareFinancials: checked },
                            checked
                              ? "Budget wordt openbaar gedeeld."
                              : "Budget wordt niet meer gedeeld.",
                          )
                        }
                      />
                      <div className="space-y-2">
                        <p className="font-medium">PIN-beveiliging</p>
                        <p className="text-muted-foreground">
                          Beveilig deze openbare reis met een PIN van 6 tot 12 cijfers.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            className="max-w-48"
                            type="password"
                            inputMode="numeric"
                            minLength={6}
                            maxLength={12}
                            value={sharePin}
                            disabled={!settingsEditable || sharingSaving}
                            onChange={(e) => setSharePin(e.target.value.replace(/\D/g, ""))}
                            placeholder={trip.sharePinHash ? "Nieuwe PIN" : "Kies een PIN"}
                          />
                          <Button
                            variant="outline"
                            disabled={!settingsEditable || sharingSaving || sharePin.length < 6}
                            onClick={async () => {
                              const sharePinHash = await hashSharingPin(sharePin);
                              await saveSharing(
                                { sharePinHash },
                                trip.sharePinHash
                                  ? "PIN-beveiliging is gewijzigd."
                                  : "PIN-beveiliging is ingeschakeld.",
                              );
                              setSharePin("");
                            }}
                          >
                            {trip.sharePinHash ? "PIN wijzigen" : "PIN instellen"}
                          </Button>
                          {trip.sharePinHash && (
                            <Button
                              variant="ghost"
                              disabled={!settingsEditable || sharingSaving}
                              onClick={() =>
                                void saveSharing(
                                  { sharePinHash: undefined },
                                  "PIN-beveiliging is verwijderd.",
                                )
                              }
                            >
                              PIN verwijderen
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <TripMembers
                members={trip.members ?? []}
                tripId={trip.id}
                plan={state.plan}
                editable={mayManageMembers}
                ownerName={ownerName}
                ownerEmail={user?.email ?? "Eigenaar van deze reis"}
                onChange={(members) =>
                  saveTripNow(trip.id, (current) => ({
                    ...current,
                    expenses: current.expenses.map((expense) =>
                      normalizeExpenseParticipants(expense, financialParticipants),
                    ),
                    members,
                    travelers: [ownerName, ...members.map((member) => member.name)],
                  }))
                }
              />
            </TabsContent>

            <TabsContent value="danger" className="mt-4">
              <Card className="border-destructive/40 surface">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {text("Reisbeheer en exports", "Trip management and exports")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    {text(
                      "Archiveer de reis of verwijder hem definitief.",
                      "Archive the trip or delete it permanently.",
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!settingsEditable}
                      onClick={() => void toggleArchive()}
                    >
                      <Archive className="size-4" />{" "}
                      {trip.archived
                        ? text("Heractiveren", "Reactivate")
                        : text("Archiveren", "Archive")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!tripOwner}
                      onClick={() => {
                        downloadJson({ trips: [trip] }, trip.name);
                        toast.success(text("Reisback-up gedownload", "Trip backup downloaded"));
                      }}
                    >
                      <Download className="size-4" />{" "}
                      {text("Back-up downloaden", "Download backup")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!tripOwner}
                      onClick={openVariantDialog}
                    >
                      <Copy className="size-4" /> {text("Reisvariant maken", "Create trip variant")}
                    </Button>
                    <DeleteTripButton
                      tripName={trip.name}
                      disabled={!tripOwner}
                      onDelete={() => removeTrip(trip.id)}
                      onDeleted={() => { void navigate({ to: "/dashboard" }); }}
                    />
                  </div>
                  <Dialog open={variantOpen} onOpenChange={(open) => { if (!variantSaving) setVariantOpen(open); }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{text("Veilige reisvariant maken", "Create a safe trip variant")}</DialogTitle>
                        <DialogDescription>{text("De route, planning, boekingen zonder reserveringscodes en paklijst worden gekopieerd. Reisgenoten, uitnodigingen, uitgaven, documenten, betalingen, deelinstellingen en vergelijkingsprijzen blijven achter.", "The route, itinerary, bookings without reservation codes and packing list are copied. Travellers, invitations, expenses, documents, payments, sharing settings and comparison prices stay behind.")}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="variant-name">{text("Naam van de variant", "Variant name")}</Label>
                        <Input id="variant-name" value={variantName} maxLength={TRIP_NAME_MAX_LENGTH} disabled={variantSaving} onChange={(event) => setVariantName(event.target.value)} />
                        <p className="text-xs text-muted-foreground">{variantName.length}/{TRIP_NAME_MAX_LENGTH}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">{text("Wordt meegenomen", "Included")}</p>
                        <p className="mt-1 text-muted-foreground">{text(`${trip.stops.length} routeplaatsen · ${trip.itinerary.length} planningsregels · ${(trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item)).length} boekingen · ${(trip.packing ?? []).length} paklijstitems`, `${trip.stops.length} route stops · ${trip.itinerary.length} itinerary items · ${(trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item)).length} bookings · ${(trip.packing ?? []).length} packing items`)}</p>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" disabled={variantSaving} onClick={() => setVariantOpen(false)}>{text("Annuleren", "Cancel")}</Button>
                        <Button type="button" disabled={variantSaving || !variantName.trim()} onClick={() => void createTripVariant()}>{text("Variant maken", "Create variant")}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="packing">
          <div className="space-y-4">
            <TripTasks mode="packing" tripId={trip.id} members={trip.members} owner={ownerParticipant} editable={editable} text={text} />
            {(trip.packing ?? []).length > 0 && (
              <details className="rounded-2xl border bg-muted/20 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {text("Bestaande algemene paklijst", "Existing general packing list")}
                </summary>
                <p className="mb-4 mt-2 text-xs text-muted-foreground">
                  {text("Deze oudere items blijven beschikbaar zodat er niets verloren gaat.", "These older items remain available so nothing is lost.")}
                </p>
                <Packing items={trip.packing ?? []} editable={editable} onChange={(next) => saveTripNow(trip.id, (t) => ({ ...t, packing: next }))} />
              </details>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <TripDocuments tripId={trip.id} editable={editable} />
        </TabsContent>

        <TabsContent value="route" className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
            <Card className="surface overflow-hidden">
              <CardContent className="p-3">
                <ClientOnly
                  fallback={<Skeleton className="h-[500px] w-full rounded-xl sm:h-[560px]" />}
                >
                  <Suspense
                    fallback={<Skeleton className="h-[500px] w-full rounded-xl sm:h-[560px]" />}
                  >
                    <TripMap
                      stops={routeStops}
                      routeItems={trip.travelItems}
                      startDate={trip.start}
                      points={(trip.travelItems ?? []).flatMap((item) => {
                        if (isRoutePlanningItem(item)) return [];
                        if (item.type === "activity" && item.details?.showOnMap !== true) return [];
                        const location = item.location ?? item.departure ?? item.arrival;
                        if (
                          !location ||
                          !Number.isFinite(location.lat) ||
                          !Number.isFinite(location.lon)
                        )
                          return [];
                        const expense = item.expenseId
                          ? trip.expenses.find((entry) => entry.id === item.expenseId)
                          : undefined;
                        return [
                          {
                            id: `booking-${item.id}`,
                            lat: location.lat,
                            lon: location.lon,
                            title: item.title,
                            locationName: location.name,
                            ...bookingMapGrouping(item, routeStops),
                            category: item.type === "lodging" ? "lodging" as const : item.type === "activity" ? "activity" as const : "other" as const,
                            date: item.date,
                            startTime: item.details?.startTime,
                            detail: item.provider,
                            kind: "booking" as const,
                          },
                          ...(expense
                            ? [
                                {
                                  id: `expense-${expense.id}`,
                                  lat: location.lat,
                                  lon: location.lon,
                                  title: expense.title,
                                  locationName: location.name,
                                  ...bookingMapGrouping(item, routeStops),
                            category: item.type === "lodging" ? "lodging" as const : item.type === "activity" ? "activity" as const : "other" as const,
                                  date: item.date,
                                  startTime: item.details?.startTime,
                                  detail: formatMoney(expense.amount, expense.currency),
                                  kind: "expense" as const,
                                },
                              ]
                            : []),
                        ];
                      })}
                      activeStopId={activeStopId}
                      onStopSelect={selectStop}
                    />
                  </Suspense>
                </ClientOnly>
              </CardContent>
            </Card>
            <TripRouteLegModes key={trip.id} trip={trip} editable={editable} text={text} save={(update) => saveTripNow(trip.id, update)} onEditBooking={(item) => { setEditingBooking(item); setActiveTab("plan-edit"); }} />
            </div>
            <aside className="space-y-4 xl:sticky xl:top-24">
              <Card className="surface">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {text("Bestemming toevoegen", "Add destination")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PlaceSearch disabled={!editable} onPick={(location) => {
                    setPendingStop(location);
                    setPendingStopOvernight(false);
                    setPendingStopArrival("");
                    setPendingStopNights("1");
                    setPendingStopIndex(trip.stops.length);
                  }} />
                  <FavoritePlaces
                    stops={trip.stops}
                    editable={editable}
                    text={text}
                    onAdd={(place) => addStop(place, false, "", 0)}
                  />
                  <Dialog open={Boolean(pendingStop)} onOpenChange={(open) => { if (!open && !pendingStopSaving) setPendingStop(undefined); }}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader><DialogTitle>{pendingStop?.name} {text("toevoegen", "add")}</DialogTitle></DialogHeader>
                      <p className="text-sm text-muted-foreground">{text("Is dit alleen een punt op je route, of slaap je hier? Dit bepaalt of GlobeTrotr naar een ontbrekend verblijf zoekt.", "Is this only a point on your route, or will you sleep here? This determines whether GlobeTrotr checks for missing accommodation.")}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" disabled={pendingStopSaving} onClick={() => setPendingStopOvernight(false)} className={`rounded-xl border p-4 text-left ${!pendingStopOvernight ? "border-primary bg-primary/10" : ""}`}><strong className="block">{text("Alleen routepunt", "Route point only")}</strong><span className="mt-1 block text-xs text-muted-foreground">{text("Bijvoorbeeld een luchthaven, overstap of tussenstop.", "For example an airport, transfer or intermediate stop.")}</span></button>
                        <button type="button" disabled={pendingStopSaving} onClick={() => setPendingStopOvernight(true)} className={`rounded-xl border p-4 text-left ${pendingStopOvernight ? "border-primary bg-primary/10" : ""}`}><strong className="block">{text("Ik overnacht hier", "I stay overnight here")}</strong><span className="mt-1 block text-xs text-muted-foreground">{text("Deze nachten worden door de hotelcontrole gevolgd.", "These nights are tracked by the accommodation check.")}</span></button>
                      </div>
                      {pendingStopOvernight && <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1"><Label>{text("Aankomstdatum", "Arrival date")}</Label><Input type="date" min={trip.start || undefined} max={trip.end || undefined} value={pendingStopArrival} disabled={pendingStopSaving} onChange={(event) => setPendingStopArrival(event.target.value)} /></label>
                        <label className="space-y-1"><Label>{text("Aantal nachten", "Number of nights")}</Label><Input type="number" min={1} max={366} value={pendingStopNights} disabled={pendingStopSaving} onChange={(event) => setPendingStopNights(event.target.value)} /></label>
                      </div>}
                      <label className="space-y-1"><Label>{text("Positie in route", "Position in route")}</Label><select className="form-control" value={pendingStopIndex} disabled={pendingStopSaving} onChange={(event) => setPendingStopIndex(Number(event.target.value))}>{trip.stops.map((stop, index) => <option key={stop.id} value={index}>{text(`Voor ${index + 1}. ${stop.name}`, `Before ${index + 1}. ${stop.name}`)}</option>)}<option value={trip.stops.length}>{text("Aan het einde", "At the end")}</option></select></label>
                      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pendingStopSaving} onClick={() => setPendingStop(undefined)}>{text("Annuleren", "Cancel")}</Button><Button type="button" disabled={!pendingStop || pendingStopSaving || (pendingStopOvernight && (!/^\d{4}-\d{2}-\d{2}$/.test(pendingStopArrival) || !Number.isInteger(Number(pendingStopNights)) || Number(pendingStopNights) < 1 || Number(pendingStopNights) > 366))} onClick={() => pendingStop && void addStop(pendingStop, pendingStopOvernight, pendingStopArrival, Number(pendingStopNights), pendingStopIndex)}>{pendingStopSaving ? text("Toevoegen…", "Adding…") : text("Bestemming toevoegen", "Add destination")}</Button></div>
                    </DialogContent>
                  </Dialog>
                  {routeStops.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {routeStops.length}{" "}
                      {text(
                        routeStops.length === 1 ? "bestemming" : "bestemmingen",
                        routeStops.length === 1 ? "destination" : "destinations",
                      )}
                      {activeStopId
                        ? text(
                            " · geselecteerde bestemming is op de kaart uitgelicht",
                            " · selected destination is highlighted on the map",
                          )
                        : ""}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {visibleStops.map((s) => {
                      const stopIndex = trip.stops.findIndex((stop) => stop.id === s.id);
                      return (
                        <li
                          key={s.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                            activeStopId === s.id
                              ? "border-primary bg-primary/10"
                              : "border-transparent bg-muted/60 hover:bg-muted"
                          }`}
                          onClick={() => setActiveStopId(s.id)}
                        >
                          <button type="button" className="min-w-0 flex-1 text-left">
                            <span className="mr-2 text-muted-foreground">{routeStops.findIndex(stop => stop.id === s.id) + 1}.</span>
                            {routePlaceName(s)}
                            {s.arrive && <span className="ml-2 text-xs text-muted-foreground">{s.arrive}</span>}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {localizeCountry(s.country, locale)}
                            </span>
                          </button>
                          {editable && (
                            <div className="flex shrink-0 items-center">
                            <button type="button" disabled={stopIndex === 0} aria-label={text("Bestemming omhoog", "Move destination up")} onClick={(event) => { event.stopPropagation(); void moveStop(s.id, -1); }}><ArrowUp className="size-4 text-muted-foreground disabled:opacity-40" /></button>
                            <button type="button" disabled={stopIndex === trip.stops.length - 1} aria-label={text("Bestemming omlaag", "Move destination down")} onClick={(event) => { event.stopPropagation(); void moveStop(s.id, 1); }}><ArrowDown className="size-4 text-muted-foreground disabled:opacity-40" /></button>
                            <button
                              type="button"
                              aria-label={text("Verwijder bestemming", "Delete destination")}
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeStop(s.id);
                              }}
                            >
                              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                            </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {routeStops.length > 4 && (
                    <Button
                      type="button"
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllStops((current) => !current)}
                    >
                      {showAllStops
                        ? text("Minder bestemmingen tonen", "Show fewer destinations")
                        : text(
                            `Alle ${routeStops.length} bestemmingen tonen`,
                            `Show all ${routeStops.length} destinations`,
                          )}
                    </Button>
                  )}
                  {trip.stops.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <TripRouteOptimizer key={trip.id} trip={trip} text={text} save={(update) => saveTripNow(trip.id, update)} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!editable || trip.stops.length < 2}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              text(
                                "Wil je de volledige volgorde van de bestemmingen omkeren?",
                                "Reverse the complete destination order?",
                              ),
                            )
                          )
                            return;
                          try {
                            await saveTripNow(trip.id, (current) => pruneRoutePlan({
                              ...current,
                              stops: [...current.stops].reverse(),
                            }));
                            setActiveStopId(undefined);
                            toast.success(text("Route omgekeerd", "Route reversed"));
                          } catch {
                            toast.error(
                              text(
                                "De route kon niet worden omgekeerd.",
                                "The route could not be reversed.",
                              ),
                            );
                          }
                        }}
                      >
                        <ArrowDownUp className="size-4" />
                        {text("Route omkeren", "Reverse route")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              <WeatherWidget
                {...(trip.stops.length ? { stop: trip.stops[trip.stops.length - 1]! } : {})}
                enabled={hasFeature(state.plan, "weather")}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <TripTasks tripId={trip.id} members={trip.members} editable={editable} text={text} />
          <TripTimeline
            trip={trip}
            baseCurrency={base}
            editable={editable}
            {...(editable
              ? { onUpdate: updateItineraryItem, onEditBooking: setEditingBooking }
              : {})}
            onFindStay={() => setActiveTab("discover")}
            onAddBooking={() => setActiveTab("plan-edit")}
            onRemove={removeItineraryItem}
          />
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <div id="hotelcontrole" className="scroll-mt-24"><HotelGapFinder trip={trip} editable={editable} save={(fn) => saveTripNow(trip.id, fn)} text={text} /></div>
          <NearbyPlaces
            trip={trip}
            editable={editable}
            onAdd={async (next) => {
              await saveTripNow(trip.id, (current) => ({
                ...current,
                itinerary: [...current.itinerary, { id: uid(), ...next }].sort((a, b) => a.day.localeCompare(b.day)),
              }));
            }}
          />
        </TabsContent>

        {editable && editingBooking && (
          <TripBookings
            key={editingBooking.id}
            trip={trip}
            editable={editable}
            payers={financialParticipants}
            onSave={saveTravelItem}
            onRemove={removeTravelItem}
            initialItem={editingBooking}
            onFinish={() => setEditingBooking(null)}
          />
        )}

        {editable && (
          <TabsContent value="plan-edit" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {text(
                "Voeg vluchten, verblijven, vervoer en andere boekingen toe. Eigen programma-items voeg je direct bij Schema toe.",
                "Add flights, stays, transport and other bookings. Add custom itinerary items directly under Schedule.",
              )}
            </p>
            <TripBookings
              trip={trip}
              editable={editable}
              payers={financialParticipants}
              onSave={saveTravelItem}
              onRemove={removeTravelItem}
            />
          </TabsContent>
        )}

        <TabsContent value="expenses" className="space-y-4">
          <Card className="surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {editingExpenseId
                  ? text("Uitgave wijzigen", "Edit expense")
                  : text("Uitgave boeken (elke valuta)", "Add expense (any currency)")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid items-end gap-3 md:grid-cols-7">
                <Input
                  type="date"
                  value={draft.date}
                  disabled={!moneyEditable}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
                <Input
                  className="md:col-span-2"
                  value={draft.title}
                  disabled={!moneyEditable}
                  placeholder={text("Omschrijving", "Description")}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <select
                  aria-label={text("Categorie", "Category")}
                  className="rounded-lg border border-input bg-card px-3 text-sm"
                  value={draft.category}
                  disabled={!moneyEditable}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as ExpenseCategory })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {expenseCategoryLabel(c.id, c.label, text)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={text("Betaald door", "Paid by")}
                  className="min-w-0 w-full max-w-full truncate rounded-lg border border-input bg-card px-3 text-sm"
                  value={draft.paidBy}
                  disabled={!moneyEditable}
                  onChange={(e) => setDraft({ ...draft, paidBy: e.target.value })}
                >
                  {financialParticipants.map((payer) => (
                    <option key={payer.id} value={payer.id}>
                      {payer.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={draft.amount || ""}
                  disabled={!moneyEditable}
                  placeholder={text("Bedrag", "Amount")}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
                <select
                  aria-label="Valuta"
                  className="rounded-lg border border-input bg-card px-3 text-sm"
                  value={draft.currency}
                  disabled={!moneyEditable}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
                {canMarkBillable && (
                  <label className="flex items-center gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.billable}
                      disabled={!moneyEditable}
                      onChange={(e) => setDraft({ ...draft, billable: e.target.checked })}
                    />
                    {text("Declarabel bij klant", "Billable to client")}
                  </label>
                )}
              </div>
              {fuelTravelItems.length > 0 && (
                <div className="grid gap-2 rounded-xl border border-border bg-muted/25 p-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,1fr)] md:items-center">
                  <div>
                    <p className="text-sm font-medium">
                      {text("Werkelijke brandstofkosten", "Actual fuel costs")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {text(
                        "Koppel een tankuitgave aan een rit om de prognose voor die rit te vervangen.",
                        "Link a fuel expense to a drive to replace that drive's estimate.",
                      )}
                    </p>
                  </div>
                  <select
                    aria-label={text("Brandstofprognose vervangen", "Replace fuel estimate")}
                    className="min-h-10 min-w-0 rounded-lg border border-input bg-card px-3 text-sm"
                    value={fuelTravelItemId ?? ""}
                    disabled={!moneyEditable}
                    onChange={(event) => {
                      const selectedId = event.target.value || undefined;
                      setFuelTravelItemId(selectedId);
                      if (selectedId) setDraft({ ...draft, category: "transport" });
                    }}
                  >
                    <option value="">
                      {text("Geen prognose vervangen", "Do not replace an estimate")}
                    </option>
                    {fuelTravelItems.map((travelItem) => (
                      <option key={travelItem.id} value={travelItem.id}>
                        {travelItem.title} ·{" "}
                        {formatMoney(
                          fuelEstimateFor(travelItem),
                          travelItem.details?.fuelCurrency ?? travelItem.currency ?? base,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-xl border border-border bg-muted/25 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {text("Verdelen tussen", "Split between")}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {financialParticipants.map((traveler) => {
                    const selected =
                      !draft.splitWith?.length ||
                      draft.splitWith.some(
                        (value) =>
                          resolveParticipantId(value, financialParticipants) === traveler.id,
                      );
                    return (
                      <label key={traveler.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!moneyEditable}
                          onChange={(event) => {
                            const current = draft.splitWith?.length
                              ? draft.splitWith
                              : financialParticipants.map((participant) => participant.id);
                            const splitWith = event.target.checked
                              ? Array.from(new Set([...current, traveler.id]))
                              : current.filter(
                                  (person) =>
                                    resolveParticipantId(person, financialParticipants) !==
                                    traveler.id,
                                );
                            setDraft({ ...draft, splitWith });
                          }}
                        />
                        {traveler.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <Input
                value={draft.notes ?? ""}
                disabled={!moneyEditable}
                placeholder={text("Notitie (optioneel)", "Note (optional)")}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
              />
              <div className="flex flex-wrap justify-end gap-2">
                {editingExpenseId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingExpenseId(undefined);
                      setFuelTravelItemId(undefined);
                      setDraft({
                        date: new Date().toISOString().slice(0, 10),
                        title: "",
                        category: "food",
                        amount: 0,
                        currency: base,
                        paidBy: ownerParticipant.id,
                        billable: false,
                      });
                    }}
                  >
                    {text("Annuleren", "Cancel")}
                  </Button>
                )}
                <Button
                  onClick={() => void addExpense()}
                  disabled={!moneyEditable || expenseSaving}
                >
                  <Plus className="size-4" />{" "}
                  {expenseSaving
                    ? text("Opslaan…", "Saving…")
                    : editingExpenseId
                      ? text("Opslaan", "Save")
                      : text("Boeken", "Add")}{" "}
                  ({formatMoney(convert(draft.amount || 0, draft.currency, base, rates), base)})
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={expenseSearch}
              onChange={(event) => setExpenseSearch(event.target.value)}
              placeholder={text("Zoek in uitgaven…", "Search expenses…")}
              aria-label={text("Uitgaven zoeken", "Search expenses")}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={expenseCategoryFilter}
              onChange={(event) =>
                setExpenseCategoryFilter(event.target.value as "all" | ExpenseCategory)
              }
              aria-label={text("Filter op categorie", "Filter by category")}
            >
              <option value="all">{text("Alle categorieën", "All categories")}</option>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {expenseCategoryLabel(category.id, category.label, text)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={expensePayerFilter}
              onChange={(event) => setExpensePayerFilter(event.target.value)}
              aria-label={text("Filter op betaler", "Filter by payer")}
            >
              <option value="all">{text("Alle betalers", "All payers")}</option>
              {financialParticipants.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            {text(
              `${visibleExpenses.length} van ${trip.expenses.length} uitgaven`,
              `${visibleExpenses.length} of ${trip.expenses.length} expenses`,
            )}
          </p>

          <Card className="surface min-w-0 overflow-hidden">
            <CardContent
              className="overflow-x-auto p-0"
              tabIndex={0}
              role="region"
              aria-label={text("Uitgavenoverzicht", "Expense overview")}
            >
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">{text("Datum", "Date")}</th>
                    <th className="p-3">{text("Omschrijving", "Description")}</th>
                    <th className="p-3">{text("Categorie", "Category")}</th>
                    <th className="p-3">{text("Betaald door", "Paid by")}</th>
                    <th className="p-3 text-right">{text("Origineel", "Original")}</th>
                    <th className="p-3 text-right">{base}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap">{e.date}</td>
                      <td className="p-3">
                        {e.title}
                        {canMarkBillable && e.billable && (
                          <Badge variant="secondary" className="ml-2">
                            {text("declarabel", "billable")}
                          </Badge>
                        )}
                        {fuelTravelItemIdForExpense(trip.travelItems ?? [], e.id) && (
                          <Badge variant="outline" className="ml-2">
                            {text("werkelijke brandstof", "actual fuel")}
                          </Badge>
                        )}
                        {canManageReceipts && e.receiptPath && (
                          <button
                            type="button"
                            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                            onClick={() => void openReceipt(e)}
                          >
                            <Paperclip className="size-3" />{" "}
                            {e.receiptName || text("Bon bekijken", "View receipt")}
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        {expenseCategoryLabel(
                          e.category,
                          CATEGORIES.find((c) => c.id === e.category)?.label ?? e.category,
                          text,
                        )}
                      </td>
                      <td className="p-3">{participantName(e.paidBy, financialParticipants)}</td>
                      <td className="p-3 text-right">
                        {e.amount.toFixed(2)} {e.currency}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatMoney(convert(e.amount, e.currency, base, rates), base)}
                      </td>
                      <td className="p-3 text-right">
                        {moneyEditable && (
                          <span className="inline-flex">
                            {canManageReceipts && (
                              <label
                                className={`grid size-7 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground ${
                                  uploadingReceiptId === e.id
                                    ? "pointer-events-none opacity-50"
                                    : ""
                                }`}
                                title={text("Bon koppelen", "Attach receipt")}
                              >
                                <Paperclip className="size-4" />
                                <input
                                  className="sr-only"
                                  type="file"
                                  accept="application/pdf,image/jpeg,image/png,image/webp"
                                  disabled={uploadingReceiptId === e.id}
                                  onChange={(event) => void uploadReceipt(e, event)}
                                />
                              </label>
                            )}
                            <button
                              aria-label={text("Wijzig uitgave", "Edit expense")}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingExpenseId(e.id);
                                setFuelTravelItemId(
                                  fuelTravelItemIdForExpense(trip.travelItems ?? [], e.id),
                                );
                                setDraft(normalizeExpenseParticipants(e, financialParticipants));
                              }}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              aria-label={text("Verwijder uitgave", "Delete expense")}
                              className="p-1 text-muted-foreground hover:text-destructive"
                              onClick={() => void removeExpense(e.id)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="money" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <CurrencyConverter rates={rates} base={base} live={ratesLive} />
            <FuelCalculator rates={rates} base={base} />
          </div>
          <Settlement
            trip={trip}
            base={base}
            rates={rates}
            editable={moneyEditable}
            owner={ownerParticipant}
            manageTravelersInSettings
          />
        </TabsContent>
        <TabsContent value="insights" className="space-y-4">
          <TripInsights trip={trip} base={base} rates={rates} text={text} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function tripStatusLabel(
  status: ReturnType<typeof tripStatus>,
  text: (nl: string, en: string) => string,
) {
  if (status === "current") return text("Huidig", "Current");
  if (status === "upcoming") return text("Aankomend", "Upcoming");
  return text("Gearchiveerd", "Archived");
}

function expenseCategoryLabel(
  id: string,
  fallback: string,
  text: (nl: string, en: string) => string,
) {
  const labels: Record<string, string> = {
    transport: "Transport",
    lodging: "Accommodation",
    food: "Food and drink",
    activities: "Activities",
    shopping: "Shopping",
    other: "Other",
  };
  return text(fallback, labels[id] ?? fallback);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="surface">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

async function hashSharingPin(pin: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
