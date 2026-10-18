export type PlanId = "free" | "pro" | "agency";
export type RoleId = "owner" | "editor" | "accountant" | "viewer";
export type TripMemberRole = "owner" | "traveler" | "viewer" | "advisor" | "finance" | "client";
export type TripMemberStatus = "invited" | "active";

export type Stop = {
  id: string;
  name: string;
  country: string;
  /** Municipality supplied by place search; exact venue coordinates stay unchanged. */
  city?: string;
  addressLine?: string;
  lat: number;
  lon: number;
  arrive?: string;
  nights?: number;
};

export type ItineraryItem = {
  id: string;
  day: string;
  title: string;
  notes?: string;
  /** Set for the legacy planning row that belongs to a booked travel item. */
  sourceTravelItemId?: string;
};

export type TravelItemType = "flight" | "lodging" | "transport" | "car_rental" | "activity";
export type TransportMode =
  | "flight"
  | "car"
  | "motorcycle"
  | "camper"
  | "public_transport"
  | "train"
  | "bus"
  | "ferry"
  | "taxi"
  | "bicycle"
  | "walking"
  | "other";

export type TravelLocation = {
  name: string;
  country: string;
  /** Municipality supplied by place search; exact venue coordinates stay unchanged. */
  city?: string;
  addressLine?: string;
  lat: number;
  lon: number;
};

/** Provider-calculated geometry for one route stage; coordinates use [longitude, latitude]. */
export type CachedRoadSegment = {
  source: "openrouteservice";
  mode: "car" | "bicycle" | "walking";
  fromStopId: string;
  toStopId: string;
  from: [number, number];
  to: [number, number];
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  calculatedAt: string;
  avoidTolls: boolean;
  avoidFerries: boolean;
};

/** Een geboekt onderdeel van een reis, zoals vlucht, hotel of treinrit. */
export type TravelItem = {
  id: string;
  type: TravelItemType;
  title: string;
  date: string;
  endDate?: string;
  provider?: string;
  bookingReference?: string;
  flightNumber?: string;
  flightStatus?: string;
  departure?: TravelLocation;
  arrival?: TravelLocation;
  location?: TravelLocation;
  amount?: number;
  currency?: string;
  /** Gekoppelde uitgave die automatisch bij dit onderdeel is aangemaakt. */
  expenseId?: string;
  notes?: string;
  /** Type-specific, non-sensitive booking details. */
  details?: {
    startTime?: string;
    endTime?: string;
    vehicle?: string;
    vehicleCategory?: string;
    deposit?: number;
    insurance?: string;
    excess?: number;
    distanceKm?: number;
    durationMinutes?: number;
    roadRoute?: CachedRoadSegment;
    consumptionPer100Km?: number;
    fuelPricePerLiter?: number;
    fuelCurrency?: string;
    transportMode?: TransportMode;
    seat?: string;
    /** Route planning choice only; this is not a reservation or booked travel item. */
    routePlanningOnly?: boolean;
    /** Werkelijke brandstofuitgaven die de prognose voor deze rit vervangen. */
    fuelActualExpenseIds?: string[];
    /** Alleen de veilige samenvatting van dit onderdeel mag openbaar worden getoond. */
    sharePublicly?: boolean;
    /** Activities are map markers only, never implicit route destinations. */
    showOnMap?: boolean;
    /** Undefined: automatic grouping; empty: own marker; otherwise a chosen stop ID. */
    mapStopId?: string;
    /** Undefined uses dated route stops; an empty value explicitly leaves it unlinked. */
    routeDepartureStopId?: string;
    routeArrivalStopId?: string;
    /** Optionele drielettercode voor een datumgebonden Schedule-fallback. */
    flightDepartureIata?: string;
    flightDepartureAirport?: string;
    flightArrivalAirport?: string;
    flightDepartureScheduled?: string;
    flightDepartureActual?: string;
    flightDepartureTerminal?: string;
    flightDepartureGate?: string;
    flightDepartureCheckin?: string;
    flightArrivalScheduled?: string;
    flightArrivalEstimated?: string;
    flightArrivalTerminal?: string;
    flightArrivalGate?: string;
    flightArrivalBaggage?: string;
    flightLastCheckedAt?: string;
  };
};

export function isRoutePlanningItem(item: TravelItem) {
  return item.details?.routePlanningOnly === true || item.id.startsWith("route-leg:");
}

export type TravelOptionStatus = "candidate" | "selected" | "rejected";

export type TravelOptionDetails = {
  startTime?: string;
  endTime?: string;
  flightNumber?: string;
  departureName?: string;
  arrivalName?: string;
  locationName?: string;
  transportMode?: TransportMode;
  luggageIncluded?: boolean;
  roomType?: string;
  guests?: number;
  rooms?: number;
  taxesAndFees?: number;
  breakfastIncluded?: boolean;
  vehicle?: string;
  vehicleCategory?: string;
  deposit?: number;
  insurance?: string;
  excess?: number;
  activityCategory?: string;
  participants?: number;
};

/** Een nog niet geboekte keuze die reizigers gecontroleerd kunnen vergelijken. */
export type TravelOption = {
  id: string;
  type: TravelItemType;
  title: string;
  startDate: string;
  endDate?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  /** Bekende belastingen en toeslagen die al in amount zijn opgenomen. */
  chargesIncluded?: boolean;
  cancellation?: string;
  durationMinutes?: number;
  distanceKm?: number;
  sourceUrl?: string;
  notes?: string;
  /** Velden die alleen bij het gekozen soort kandidaat horen. */
  details?: TravelOptionDetails;
  status: TravelOptionStatus;
  checkedAt?: string;
  /** Bewijst dat omzetten naar een boeking idempotent is. */
  convertedTravelItemId?: string;
  createdAt: string;
};

export type Expense = {
  id: string;
  date: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  paidBy: string;
  billable: boolean;
  /** Namen die meebetalen; leeg = alle reizigers */
  splitWith?: string[];
  /** Pad in de receipts-opslag */
  receiptPath?: string;
  receiptName?: string;
  notes?: string;
};

export type ExpenseCategory =
  "transport" | "lodging" | "food" | "activities" | "shopping" | "other";

export const CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: "transport", label: "Vervoer" },
  { id: "lodging", label: "Verblijf" },
  { id: "food", label: "Eten & drinken" },
  { id: "activities", label: "Activiteiten" },
  { id: "shopping", label: "Shopping" },
  { id: "other", label: "Overig" },
];

export type TripTemplate =
  "safari" | "cruise" | "roadtrip" | "backpacking" | "citytrip" | "beach" | "business" | "winter";

export const TEMPLATES: {
  id: TripTemplate;
  label: string;
  emoji: string;
  itinerary: string[];
}[] = [
  {
    id: "safari",
    label: "Safari",
    emoji: "🦁",
    itinerary: ["Aankomst & lodge check-in", "Game drive bij zonsopgang", "Bushwalk met ranger"],
  },
  {
    id: "cruise",
    label: "Cruise",
    emoji: "🛳️",
    itinerary: ["Inschepen & muster drill", "Zeedag aan boord", "Excursie in havenstad"],
  },
  {
    id: "roadtrip",
    label: "Roadtrip",
    emoji: "🚐",
    itinerary: ["Huurauto ophalen", "Scenic route etappe 1", "Overnachting onderweg"],
  },
  {
    id: "backpacking",
    label: "Backpacken",
    emoji: "🎒",
    itinerary: ["Hostel check-in", "Free walking tour", "Nachtbus naar volgende stop"],
  },
  {
    id: "citytrip",
    label: "Stedentrip",
    emoji: "🏙️",
    itinerary: ["Aankomst & hotel", "Museum & oude stad", "Rooftop diner"],
  },
  {
    id: "beach",
    label: "Beach / Resort",
    emoji: "🏝️",
    itinerary: ["Transfer naar resort", "Strand & snorkelen", "Spa & sunset cocktails"],
  },
  {
    id: "business",
    label: "Zakenreis",
    emoji: "💼",
    itinerary: ["Vlucht & inchecken", "Client meeting", "Conferentiedag"],
  },
  {
    id: "winter",
    label: "Winterexpeditie",
    emoji: "🏔️",
    itinerary: ["Aankomst & materiaalcheck", "Husky- of sneeuwscootertocht", "Noorderlicht safari"],
  },
];

export type Member = {
  id: string;
  name: string;
  email: string;
  role: RoleId;
};

/** Een reisgenoot is onderdeel van één reis en staat in het JSON-workspace-document. */
export type TripMember = {
  id: string;
  name: string;
  email: string;
  role: TripMemberRole;
  status: TripMemberStatus;
  invitedAt: string;
};

export type TripStatus = "upcoming" | "current" | "archived";

export type PackingItem = {
  id: string;
  label: string;
  done: boolean;
};

export type Trip = {
  id: string;
  /** Database-eigenaar; gebruikt als vaste deelnemerssleutel voor kosten. */
  ownerId?: string;
  /** Rol van het huidige account binnen deze reis; ontbreekt bij oude lokale data en betekent eigenaar. */
  accessRole?: TripMemberRole;
  /** Database version, kept as text to preserve BIGINT precision. */
  revision?: string;
  name: string;
  /** Korte introductie van de reis, zichtbaar op de publieke pagina wanneer gedeeld. */
  description?: string | undefined;
  /** Optionele Agency-huisstijl voor uitsluitend deze reis. */
  branding?: Partial<Branding>;
  template: TripTemplate;
  start: string;
  end: string;
  budget: number;
  stops: Stop[];
  itinerary: ItineraryItem[];
  travelItems?: TravelItem[];
  /** Kandidaten om te vergelijken voordat een onderdeel werkelijk wordt geboekt. */
  travelOptions?: TravelOption[];
  /** Uitgenodigde reisgenoten en hun rechten voor deze reis. */
  members?: TripMember[];
  expenses: Expense[];
  travelers?: string[];
  packing?: PackingItem[];
  archived?: boolean;
  /** Openbaar zichtbaar op de homepage */
  public?: boolean;
  /** Toon het budget op de openbare reispagina */
  shareFinancials?: boolean;
  /** SHA-256-hash van de optionele PIN voor deze openbare reis */
  sharePinHash?: string;
};

export function tripStatus(trip: Trip, today = new Date()): TripStatus {
  if (trip.archived) return "archived";
  const d = today.toISOString().slice(0, 10);
  if (trip.end && trip.end < d) return "archived";
  if (trip.start && trip.start <= d) return "current";
  return "upcoming";
}

export const STATUS_LABEL: Record<TripStatus, string> = {
  current: "Huidig",
  upcoming: "Aankomend",
  archived: "Gearchiveerd",
};

export const PACKING_TEMPLATES: { id: string; label: string; emoji: string; items: string[] }[] = [
  {
    id: "winter",
    label: "Winterexpeditie",
    emoji: "🥶",
    items: [
      "Thermo-ondergoed (3x)",
      "Donsjas -30°C",
      "Winterschoenen met grip",
      "Wollen sokken (5 paar)",
      "Muts, sjaal & wanten",
      "Skibril / zonnebril",
      "Handwarmers",
      "Powerbank (kou = leeg)",
      "Statief voor noorderlicht",
      "Hoofdlamp + reservebatterijen",
      "Zonnebrand & lippenbalsem",
      "Reisverzekering & winterdekking",
      "Sneeuwkettingen / winterbanden",
      "IJskrabber & sleepkabel",
      "Thermoskan",
      "EHBO-set",
      "Paspoort & rijbewijs",
      "Contant geld in lokale valuta",
    ],
  },
  {
    id: "citytrip",
    label: "Stedentrip",
    emoji: "🏙️",
    items: [
      "Comfortabele schoenen",
      "Regenjas of paraplu",
      "Powerbank",
      "Stadsplattegrond / offline kaart",
      "Museumkaarten & tickets",
      "Dagrugzak",
      "Adapter",
      "Kleine EHBO-set",
    ],
  },
  {
    id: "beach",
    label: "Strand & resort",
    emoji: "🏝️",
    items: [
      "Zwemkleding (2x)",
      "Zonnebrand SPF50",
      "Strandhanddoek",
      "Slippers",
      "Snorkelset",
      "Aftersun",
      "Waterdichte telefoonhoes",
      "Zonnehoed",
    ],
  },
  {
    id: "roadtrip",
    label: "Roadtrip",
    emoji: "🚐",
    items: [
      "Rijbewijs & groene kaart",
      "Telefoonhouder & autolader",
      "Koelbox",
      "Gevarendriehoek & veiligheidshesjes",
      "Bandenspanningsmeter",
      "Snacks & water",
      "Offline navigatie",
      "Parkeerschijf & tolvignetten",
    ],
  },
  {
    id: "business",
    label: "Zakenreis",
    emoji: "💼",
    items: [
      "Laptop + lader",
      "Presentatie op USB/cloud",
      "Visitekaartjes",
      "Nette outfit",
      "Noise-cancelling koptelefoon",
      "Bonnetjesmapje",
      "Reisverzekering zakelijk",
    ],
  },
];

export type Branding = {
  brandName: string;
  domain: string;
  accent: number; // hue
  tagline: string;
  /** Private Storage-path; de browser ontvangt alleen een tijdelijke signed URL. */
  logoPath?: string;
};

export type WorkspaceState = {
  plan: PlanId;
  role: RoleId;
  baseCurrency: string;
  branding: Branding;
  members: Member[];
  trips: Trip[];
};
