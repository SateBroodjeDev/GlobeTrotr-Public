import { useQuery } from "@tanstack/react-query";
import { weatherLabel } from "@/lib/services";
import { getPublicWeather, getWeather } from "@/lib/weather.functions";
import type { Stop } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/locale";
import { localizeCountry, localizedWeather } from "@/lib/localized-values";

export function WeatherWidget({ stop, enabled, publicAccess }: { stop?: Stop; enabled: boolean; publicAccess?: { token: string; tripId: string; pin?: string } }) {
  const { locale, text } = useLocale();
  const q = useQuery({
    queryKey: ["weather", stop?.lat, stop?.lon, publicAccess?.token, publicAccess?.tripId],
    queryFn: () => publicAccess
      ? getPublicWeather({ data: { ...publicAccess, lat: stop!.lat, lon: stop!.lon } })
      : getWeather({ data: { lat: stop!.lat, lon: stop!.lon } }),
    enabled: !!stop && enabled,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {text("Weer", "Weather")} ·{" "}
          {stop
            ? `${stop.name}, ${localizeCountry(stop.country, locale)}`
            : text("geen bestemming", "no destination")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            {text(
              "Live weer is onderdeel van Pro. Upgrade om de verwachting per bestemming te zien.",
              "Live weather is part of Pro. Upgrade to see the forecast for each destination.",
            )}
          </p>
        ) : !stop ? (
          <p className="text-sm text-muted-foreground">
            {text("Voeg een bestemming toe op de kaart.", "Add a destination to the map.")}
          </p>
        ) : q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-destructive">
            {text(
              "Weerdata tijdelijk niet beschikbaar.",
              "Weather data is temporarily unavailable.",
            )}
          </p>
        ) : q.data ? (
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl">{weatherLabel(q.data.code).icon}</span>
              <span className="font-display text-3xl font-semibold">
                {Math.round(q.data.temperature)}°C
              </span>
              <span className="text-sm text-muted-foreground">
                {localizedWeather(q.data.code, locale)} · {Math.round(q.data.windspeed)} km/h
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
              {q.data.daily.map((d) => (
                <div key={d.date} className="rounded-lg bg-muted/70 py-2">
                  <div className="text-muted-foreground">
                    {new Date(d.date).toLocaleDateString(locale, { weekday: "short" })}
                  </div>
                  <div className="text-base">{weatherLabel(d.code).icon}</div>
                  <div className="font-medium">
                    {Math.round(d.max)}° / {Math.round(d.min)}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
