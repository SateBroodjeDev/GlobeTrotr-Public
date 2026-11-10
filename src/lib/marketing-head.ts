import { localizedMarketingPath, type MarketingLocale, type MarketingPath } from "./marketing-locale.ts";
import { PUBLIC_SITE_SEO } from "./public-site-seo.ts";
import { PUBLIC_SITE_ORIGIN } from "./site-routing.ts";

const COPY = {
  "/": [
    [PUBLIC_SITE_SEO.title, PUBLIC_SITE_SEO.description],
    ["GlobeTrotr — Plan your trip together", "Plan your trip together with GlobeTrotr. Keep routes and bookings, split travel expenses and capture memories in your travel journal. Start for free."],
  ],
  "/about": [
    ["Over GlobeTrotr — De reisplanner van Domenic", "GlobeTrotr is een online reisplanner uit Nederland, gebouwd door Domenic. Lees het verhaal achter samen routes plannen, boekingen bewaren en reiskosten verdelen."],
    ["About GlobeTrotr — The travel planner built by Domenic", "GlobeTrotr is an online travel planner from the Netherlands, built by Domenic. Read the story behind planning routes together, keeping bookings and splitting expenses."],
  ],
  "/features": [
    ["Reisplanner: routes, boekingen en reisdagboek — GlobeTrotr", "Ontdek hoe je routes, boekingen, dagplanning, paklijsten, groepskosten en je reisdagboek samenbrengt in GlobeTrotr."],
    ["Travel planner features: routes, bookings and journal — GlobeTrotr", "Explore routes, bookings, daily itineraries, packing lists, shared expenses and your travel journal in GlobeTrotr."],
  ],
  "/for-travelers": [
    ["Rondreis plannen met meerdere bestemmingen — GlobeTrotr", "Plan je vakantie of roadtrip op één plek. Bewaar routes, boekingen, paklijsten en uitgaven en leg onderweg je herinneringen vast."],
    ["Plan a trip with multiple destinations — GlobeTrotr", "Plan your holiday or road trip in one place. Keep routes, bookings, packing lists and expenses together and capture your memories along the way."],
  ],
  "/for-groups": [
    ["Groepsreis plannen en kosten verdelen — GlobeTrotr", "Plan je groepsreis samen: deel de route en boekingen, stem over ideeën en verdeel vakantiekosten eerlijk met je reisgenoten."],
    ["Plan group trips and split travel expenses — GlobeTrotr", "Plan your group trip together: share routes and booking details, vote on ideas and split travel expenses with your fellow travellers."],
  ],
  "/pricing": [
    ["Prijzen voor Free, Pro en Agency — GlobeTrotr", "Vergelijk GlobeTrotr Free, Pro en Agency. Kies de reisplanner die past bij jouw vakantie, groepsreis of reisorganisatie."],
    ["Free, Pro and Agency pricing — GlobeTrotr", "Compare GlobeTrotr Free, Pro and Agency. Choose the travel planner for your holiday, group trip or travel organisation."],
  ],
} as const;

export function marketingHead(path: MarketingPath, locale: MarketingLocale) {
  const [title, description] = COPY[path][locale === "en-GB" ? 1 : 0];
  const url = (language: MarketingLocale) => `${PUBLIC_SITE_ORIGIN}${localizedMarketingPath(path, language)}`;
  const english = locale === "en-GB";
  const image = english ? PUBLIC_SITE_SEO.image.replace("social-preview.png", "social-preview-en.png") : PUBLIC_SITE_SEO.image;
  const imageAlt = english ? "GlobeTrotr — Your whole trip, planned together in one place." : PUBLIC_SITE_SEO.imageAlt;
  return {
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:url", content: url(locale) }, { property: "og:locale", content: english ? "en_GB" : "nl_NL" },
      { property: "og:image", content: image }, { property: "og:image:alt", content: imageAlt },
      { name: "twitter:title", content: title }, { name: "twitter:description", content: description },
      { name: "twitter:image", content: image }, { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [
      { rel: "canonical", href: url(locale) },
      { rel: "alternate", hrefLang: "nl", href: url("nl-NL") },
      { rel: "alternate", hrefLang: "en", href: url("en-GB") },
      { rel: "alternate", hrefLang: "x-default", href: url("nl-NL") },
    ],
  };
}
