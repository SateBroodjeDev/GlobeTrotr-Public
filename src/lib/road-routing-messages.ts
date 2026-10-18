import { roadRouteErrorCode } from "./road-routing";

export function roadRoutingMessage(error: unknown, text: (nl: string, en: string) => string) {
  const messages: Record<string, [string, string]> = {
    ROUTING_NOT_CONFIGURED: ["Echte wegroutering is nog niet geconfigureerd.", "Road routing is not configured yet."],
    ROUTING_KEY_INVALID: ["OpenRouteService weigert toegang tot routeberekeningen. Controleer de serverconfiguratie.", "OpenRouteService denied access to route calculations. Check the server configuration."],
    PROVIDER_QUOTA_EXCEEDED: ["Het routequotum is bereikt.", "The routing quota has been reached."],
    PROVIDER_QUOTA_UNAVAILABLE: ["De quotacontrole is momenteel niet bereikbaar.", "The quota check is currently unavailable."],
    PROVIDER_DISABLED: ["Routeberekeningen zijn tijdelijk uitgeschakeld door de beheerder.", "Route calculations are temporarily disabled by the administrator."],
    ROUTE_NOT_FOUND: ["Voor deze punten en keuzes kon geen berijdbare route worden gevonden.", "No usable route was found for these points and choices."],
    ROUTING_TIMEOUT: ["De routeprovider reageerde te langzaam. Probeer het opnieuw.", "The routing provider took too long. Try again."],
    ROUTING_UNAVAILABLE: ["OpenRouteService is tijdelijk niet bereikbaar.", "OpenRouteService is temporarily unavailable."],
    ROUTING_RESPONSE_INVALID: ["OpenRouteService gaf geen bruikbare route terug.", "OpenRouteService did not return a usable route."],
    ROUTE_STOPS_INVALID: ["Een gekozen routepunt heeft geen geldige kaartlocatie.", "A selected route point does not have a valid map location."],
    ROUTE_STOPS_UNAVAILABLE: ["De routepunten konden niet uit de reis worden geladen.", "The route points could not be loaded from the trip."],
    TRIP_PLANNER_REQUIRED: ["Alleen een reisplanner kan de wegroute berekenen.", "Only a trip planner can calculate the road route."],
    NO_ROAD_SEGMENTS: ["Kies eerst auto, fiets of lopen bij de etappes die je over de weg aflegt.", "First select car, bicycle or walking for the stages you travel by road."],
    INVALID_ROUTE_REQUEST: ["De gekozen etappe of route-instellingen zijn ongeldig. Open het venster opnieuw.", "The selected section or route settings are invalid. Reopen the window."],
  };
  const message = messages[roadRouteErrorCode(error) ?? ""] ?? ["Route kon niet worden berekend. Probeer het later opnieuw.", "The route could not be calculated. Try again later."];
  return text(message[0], message[1]);
}

export function roadSaveMessage(error: unknown, text: (nl: string, en: string) => string) {
  return error instanceof Error && error.message === "ROUTE_PLAN_CHANGED"
    ? text("De route of vervoerskeuzes zijn gewijzigd. Bereken de wegroute opnieuw.", "The route or transport choices changed. Calculate the road route again.")
    : text("De wegroute kon niet worden opgeslagen. Probeer het opnieuw.", "The road route could not be saved. Try again.");
}
