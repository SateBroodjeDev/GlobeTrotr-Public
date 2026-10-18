// Browser-side integrations with free, keyless public APIs.

export type GeoResult = {
  name: string;
  country: string;
  city?: string;
  /** Distinguishing address line supplied by the geocoder. */
  addressLine?: string;
  lat: number;
  lon: number;
};

export async function searchPlaces(query: string, language: "nl" | "en" = "nl"): Promise<GeoResult[]> {
  // Keep the existing helper on the same shared provider queue as PlaceSearch.
  const { searchPlacesServer } = await import("./place.functions");
  return searchPlacesServer({ data: { query, language } });
}

export type Weather = {
  temperature: number;
  windspeed: number;
  code: number;
  daily: { date: string; min: number; max: number; code: number }[];
};

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_min,temperature_2m_max,weather_code&forecast_days=5&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weer ophalen mislukt");
  const j = await res.json();
  return {
    temperature: j.current_weather.temperature,
    windspeed: j.current_weather.windspeed,
    code: j.current_weather.weathercode,
    daily: (j.daily.time as string[]).map((d, i) => ({
      date: d,
      min: j.daily.temperature_2m_min[i],
      max: j.daily.temperature_2m_max[i],
      code: j.daily.weather_code[i],
    })),
  };
}

export function weatherLabel(code: number) {
  if (code === 0) return { icon: "☀️", text: "Helder" };
  if (code <= 3) return { icon: "⛅", text: "Bewolkt" };
  if (code <= 48) return { icon: "🌫️", text: "Mist" };
  if (code <= 67) return { icon: "🌧️", text: "Regen" };
  if (code <= 77) return { icon: "❄️", text: "Sneeuw" };
  if (code <= 82) return { icon: "🌦️", text: "Buien" };
  if (code <= 86) return { icon: "🌨️", text: "Sneeuwbuien" };
  return { icon: "⛈️", text: "Onweer" };
}

export const CURRENCIES = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "Brits Pond" },
  { code: "JPY", symbol: "¥", label: "Japanse Yen" },
  { code: "AUD", symbol: "A$", label: "Australische Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadese Dollar" },
  { code: "CHF", symbol: "Fr", label: "Zwitserse Frank" },
  { code: "SEK", symbol: "kr", label: "Zweedse Kroon" },
  { code: "NOK", symbol: "kr", label: "Noorse Kroon" },
  { code: "DKK", symbol: "kr", label: "Deense Kroon" },
  { code: "THB", symbol: "฿", label: "Thaise Baht" },
  { code: "IDR", symbol: "Rp", label: "Indonesische Roepia" },
  { code: "BRL", symbol: "R$", label: "Braziliaanse Real" },
  { code: "ZAR", symbol: "R", label: "Zuid-Afrikaanse Rand" },
  { code: "INR", symbol: "₹", label: "Indiase Roepie" },
  { code: "MXN", symbol: "$", label: "Mexicaanse Peso" },
  { code: "NZD", symbol: "NZ$", label: "Nieuw-Zeelandse Dollar" },
  { code: "PLN", symbol: "zł", label: "Poolse Zloty" },
  { code: "CZK", symbol: "Kč", label: "Tsjechische Kroon" },
  { code: "TRY", symbol: "₺", label: "Turkse Lira" },
];

export type Rates = Record<string, number>; // 1 EUR = x currency

export const FALLBACK_RATES: Rates = {
  EUR: 1, USD: 1.09, GBP: 0.85, JPY: 162, AUD: 1.64, CAD: 1.48, CHF: 0.95,
  SEK: 11.3, NOK: 11.6, DKK: 7.46, THB: 39.5, IDR: 17600, BRL: 5.9, ZAR: 20.1,
  INR: 91, MXN: 19.8, NZD: 1.79, PLN: 4.3, CZK: 25.1, TRY: 35.4,
};

export function convert(amount: number, from: string, to: string, rates: Rates) {
  const f = rates[from] ?? 1;
  const t = rates[to] ?? 1;
  return (amount / f) * t;
}

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
