import type { AppLocale } from "@/lib/locale";

const COUNTRY_EN: Record<string, string> = {
  Nederland: "Netherlands", Noorwegen: "Norway", Denemarken: "Denmark", Zweden: "Sweden",
  Duitsland: "Germany", België: "Belgium", Frankrijk: "France", Spanje: "Spain",
  Italië: "Italy", Portugal: "Portugal", Oostenrijk: "Austria", Zwitserland: "Switzerland",
  Finland: "Finland", IJsland: "Iceland", Polen: "Poland", Tsjechië: "Czechia",
  Griekenland: "Greece", Turkije: "Türkiye", "Verenigd Koninkrijk": "United Kingdom",
  "Verenigde Staten": "United States", Canada: "Canada", Australië: "Australia",
  Japan: "Japan", Thailand: "Thailand", Indonesië: "Indonesia", "Zuid-Afrika": "South Africa",
};

export function localizeCountry(value: string, locale: AppLocale) {
  return locale === "en-GB" ? COUNTRY_EN[value] ?? value : value;
}

export function localizeTagline(value: string, locale: AppLocale) {
  if (locale === "en-GB" && (value === "Plan elke reis. Volg elke euro." || value === "Plan elke reis. Verantwoord elke euro.")) {
    return "Plan every trip. Track every euro.";
  }
  if (locale === "en-GB" && value === "Samen op reis, alles geregeld.") {
    return "Travel together, everything organised.";
  }
  return value;
}

export function localizedWeather(code: number, locale: AppLocale) {
  if (locale === "nl-NL") return code === 0 ? "Helder" : code <= 3 ? "Bewolkt" : code <= 48 ? "Mist" : code <= 67 ? "Regen" : code <= 77 ? "Sneeuw" : code <= 82 ? "Buien" : "Onweer";
  return code === 0 ? "Clear" : code <= 3 ? "Cloudy" : code <= 48 ? "Fog" : code <= 67 ? "Rain" : code <= 77 ? "Snow" : code <= 82 ? "Showers" : "Thunderstorms";
}
