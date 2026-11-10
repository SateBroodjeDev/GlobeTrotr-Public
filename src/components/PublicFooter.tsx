import { publicStatusUrl } from "@/lib/platform-status-link";
import { ArrowUpRight } from "lucide-react";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { BrandLogo } from "@/components/BrandLogo";
import { useLocale } from "@/lib/locale";
import { openPrivacyChoices } from "@/lib/privacy-consent";
import { PUBLIC_SOCIAL_PROFILES } from "@/lib/public-site-seo";

export function PublicFooter({ tagline }: { tagline: string }) {
  const { text, locale } = useLocale();
  const groups = [
    {
      title: text("Ontdek", "Explore"),
      links: [
        ["/features", text("Mogelijkheden", "Features")],
        ["/demo", text("Interactieve demo", "Interactive demo")],
        ["/for-groups", text("Samen reizen", "Group travel")],
        ["/pricing", text("Prijzen", "Pricing")],
      ],
    },
    {
      title: text("GlobeTrotr", "GlobeTrotr"),
      links: [
        ["/about", text("Over ons", "About us")],
        ["/for-agencies", text("Voor reisprofessionals", "For travel professionals")],
        ["/contact", text("Contact", "Contact")],
      ],
    },
    {
      title: text("Informatie", "Information"),
      links: [
        ["/updates", text("Wat is er nieuw?", "What's new?")],
        [publicStatusUrl(locale), text("Platformstatus", "Platform status")],
      ],
    },
    {
      title: text("Privacy & voorwaarden", "Privacy & terms"),
      links: [
        ["/privacy", text("Privacyverklaring", "Privacy notice")],
        ["/terms", text("Voorwaarden", "Terms")],
        ["/refund-policy", text("Terugbetalingen", "Refunds")],
        ["/beta", text("Release en testvoorwaarden", "Release and test terms")],
      ],
    },
  ];
  return (
    <footer className="public-footer mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <div className="grid gap-10 rounded-3xl border bg-card/40 p-6 sm:p-8 lg:grid-cols-[.85fr_2fr] lg:gap-14">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{tagline}</p>
          <nav
            aria-label={text("Volg GlobeTrotr", "Follow GlobeTrotr")}
            className="mt-4 flex flex-wrap gap-x-5 text-sm"
          >
            {[
              ["Instagram", PUBLIC_SOCIAL_PROFILES.instagram],
              ["TikTok", PUBLIC_SOCIAL_PROFILES.tiktok],
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium"
                aria-label={text(
                  `GlobeTrotrApp op ${name} (opent in een nieuw tabblad)`,
                  `GlobeTrotrApp on ${name} (opens in a new tab)`,
                )}
              >
                {name}
                <ArrowUpRight className="size-3.5" />
              </a>
            ))}
          </nav>
        </div>
        <nav
          aria-label={text("Voetnavigatie", "Footer navigation")}
          className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4"
        >
          {groups.map((group, index) => (
            <div key={group.title}>
              <h2 className="mb-2 text-sm font-semibold">{group.title}</h2>
              <ul className="text-sm text-muted-foreground">
                {group.links.map(([to, label]) => (
                  <li key={to}>
                    <Link to={to} reloadDocument={to.startsWith("https://")} className="inline-flex min-h-10 items-center py-1 leading-snug">
                      {label}
                    </Link>
                  </li>
                ))}
                {index === groups.length - 1 && (
                  <li>
                    <button
                      type="button"
                      onClick={openPrivacyChoices}
                      className="min-h-10 py-1 text-left leading-snug"
                    >
                      {text("Privacykeuzes", "Privacy choices")}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        {text("Data via", "Data by")} OpenStreetMap · Open-Meteo/MET Norway · Frankfurter/ECB
      </p>
    </footer>
  );
}
