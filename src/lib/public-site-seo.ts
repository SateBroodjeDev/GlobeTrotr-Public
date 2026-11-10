import { PUBLIC_SITE_ORIGIN } from "./site-routing.ts";

export const PUBLIC_SOCIAL_PROFILES = {
  instagram: "https://www.instagram.com/GlobeTrotrApp/",
  tiktok: "https://www.tiktok.com/@globetrotrapp",
} as const;

export const PUBLIC_SITE_SEO = {
  title: "GlobeTrotr — Samen je rondreis plannen",
  description: "Plan samen je rondreis met GlobeTrotr. Bewaar routes en boekingen, verdeel reiskosten en leg herinneringen vast in je reisdagboek. Start gratis.",
  image: `${PUBLIC_SITE_ORIGIN}/assets/brand/social-preview.png`,
  imageAlt: "GlobeTrotr — Jullie hele rondreis, samen geregeld op één plek.",
} as const;

export const PUBLIC_SITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${PUBLIC_SITE_ORIGIN}/#organization`,
      name: "GlobeTrotr",
      url: `${PUBLIC_SITE_ORIGIN}/`,
      logo: {
        "@type": "ImageObject",
        url: `${PUBLIC_SITE_ORIGIN}/assets/brand/logo.png`,
        width: 1024,
        height: 1024,
      },
      sameAs: Object.values(PUBLIC_SOCIAL_PROFILES),
    },
    {
      "@type": "WebSite",
      "@id": `${PUBLIC_SITE_ORIGIN}/#website`,
      name: "GlobeTrotr",
      url: `${PUBLIC_SITE_ORIGIN}/`,
      publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_ORIGIN}/#application`,
      name: "GlobeTrotr",
      applicationCategory: "TravelApplication",
      operatingSystem: "Web",
      url: `${PUBLIC_SITE_ORIGIN}/`,
      publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  ],
} as const;
