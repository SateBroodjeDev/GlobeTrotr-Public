import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/algemene-voorwaarden")({
  head: () => ({
    meta: [
      { title: "Algemene voorwaarden — GlobeTrotr" },
      { name: "description", content: "Algemene voorwaarden voor het gebruik van GlobeTrotr." },
    ],
  }),
  component: TermsPage,
});
export function TermsPage() {
  const { text } = useLocale();
  return (
    <LegalPage
      icon={Scale}
      badge={text("Gebruiksvoorwaarden", "Terms of use")}
      title={text("Algemene voorwaarden", "Terms and conditions")}
      intro={text(
        "Deze voorwaarden gelden voor de GlobeTrotr-reisplanner, de publieke beta en betaalde abonnementen.",
        "These terms apply to the GlobeTrotr travel planner, public beta and paid subscriptions.",
      )}
      version={text("Versie 9 oktober 2026", "Version 9 October 2026")}
    >
      <LegalSection title={text("1. Wie wij zijn en toepasselijkheid", "1. Who we are and scope")}>
        <p>
          {text(
            "Domenico Rokers, handelend onder de naam GlobeTrotr (nog niet ingeschreven bij de KvK), postadres (geen bezoekadres): Gedempte Oude Gracht 95, 2011 GT Haarlem. Contact: info@globetrotr.nl. Deze voorwaarden gelden zodra je een account maakt of GlobeTrotr gebruikt. Afwijkende schriftelijke afspraken gaan voor.",
            "Domenico Rokers, operating under the name GlobeTrotr (not yet registered with the Dutch Chamber of Commerce), postal address (not a visiting address): Gedempte Oude Gracht 95, 2011 GT Haarlem. Contact: info@globetrotr.nl. These terms apply when you create an account or use GlobeTrotr. Different written agreements take precedence.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={text("2. De dienst en beta", "2. The service and beta")}>
        <p>
          {text(
            "GlobeTrotr helpt reizen, routes, boekingsgegevens, uitgaven, documenten en samenwerking te organiseren. GlobeTrotr verkoopt geen reis en is geen vervoerder, reisorganisator of boekingsbemiddelaar. De beta kan wijzigen, fouten bevatten of tijdelijk niet beschikbaar zijn. Controleer essentiële tijden, prijzen, documenten en reisadviezen altijd bij de officiële aanbieder.",
            "GlobeTrotr helps organise trips, routes, booking details, expenses, documents and collaboration. GlobeTrotr does not sell travel and is not a carrier, travel organiser or booking intermediary. The beta may change, contain errors or be temporarily unavailable. Always verify essential times, prices, documents and travel advice with the official provider.",
          )}
        </p>
      </LegalSection>
      <LegalSection
        title={text("3. Account en toegestaan gebruik", "3. Account and acceptable use")}
      >
        <p>
          {text(
            "Je bent minimaal 16 jaar, verstrekt juiste gegevens en beveiligt je account. Gebruik de dienst rechtmatig en respecteer rechten en privacy van anderen. Je mag beveiliging of toegangsgrenzen niet omzeilen, de dienst niet verstoren en geen malware, onrechtmatige inhoud of gegevens zonder gebruiksrecht uploaden.",
            "You are at least 16, provide accurate details and secure your account. Use the service lawfully and respect others’ rights and privacy. You must not bypass security or access boundaries, disrupt the service, or upload malware, unlawful content or data you have no right to use.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={text("4. Jouw inhoud en delen", "4. Your content and sharing")}>
        <p>
          {text(
            "Je houdt de rechten op je inhoud en bent verantwoordelijk voor wat je invoert of openbaar deelt. Je geeft GlobeTrotr uitsluitend de beperkte toestemming om die inhoud te hosten, verwerken, tonen, beveiligen en technisch kopiëren voor het leveren en herstellen van de dienst. Deze toestemming eindigt na verwijdering, behoudens tijdelijke back-ups en wettelijke bewaarplichten.",
            "You retain rights to your content and are responsible for what you enter or publish. You grant GlobeTrotr only the limited permission to host, process, display, secure and technically copy that content to provide and recover the service. This permission ends after deletion, subject to temporary backups and legal retention duties.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={text("Gebruik en behandeling van meldingen", "Use and handling of reports")}>
        <p>{text("Inhoud kun je zonder account melden via ", "You can report content without an account through ")}<Link to="/contact" className="underline">{text("Contact", "Contact")}</Link>. {text("Vermeld de exacte vindplaats, een onderbouwde uitleg en een verklaring te goeder trouw. Een mens beoordeelt de melding zonder onnodige vertraging. We kunnen onrechtmatige inhoud of inhoud die deze voorwaarden schendt verwijderen of de toegang beperken. Een melding veroorzaakt geen automatische verwijdering. We informeren de melder en, bij een beperking, de betrokken maker wanneer elektronische contactgegevens bekend zijn, met feiten, grondslag, maatregel, bereik, duur en mogelijkheden voor herbeoordeling. Vraag herbeoordeling via info@globetrotr.nl met het dossiernummer en je redenen. De gang naar de rechter en toepasselijke buitengerechtelijke mogelijkheden blijven open.", "Provide the exact location, a substantiated explanation and a good-faith declaration. A human reviews notices without undue delay. We may remove unlawful content or content violating these terms, or restrict access. A notice does not automatically remove content. We inform the reporter and, for restrictions, the affected creator where electronic contact details are known, explaining facts, basis, measure, scope, duration and reconsideration options. Request reconsideration via info@globetrotr.nl with the case number and your reasons. Judicial and applicable out-of-court remedies remain available.")}</p>
      </LegalSection>
      <LegalSection title={text("5. Plannen, Paddle en betaling", "5. Plans, Paddle and payment")}>
        <p>
          {text(
            "De actuele mogelijkheden en tarieven staan op de prijspagina. GlobeTrotr biedt Free-, Pro- en Agency-accounts aan. Betaalde maandabonnementen en eenmalige maanden worden via Paddle afgesloten. Paddle verkoopt het digitale abonnement als Merchant of Record. De koop en betaling vallen daarom ook onder de kopersvoorwaarden en privacyverklaring van Paddle die vóór bestellen worden getoond. Paddle int de betaling, berekent toepasselijke belasting en verstrekt betalingsbewijs, factuur en eventuele creditnota; GlobeTrotr levert de software, accounttoegang en productondersteuning. De checkout toont de definitieve totaalprijs, valuta, looptijd en, alleen bij een abonnement, de automatische verlenging voordat je bestelt.",
            "Current features and rates are shown on the pricing page. GlobeTrotr offers Free, Pro and Agency accounts. Paid monthly subscriptions and one-time months are purchased through Paddle. Paddle sells the digital subscription as Merchant of Record. The purchase and payment are therefore also subject to Paddle's buyer terms and privacy notice shown before ordering. Paddle collects payment, calculates applicable tax and issues the receipt, invoice and any credit note; GlobeTrotr provides the software, account access and product support. Checkout shows the final total price, currency, term and, for subscriptions only, automatic renewal before you order.",
          )}
        </p>
      </LegalSection>
      <LegalSection
        title={text("6. Looptijd, opzegging en herroeping", "6. Term, cancellation and withdrawal")}
      >
        <p>
          {text(
            "Je kunt een betaald abonnement vóór de volgende verlengdatum opzeggen; toegang blijft normaal bestaan tot het einde van de betaalde periode. Een eenmalige maand eindigt vanzelf en hoeft niet te worden opgezegd. Voor consumenten bij een online dienstenovereenkomst geldt in beginsel een wettelijke bedenktijd van 14 dagen vanaf het sluiten van de overeenkomst. Als je uitdrukkelijk vraagt om de dienst binnen die periode te starten, kan bij herroeping een evenredig bedrag verschuldigd zijn voor het reeds geleverde deel. Lees het terugbetalingsbeleid voor de procedure.",
            "You can cancel a paid subscription before the next renewal date; access normally continues until the end of the paid period. A one-time month ends automatically and does not need to be cancelled. Consumers entering an online services contract generally have a statutory 14-day withdrawal period from conclusion of the contract. If you expressly request the service to begin during that period, a proportionate amount may be due for the part already supplied when you withdraw. See the refund policy for the procedure.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={text("7. Wijziging en beëindiging", "7. Changes and termination")}>
        <p>
          {text(
            "Je kunt je account exporteren en verwijderen via Accountinstellingen. Wij kunnen toegang beperken bij misbruik, een beveiligingsrisico of een ernstige schending en geven waar redelijk een uitleg en gelegenheid tot herstel. Over wezenlijke nadelige wijzigingen in een betaald abonnement informeren we vooraf; je kunt dan vóór ingang opzeggen.",
            "You can export and delete your account through Account settings. We may restrict access for misuse, a security risk or a serious breach and, where reasonable, provide an explanation and opportunity to remedy. We notify you in advance of material adverse changes to a paid subscription; you may cancel before they take effect.",
          )}
        </p>
        <p>{text("Een betaalde digitale dienst moet beantwoorden aan de overeenkomst. De aanduiding beta beperkt je wettelijke consumentenrechten niet. Je behoudt recht op noodzakelijke updates, waaronder beveiligingsupdates, en op de toepasselijke wettelijke remedies bij een gebrek, zoals herstel, prijsvermindering of ontbinding. Voor wezenlijk nadelige wijzigingen gelden de wettelijke eisen aan een geldige reden, informatie vooraf op een duurzame gegevensdrager en het recht om de overeenkomst te ontbinden; alleen verwijzen naar opzeggen vóór de volgende verlenging is daarvoor niet voldoende.", "A paid digital service must conform to the contract. Calling it beta does not limit your statutory consumer rights. You retain rights to necessary updates, including security updates, and applicable statutory remedies for defects, such as correction, price reduction or termination. Material adverse changes are subject to statutory requirements for a valid reason, advance information on a durable medium and the right to terminate the contract; merely referring to cancellation before the next renewal is insufficient.")}</p>
      </LegalSection>
      <LegalSection title={text("8. Intellectuele eigendom", "8. Intellectual property")}>
        <p>
          {text(
            "De software, vormgeving en GlobeTrotr-merken blijven van GlobeTrotr of haar licentiegevers. Je ontvangt een persoonlijk, beperkt, niet-overdraagbaar gebruiksrecht zolang je aan deze voorwaarden voldoet. Open-sourceonderdelen blijven onder hun eigen licenties vallen.",
            "The software, design and GlobeTrotr marks remain owned by GlobeTrotr or its licensors. You receive a personal, limited, non-transferable right to use the service while complying with these terms. Open-source components remain subject to their own licences.",
          )}
        </p>
      </LegalSection>
      <LegalSection title={text("9. Aansprakelijkheid", "9. Liability")}>
        <p>
          {text(
            "GlobeTrotr is aansprakelijk voor zover dwingend recht dat vereist. Niets beperkt aansprakelijkheid voor opzet, bewuste roekeloosheid, overlijden of letsel door nalatigheid, of aansprakelijkheid die wettelijk niet mag worden beperkt. Voor zakelijke gebruikers is aansprakelijkheid, voor zover wettelijk toegestaan, beperkt tot directe schade en het bedrag dat in de voorafgaande twaalf maanden voor de betreffende dienst is betaald. Wettelijke consumentenrechten blijven gelden.",
            "GlobeTrotr is liable where mandatory law requires it. Nothing limits liability for intent, deliberate recklessness, death or personal injury caused by negligence, or liability that cannot legally be limited. For business users, to the extent permitted by law, liability is limited to direct loss and the amount paid for the relevant service in the preceding twelve months. Statutory consumer rights remain applicable.",
          )}
        </p>
      </LegalSection>
      <LegalSection
        title={text(
          "10. Privacy, berichten, klachten en recht",
          "10. Privacy, messages, complaints and law",
        )}
      >
        <p>
          {text(
            "De privacyverklaring beschrijft de verwerking via de zelf beheerde applicatieserver, Supabase, de SMTP-leverancier en Paddle. Noodzakelijke account-, beveiligings-, uitnodigings- en serviceberichten mogen per e-mail worden verzonden; commerciële e-mail volgt alleen met een geldige afzonderlijke grondslag en afmeldmogelijkheid. Meld productklachten via info@globetrotr.nl; we proberen binnen 14 dagen inhoudelijk te reageren. Vragen over een Paddle-betaling kunnen ook via de contactmogelijkheid op het Paddle-betalingsbewijs worden ingediend. Nederlands recht is van toepassing, zonder verlies van dwingende consumentenbescherming in je woonland. Geschillen gaan naar de volgens de wet bevoegde rechter.",
            "The privacy notice describes processing through the self-managed application server, Supabase, the SMTP provider and Paddle. Necessary account, security, invitation and service messages may be sent by email; commercial email is only sent with a separate valid legal basis and unsubscribe option. Submit product complaints to info@globetrotr.nl; we aim to respond substantively within 14 days. Questions about a Paddle payment may also be submitted through the contact option on the Paddle receipt. Dutch law applies without depriving you of mandatory consumer protection in your country of residence. Disputes go to the court competent under applicable law.",
          )}
        </p>
        <p>
          <Link to="/privacy" className="text-primary underline">
            {text("Lees de privacyverklaring", "Read the privacy notice")}
          </Link>
          {" · "}
          <Link to="/refund-policy" className="text-primary underline">
            {text("Lees het terugbetalingsbeleid", "Read the refund policy")}
          </Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
