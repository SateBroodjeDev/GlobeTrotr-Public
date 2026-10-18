export type PublicChangeKind = "new" | "improved" | "fixed" | "secure";

export type PublicChange = {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  kind: PublicChangeKind;
};

export type PublicRelease = {
  id: string;
  version: string;
  publishedAt: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  changes: PublicChange[];
};

export const PUBLIC_BETA_STATUS = {
  label: "Meedenken en testen",
  labelEn: "Feedback and testing",
  description:
    "Help GlobeTrotr verbeteren met je eigen reissituaties. Deel wat goed werkt en waar je vastloopt. Bij Wat is er nieuw vind je afgeronde verbeteringen.",
  descriptionEn:
    "Help improve GlobeTrotr with your own travel situations. Share what works well and where you get stuck. What's new lists completed improvements.",
  unavailable: [] as Array<{ nl: string; en: string }>,
} as const;

/** Public-safe, grouped release notes, with the latest release first. */
export const PUBLIC_RELEASES: PublicRelease[] = [
  {
    id: "2026-10-13-team-and-mail",
    version: "1.0.1",
    publishedAt: "2026-10-18T00:00:00+02:00",
    title: "Een rustigere reisplanner en teamwerkplek",
    titleEn: "A calmer travel planner and team workspace",
    summary: "Je reizen staan hoger in het overzicht en jaarcijfers klap je open wanneer je ze nodig hebt. Medewerkers, mailboxen en financiële lijsten zijn overzichtelijker ingedeeld. Privacyverzoeken openen het bestaande formulier. Advertentieblokken en de bijbehorende keuzevensters zijn verwijderd.",
    summaryEn: "Your trips appear higher in the overview, with yearly statistics available when you expand them. Staff, mailboxes and financial lists have clearer layouts. Privacy requests open the existing form. Advertising blocks and their choice windows have been removed.",
    changes: [
      {
        kind: "improved",
        title: "Rustigere pagina’s zonder advertentieblokken",
        titleEn: "Calmer pages without advertising blocks",
        description: "De advertentie-integratie en de bijbehorende privacyteksten en keuzevensters zijn verwijderd. Taalvoorkeuren en optionele gebruiksstatistieken beheer je nog steeds via Privacykeuzes.",
        descriptionEn: "The advertising integration and its privacy text and choice windows have been removed. Language preferences and optional usage statistics remain available through Privacy choices.",
      },
      {
        kind: "improved",
        title: "Sneller bij je reizen",
        titleEn: "Get to your trips sooner",
        description: "De kop, je volgende reis en het jaaroverzicht staan samen in één compacte kaart. Jaarcijfers en delen blijven beschikbaar achter een uitklapregel. Ook de mobiele filters nemen minder ruimte in.",
        descriptionEn: "The heading, next trip and yearly overview share one compact card. Yearly statistics and sharing remain available in an expandable section. Mobile filters also take up less space.",
      },
      {
        kind: "improved",
        title: "Rustiger bedrijfsbeheer",
        titleEn: "Calmer company administration",
        description: "Bestaande medewerkers staan bovenaan; toevoegen opent een apart venster met duidelijke groepen en rechten. Mailboxpanelen zijn uitgelijnd en facturen en transacties kun je apart uitklappen.",
        descriptionEn: "Existing staff appear first, while adding someone opens a separate window with clearly grouped fields and permissions. Mailbox panels are aligned, and invoices and transactions expand separately.",
      },
      {
        kind: "fixed",
        title: "Privacyacties met duidelijke vervolgstappen",
        titleEn: "Privacy actions with clear next steps",
        description: "Verzoek indienen opent het privacyformulier bij je account. Zonder account opent het contactformulier met Privacy geselecteerd.",
        descriptionEn: "Submitting a request opens the privacy form in your account. Without an account, the contact form opens with Privacy selected.",
      },
      {
        kind: "fixed",
        title: "Mailboxtoegang blijft correct",
        titleEn: "Mailbox access stays correct",
        description: "Een inactief postvak verschijnt niet meer via een oud lidmaatschap. De eigenaar behoudt beheerrechten als daarnaast een beperkter lidmaatschap bestaat.",
        descriptionEn: "An inactive mailbox no longer appears through an old membership. Owners retain management access when a more restricted membership also exists.",
      },
      {
        kind: "improved",
        title: "Privacykeuzes bereikbaar op mobiel",
        titleEn: "Privacy choices remain accessible on mobile",
        description: "De knoppen voor alleen noodzakelijke opslag en het bewaren van je keuze blijven zichtbaar terwijl je de uitleg doorleest.",
        descriptionEn: "The necessary-only and save-choice buttons remain visible while you scroll through the explanation.",
      },
      {
        kind: "improved",
        title: "Overzichtelijk mailboxbeheer",
        titleEn: "Clearer mailbox management",
        description: "Mailboxgegevens, verbindingsstatus en toegang staan overzichtelijk bij elkaar. Je ziet direct wie eigenaar is en welke toegang anderen hebben.",
        descriptionEn: "Mailbox details, connection status and access are grouped clearly. See who owns a mailbox and which access other team members have.",
      },
      {
        kind: "new",
        title: "Leesstatus en ongewenste mail",
        titleEn: "Read status and junk mail",
        description: "Ongelezen gesprekken hebben een stip en vet onderwerp. Openen markeert ze als gelezen; je kunt ze ook weer ongelezen maken. Ongewenste berichten staan in een aparte map.",
        descriptionEn: "Unread conversations have a dot and a bold subject. Opening them marks them as read, and you can mark them unread again. Junk messages appear in a separate folder.",
      },
      {
        kind: "fixed",
        title: "Mailmeldingen sluiten bij afhandelen",
        titleEn: "Email notifications close when handled",
        description: "De melding voor inkomende bedrijfsmail verdwijnt bij openen, archiveren of verwijderen. Bij gedeelde postvakken volgt dit de gezamenlijke leesstatus.",
        descriptionEn: "Incoming company email notifications disappear when a message is opened, archived or deleted. Shared mailboxes use the shared read status.",
      },
      {
        kind: "improved",
        title: "Minder wachten bij teruggaan naar reizen",
        titleEn: "Less waiting when returning to trips",
        description: "Je reizen worden niet onnodig opnieuw geladen wanneer dezelfde sessie wordt vernieuwd. Onafhankelijke inlogcontroles worden tegelijk uitgevoerd.",
        descriptionEn: "Trips are no longer unnecessarily reloaded when the same session refreshes. Independent sign-in checks run in parallel.",
      },
      {
        kind: "secure",
        title: "Teamlogin en centraal uitloggen",
        titleEn: "Team sign-in and central sign-out",
        description: "Teamleden gebruiken hun eigen centrale teamidentiteit. Uitloggen uit GlobeTrotr sluit ook de centrale teamsessie; bestaande reizen en persoonlijke accountgegevens blijven behouden.",
        descriptionEn: "Team members use their own central team identity. Signing out of GlobeTrotr also ends the central team session while existing trips and personal account details are preserved.",
      },
      {
        kind: "improved",
        title: "Privacy in acht overzichtelijke onderwerpen",
        titleEn: "Privacy in eight clear topics",
        description: "Lees de kern en open alleen de uitleg die je nodig hebt. Gegevensgebruik, cookies, bewaartermijnen en je rechten staan bij elkaar, in het Nederlands en Engels.",
        descriptionEn: "Read the essentials and expand only the explanation you need. Data use, cookies, retention periods and your rights are grouped together in Dutch and English.",
      },
      {
        kind: "new",
        title: "Privacykeuzes bij je account",
        titleEn: "Privacy choices with your account",
        description: "De website en portal delen je keuzes. Als je bent ingelogd, worden ze ook bij je account opgeslagen zodat je ze op een ander apparaat kunt gebruiken. Analytics blijft optioneel.",
        descriptionEn: "The website and portal share your choices. When signed in, your choices are also saved with your account so you can use them on another device. Analytics remains optional.",
      },
      {
        kind: "fixed",
        title: "Automatische mails in de gekozen taal",
        titleEn: "Automated emails in your selected language",
        description: "Regionale taalinstellingen worden herkend als Nederlands of Engels. Zo krijgen onder andere uitnodigingen en notificaties de juiste tekst, knoppen en voettekst. Zelfgeschreven berichten worden niet vertaald.",
        descriptionEn: "Regional language settings are recognised as Dutch or English. Invitations and notifications receive the matching text, buttons and footer. Manually written messages are not translated.",
      },
    ],
  },
  {
    id: "2026-10-08-1-0-0",
    version: "1.0.0",
    publishedAt: "2026-10-08T00:00:00+02:00",
    title: "GlobeTrotr 1.0: van reisidee tot onderweg",
    titleEn: "GlobeTrotr 1.0: from travel idea to life on the road",
    summary:
      "De eerste volledige release brengt routes, verblijf, vervoer, reisgenoten, kosten en herinneringen samen. Plan je reis, vergelijk mogelijkheden en neem je informatie mee op pad, met een eigen omgeving voor reisorganisaties.",
    summaryEn:
      "The first full release brings routes, accommodation, transport, travel companions, costs and memories together. Plan your trip, compare options and take your information with you, with a dedicated workspace for travel organisations.",
    changes: [
      {
        kind: "improved",
        title: "Jouw kaart en dagoverzicht",
        titleEn: "Your map and daily overview",
        description: "Koppel hotels en activiteiten zelf aan een routeplaats of kies een eigen kaartpunt. Filter route, hotels en activiteiten apart. De dagplanning toont ook lege dagen, overnachtingen en ontbrekende gegevens, met aankomst van nachtvluchten op de juiste dag.",
        descriptionEn: "Link hotels and activities to a route place or choose a separate map marker. Filter route, hotels and activities independently. Daily planning includes empty days, overnight stays and missing details, with overnight flight arrivals on the right day.",
      },
      {
        kind: "improved",
        title: "Eén kaartpunt voor dezelfde locatie",
        titleEn: "One map marker for the same location",
        description: "Bekijk activiteiten, verblijven en kosten op dezelfde locatie samen in één kaartmarkering. Kies bij een activiteit een locatie en of je deze op de kaart wilt tonen. Je boekingen en herhaalde routebezoeken blijven behouden.",
        descriptionEn: "View activities, stays and expenses within the same known town together in one map marker. Route stops follow calendar order and popup bookings follow date and start time. Choose an activity's location and whether to show it on the map. Your bookings and repeat route visits are retained.",
      },
      {
        kind: "fixed",
        title: "Je reisnachten en cijfers duidelijk in beeld",
        titleEn: "Clear trip nights and insights",
        description: "Bekijk reisdagen, overnachtingen en routepunten boven het reisoverzicht. Geboekte en nog ontbrekende nachten worden apart getoond, ook wanneer verblijven alleen als boeking zijn ingevoerd. Open alle statistieken vanuit dit overzicht.",
        descriptionEn: "See trip days, nights and route stops above the trip overview. Booked and still-missing nights are shown separately, including stays entered only as bookings. Open all insights directly from this summary.",
      },
      {
        kind: "improved",
        title: "Verblijfsduur kiezen en boekingen op datum",
        titleEn: "Choose stay length and view bookings by date",
        description: "Kies bij ontbrekende overnachtingen het aantal nachten voordat je de hotelzoeker opent. De uitcheckdatum past mee aan. Beheer alle boekingen in één lijst op datum en begintijd, zonder categorieblokken.",
        descriptionEn: "Choose the number of missing nights before opening hotel search. The check-out date updates accordingly. Manage all bookings in one list ordered by date and start time, without category sections.",
      },
      {
        kind: "improved",
        title: "Routes die aansluiten op jouw vervoer",
        titleEn: "Routes that fit your transport",
        description: "Kies vervoer per etappe en bereken auto-, fiets- en wandeltrajecten over echte wegen. Bekijk afstand, reistijd en een routevoorstel voordat je wijzigingen toepast. Geboekte heen- en terugreizen staan in het routeoverzicht, met afzonderlijke trajecten naar en vanaf de luchthaven. Vluchten verbinden vertrek en aankomst; er wordt geen automatische autorit terug naar het beginpunt toegevoegd.",
        descriptionEn: "Choose transport for each stage and calculate driving, cycling and walking routes on real roads. Review distance, travel time and a route proposal before applying changes. Booked outbound and return journeys appear in the route overview, with separate stages to and from the airport. Flights connect departure and arrival; no automatic drive back to the starting point is added.",
      },
      {
        kind: "improved",
        title: "Verblijf en huurauto in de bestaande zoekers",
        titleEn: "Accommodation and car rental in the existing search tools",
        description: "Zoek hotels en huurauto’s met je reislocaties, datums en voorkeuren. Voeg resultaten toe aan de Vergelijker en open de boekingslink wanneer je wilt boeken. CJ-partnerlinks zijn geïntegreerd bij de resultaten; de losse Booking.com-widget en extra knop zijn verwijderd.",
        descriptionEn: "Search for hotels and rental cars using your trip locations, dates and preferences. Add results to Comparison and open the booking link when you want to book. CJ affiliate links are integrated with results; the separate Booking.com widget and extra button have been removed.",
      },
      {
        kind: "fixed",
        title: "Huurautoaanvragen met de juiste zoekgegevens",
        titleEn: "Car rental requests with the correct search details",
        description: "De huurautozoeker verstuurt de datums, tijden en coördinaten in het formaat van de aanbieder. Ongeldige zoekgegevens, ontbrekende configuratie en een bereikte zoeklimiet krijgen een gerichte melding.",
        descriptionEn: "The rental car search sends dates, times and coordinates in the provider’s format. Invalid search details, missing configuration and an exhausted search quota receive specific messages.",
      },
      {
        kind: "improved",
        title: "Samen reizen met een rustiger deelnemersoverzicht",
        titleEn: "Travel together with a cleaner participant overview",
        description: "Nodig reisgenoten afzonderlijk of samen uit en beheer hun toegang per persoon. De overbodige balk ‘Rol toepassen’ en bijbehorende selectievakjes zijn verwijderd; vergelijken, stemmen en samen plannen blijven onderdeel van de reis.",
        descriptionEn: "Invite travel companions individually or together and manage access for each person. The redundant ‘Apply role’ bar and its checkboxes have been removed; comparison, voting and shared planning remain part of the trip.",
      },
      {
        kind: "fixed",
        title: "Kalender en verblijfcontrole beter bereikbaar",
        titleEn: "Easier access to calendars and accommodation checks",
        description: "Abonneer je agenda op je reisplanning en beheer de koppeling bij de juiste reis. Op mobiel opent een melding over ontbrekende hotelnachten rechtstreeks de verblijfcontrole.",
        descriptionEn: "Subscribe your calendar to your travel schedule and manage the connection for the relevant trip. On mobile, a notice about missing hotel nights opens the accommodation check directly.",
      },
      {
        kind: "improved",
        title: "Reisinformatie mee voor onderweg",
        titleEn: "Travel information to take on the road",
        description: "Bewaar je offline reispakket met planning, beschikbare documenten en reisgegevens. Updates, synchronisatie en opslagproblemen zijn zichtbaar, terwijl persoonlijke paklijsten en vertrekcontroles helpen bij de voorbereiding.",
        descriptionEn: "Save your offline trip pack with your schedule, available documents and travel information. Updates, synchronisation and storage issues are visible, while personal packing lists and departure checks help you prepare.",
      },
      {
        kind: "improved",
        title: "Vluchten en meldingen voor jouw reisdatum",
        titleEn: "Flights and notifications for your travel date",
        description: "Controleer vluchten voor de gekozen datum en bekijk wijzigingen voordat je ze overneemt. Pro houdt vluchtinformatie bij met statusmeldingen rond vertrek; e-mail-, push- en accountmeldingen volgen je voorkeuren.",
        descriptionEn: "Check flights for the selected date and review changes before accepting them. Pro keeps flight information up to date with status notifications around departure; email, push and account notifications follow your preferences.",
      },
      {
        kind: "new",
        title: "Zakelijke postvakken vanuit Corporate Admin",
        titleEn: "Business mailboxes from Corporate Admin",
        description: "Beheer gedeelde en persoonlijke postvakken vanuit de bedrijfsomgeving. Postvakken op de GlobeTrotr-mailserver worden vanuit Corporate Admin aangemaakt en gekoppeld, met afzonderlijke status voor aanmaak en synchronisatie.",
        descriptionEn: "Manage shared and personal mailboxes from the corporate workspace. Mailboxes hosted on the GlobeTrotr mail server are created and connected from Corporate Admin, with separate provisioning and synchronisation status.",
      },
      {
        kind: "improved",
        title: "Agency-facturen en bedrijfsgegevens op één plek",
        titleEn: "Agency invoices and company details in one place",
        description: "Beheer juridische bedrijfsgegevens, klantfacturen en creditcorrecties in de Agency-omgeving. Facturen gebruiken vaste gegevens, unieke nummering en nauwkeurige bedragen en zijn beschikbaar voor afdruk en export.",
        descriptionEn: "Manage legal company details, client invoices and credit corrections in the Agency workspace. Invoices use fixed records, unique numbering and precise amounts, with print and export options.",
      },
      {
        kind: "secure",
        title: "Delen en privacy onder jouw controle",
        titleEn: "Sharing and privacy under your control",
        description: "Openbare profielen en reislinks tonen wat je bewust deelt. Persoonlijke dagboekteksten van andere reisgenoten blijven buiten je accountdownload.",
        descriptionEn: "Public profiles and trip links show what you deliberately share. Other travellers’ personal journal entries stay out of your account download.",
      },
    ],
  },
  {
    id: "2026-09-30-beta-0-9-5",
    version: "Beta 0.9.5",
    publishedAt: "2026-09-30T18:00:00+02:00",
    title: "Jouw reizen, profiel en vrienden",
    titleEn: "Your trips, profile and friends",
    summary:
      "Openbare reizigersprofielen, bezochte landen, vriendschappen en bewust gedeelde reizen, met Pro-herkenning en privacy voor Agency-accounts.",
    summaryEn:
      "Public traveler profiles, visited countries, friendships and deliberately shared trips, with Pro recognition and privacy for Agency accounts.",
    changes: [
      {
        kind: "new",
        title: "Eigen reizigersprofiel",
        titleEn: "Your traveler profile",
        description:
          "Kies een unieke profielnaam, schrijf een korte biografie en toon bezochte landen met vlaggen en alleen de reizen die je bewust openbaar deelt.",
        descriptionEn:
          "Choose a unique username, write a short biography and show visited countries with flags and only trips you deliberately share publicly.",
      },
      {
        kind: "new",
        title: "Vrienden onder reizigers",
        titleEn: "Friends among travelers",
        description:
          "Verstuur en beheer vriendschapsverzoeken met e-mail-, push- en accountmeldingen volgens de voorkeuren van de ontvanger.",
        descriptionEn:
          "Send and manage friend requests with email, push and account notifications according to the recipient's preferences.",
      },
      {
        kind: "improved",
        title: "Delen zonder centrale etalage",
        titleEn: "Sharing without a central directory",
        description:
          "Deel een directe reislink of je profielpagina. GlobeTrotr zet openbare reizen niet meer centraal op de homepage.",
        descriptionEn:
          "Share a direct trip link or your profile page. GlobeTrotr no longer lists public trips centrally on the homepage.",
      },
      {
        kind: "secure",
        title: "Profielprivacy per account",
        titleEn: "Profile privacy per account",
        description:
          "Een profiel is vrijwillig en vriendschapsverzoeken zijn apart instelbaar. Actieve Agency-accounts krijgen geen openbare reizigerspagina.",
        descriptionEn:
          "Profiles are optional and friend requests have a separate setting. Active Agency accounts do not receive a public traveler page.",
      },
    ],
  },
  {
    id: "2026-09-28-beta-0-9-3",
    version: "Beta 0.9.3",
    publishedAt: "2026-09-28T19:07:09+02:00",
    title: "Persoonlijk voorbereiden en professioneel beheren",
    titleEn: "Personal preparation and professional management",
    summary:
      "Paklijsten per persoon en voor de groep, betrouwbare vluchtcontrole en een zichtbare, volwaardige Agency-omgeving.",
    summaryEn:
      "Packing lists for each person and the group, reliable flight checks and a visible, complete Agency workspace.",
    changes: [
      {
        kind: "fixed",
        title: "Offline direct bereikbaar",
        titleEn: "Offline access restored",
        description:
          "De Offline-knop opent weer rechtstreeks het offline reispakket met bewaren, bijwerken, openen, synchroniseren en verwijderen.",
        descriptionEn:
          "The Offline button once again opens the offline trip pack directly, with save, update, open, sync and remove controls.",
      },
      {
        kind: "new",
        title: "Gezamenlijke en persoonlijke paklijsten",
        titleEn: "Shared and personal packing lists",
        description:
          "Open één groepspaklijst voor alle reisgenoten of kies een persoon. Ieder item bevat bagagetype, categorie en aantal.",
        descriptionEn:
          "Open one group packing list for all travellers or select a person. Every item includes baggage type, category and quantity.",
      },
      {
        kind: "improved",
        title: "Paklijstsjablonen op de juiste lijst",
        titleEn: "Packing templates on the right list",
        description:
          "Voeg een winter-, stads-, strand-, roadtrip- of zakensjabloon toe aan de gekozen groeps- of persoonlijke lijst, zonder bestaande items te verdubbelen.",
        descriptionEn:
          "Add a winter, city, beach, road trip or business template to the selected group or personal list without duplicating existing items.",
      },
      {
        kind: "improved",
        title: "Paklijst per tas gegroepeerd",
        titleEn: "Packing list grouped by bag",
        description:
          "Iedere gekozen paklijst toont totale voortgang en groepeert items onder handbagage, cabinebagage, ruimbagage en gezamenlijke bagage.",
        descriptionEn:
          "Every selected packing list shows overall progress and groups items under personal item, cabin baggage, checked baggage and shared baggage.",
      },
      {
        kind: "improved",
        title: "Startlijsten voor vertrek en boodschappen",
        titleEn: "Starter lists for departure and shopping",
        description:
          "Vul de vertrekcontrole of reisboodschappen met één knop met praktische standaardpunten; eigen en bestaande punten blijven behouden.",
        descriptionEn:
          "Fill the departure check or travel shopping list with practical standard items in one click while keeping custom and existing items.",
      },
      {
        kind: "improved",
        title: "Datumgebonden vluchtcontrole",
        titleEn: "Date-specific flight checks",
        description:
          "AeroDataBox zoekt voor de gekozen reisdatum en toont handmatige wijzigingen eerst als voorstel. Pro synchroniseert status, tijden, gate, terminal, incheckbalie en bagageband en gebruikt vlak voor vertrek live alerts met polling als vangnet.",
        descriptionEn:
          "AeroDataBox searches for the selected travel date and shows manual changes as a proposal first. Pro synchronises status, times, gate, terminal, check-in desk and baggage belt, using live alerts close to departure with polling as a fallback.",
      },
      {
        kind: "improved",
        title: "Routeplanning over echte wegen",
        titleEn: "Routing on real roads",
        description:
          "OpenRouteService berekent auto-, fiets- en wandelroutes met maximaal 200 punten. Tolwegen, veerboten, reistijd en rustmomenten zijn vooraf controleerbaar; toepassen gebeurt altijd bewust.",
        descriptionEn:
          "OpenRouteService calculates driving, cycling and walking routes with up to 200 points. Toll roads, ferries, travel time and breaks can be reviewed in advance; applying a proposal is always deliberate.",
      },
      {
        kind: "improved",
        title: "Volwaardige Agency-omgeving",
        titleEn: "Complete Agency workspace",
        description:
          "Agency blijft zichtbaar met klantbeheer, teamrechten, onboarding, eigen branding, subdomeinen, geverifieerde domeinen en eigen SMTP.",
        descriptionEn:
          "Agency remains visible with client management, team permissions, onboarding, custom branding, subdomains, verified domains and custom SMTP.",
      },
    ],
  },
  {
    id: "2026-09-26-beta-0-9-2",
    version: "Beta 0.9.2",
    publishedAt: "2026-09-26T11:47:36+02:00",
    title: "Een reis om te bewaren en te delen",
    titleEn: "A journey to keep and share",
    summary:
      "Het reisdagboek groeide uit tot een eigen ervaring met offline herinneringen, media, samenvattingen en een bewust gedeeld live reisverhaal.",
    summaryEn:
      "The travel journal became a dedicated experience with offline memories, media, summaries and a deliberately shared live travel story.",
    changes: [
      {
        kind: "new",
        title: "Uitgebreid reisdagboek",
        titleEn: "Extended travel journal",
        description:
          "Herbeleef je reis via een tijdlijn, galerij en kaart, bewaar gekozen inhoud offline en maak bewust een samenvatting of eigen PDF.",
        descriptionEn:
          "Relive your trip through a timeline, gallery and map, keep selected content offline and deliberately create a summary or personal PDF.",
      },
      {
        kind: "new",
        title: "Live reisverhaal",
        titleEn: "Live travel story",
        description:
          "Deel bewust openbare herinneringen, foto's en afgeschermde video's met bevestigde volgers; bezoekers kunnen liken en begrensd reageren zonder account.",
        descriptionEn:
          "Share deliberately public memories, photos and protected videos with confirmed followers; visitors can like and leave moderated comments without an account.",
      },
      {
        kind: "improved",
        title: "Dagboek als eigen bestemming",
        titleEn: "Journal as a dedicated destination",
        description:
          "Het dagboek heeft een eigen portaalpagina en opent vanuit iedere reis direct op de juiste herinneringen.",
        descriptionEn:
          "The journal has its own portal page and opens directly on the correct memories from every trip.",
      },
    ],
  },
  {
    id: "2026-09-25-beta-0-9-1",
    version: "Beta 0.9.1",
    publishedAt: "2026-09-25T17:10:00+02:00",
    title: "Slimmer plannen en duidelijker voorbereiden",
    titleEn: "Smarter planning and clearer preparation",
    summary:
      "Een brede beta-update voor route-import, samenwerken, offline gebruik, verblijfcontrole en een controleerbaar routevoorstel.",
    summaryEn:
      "A broad beta update for route imports, collaboration, offline use, accommodation checks and a reviewable route proposal.",
    changes: [
      {
        kind: "new",
        title: "Favoriete plaatsen",
        titleEn: "Favourite places",
        description: "Bewaar persoonlijke plaatsen en voeg ze later snel aan een andere reis toe.",
        descriptionEn: "Save personal places and quickly add them to another trip later.",
      },
      {
        kind: "new",
        title: "Gedeelde reislijsten",
        titleEn: "Shared trip lists",
        description:
          "Taken zijn te ordenen als vertrekcheck, boodschappenlijst of een eigen lijst, met verantwoordelijke en deadline.",
        descriptionEn:
          "Tasks can be organised as departure, shopping or custom lists, with an assignee and deadline.",
      },
      {
        kind: "new",
        title: "Groepen uitnodigen",
        titleEn: "Group invitations",
        description:
          "Nodig meerdere reizigers tegelijk uit, bekijk vooraf hun toegang en wijzig bestaande rollen in bulk.",
        descriptionEn:
          "Invite multiple travellers at once, preview their access and update existing roles in bulk.",
      },
      {
        kind: "improved",
        title: "Veilige reisvariant",
        titleEn: "Safe trip variant",
        description:
          "Bekijk vooraf wat wordt gekopieerd; toegang, documenten, betalingen en reserveringscodes blijven achter.",
        descriptionEn:
          "Preview what will be copied; access, documents, payments and reservation codes stay behind.",
      },
      {
        kind: "new",
        title: "Plaatsen langs de route",
        titleEn: "Places along the route",
        description:
          "Zoek rond een routeplaats naar horeca, activiteiten, bezienswaardigheden en praktische voorzieningen en voeg ze pas na controle toe.",
        descriptionEn:
          "Find food, activities, sights and practical services near a route stop and add them only after reviewing the result.",
      },
      {
        kind: "improved",
        title: "Eerlijke hotelvergelijking",
        titleEn: "Fair hotel comparison",
        description:
          "Vergelijk verblijfskandidaten met dezelfde bestemming, data, gasten en kamers, inclusief prijs, belastingen en voorwaarden.",
        descriptionEn:
          "Compare accommodation candidates using the same destination, dates, guests and rooms, including price, taxes and terms.",
      },
      {
        kind: "new",
        title: "Routevoorstel met controle",
        titleEn: "Route proposal with review",
        description:
          "Vergelijk de huidige stopvolgorde met een korter voorstel en een indicatie van afstand en reistijd. De route verandert pas na je bevestiging.",
        descriptionEn:
          "Compare the current stop order with a shorter proposal and estimated distance and travel time. The route only changes after your confirmation.",
      },
      {
        kind: "improved",
        title: "Ontbrekende verblijven per periode",
        titleEn: "Missing stays grouped by period",
        description:
          "Opeenvolgende ontbrekende nachten op dezelfde plaats worden als één duidelijke verblijfsperiode getoond.",
        descriptionEn:
          "Consecutive missing nights in the same place are shown as one clear accommodation period.",
      },
      {
        kind: "improved",
        title: "GPX-route vooraf controleren",
        titleEn: "Review a GPX route before import",
        description:
          "Een lokaal routevoorbeeld toont volgorde, selectie en bestaande punten voordat bestemmingen worden toegevoegd.",
        descriptionEn:
          "A local route preview shows order, selection and existing points before destinations are added.",
      },
      {
        kind: "improved",
        title: "Offline uitgaven beheren",
        titleEn: "Manage offline expenses",
        description:
          "Kies uitgaven afzonderlijk voor synchronisatie, verwijder een lokale regel en herken conflicten voordat servergegevens worden geraakt.",
        descriptionEn:
          "Select expenses individually for synchronisation, remove a local entry and identify conflicts before server data is affected.",
      },
    ],
  },
  {
    id: "2026-09-23-beta-0-9",
    version: "Beta 0.9",
    publishedAt: "2026-09-23T12:00:00+02:00",
    title: "Samen beslissen en voorbereid op reis",
    titleEn: "Decide together and travel prepared",
    summary:
      "Een grote productupdate voor vergelijken, samenwerken, Agency-intake, meldingen en gebruik onderweg.",
    summaryEn:
      "A major product update for comparison, collaboration, Agency intake, notifications and use while travelling.",
    changes: [
      {
        kind: "new",
        title: "Reisvergelijker en gezamenlijke keuzes",
        titleEn: "Trip comparison and shared decisions",
        description:
          "Vergelijk reisopties per categorie, bespreek kandidaten, stem samen en zet de definitieve keuze gecontroleerd om naar één boeking.",
        descriptionEn:
          "Compare travel options by category, discuss candidates, vote together and convert the final choice into exactly one booking.",
      },
      {
        kind: "new",
        title: "Veilige klantformulieren voor Agencies",
        titleEn: "Secure Agency client forms",
        description:
          "Agencies kunnen tweetalige intakeformulieren delen, antwoorden beoordelen en goedgekeurde voorkeuren verwerken zonder gevoelige geheimvelden te verzamelen.",
        descriptionEn:
          "Agencies can share bilingual intake forms, review responses and process approved preferences without requesting confidential account details.",
      },
      {
        kind: "new",
        title: "Offline dagoverzicht en uitgaven",
        titleEn: "Offline daily view and expenses",
        description:
          "Bewaar bewust een beperkt reispakket voor onderweg, bekijk dagen zonder verbinding en synchroniseer nieuwe uitgaven na herstel van internet.",
        descriptionEn:
          "Explicitly save a limited trip pack for the road, view travel days without a connection and synchronise new expenses once internet access returns.",
      },
      {
        kind: "new",
        title: "Klantintake en herbruikbare Agency-content",
        titleEn: "Client intake and reusable Agency content",
        description:
          "Reisorganisaties kunnen tweetalige formulieren uitsturen, antwoorden gecontroleerd verwerken en versiebeheer gebruiken voor content in reizen en offertes.",
        descriptionEn:
          "Travel organisations can send bilingual forms, process responses in a controlled way and use versioned content in trips and quotes.",
      },
      {
        kind: "secure",
        title: "Offline met minimale gegevens",
        titleEn: "Offline with minimal data",
        description:
          "De lokale reiskopie bevat alleen route, planning en praktische gegevens. Documenten, boekingscodes en bestaande bedragen blijven buiten het offline pakket en uitloggen wist de kopie.",
        descriptionEn:
          "The local trip copy only contains route, itinerary and practical details. Documents, booking references and existing amounts stay outside the offline pack, and signing out clears the copy.",
      },
      {
        kind: "new",
        title: "Agency-contentbibliotheek",
        titleEn: "Agency content library",
        description:
          "Beheer herbruikbare, tweetalige reiscontent met rollen, versies en broninformatie en voeg die gecontroleerd toe aan reizen en offertes.",
        descriptionEn:
          "Manage reusable bilingual travel content with roles, versions and source information, then apply it to trips and quotes in a controlled way.",
      },
      {
        kind: "improved",
        title: "Portal, mobiel en accountbeveiliging",
        titleEn: "Portal, mobile and account security",
        description:
          "Publieke website en accountportaal zijn duidelijk gescheiden, mobiele navigatie is aangescherpt en Google, Discord, passkeys en TOTP sluiten aan op dezelfde accountomgeving.",
        descriptionEn:
          "The public website and account portal are clearly separated, mobile navigation is refined, and Google, Discord, passkeys and TOTP connect to the same account environment.",
      },
    ],
  },
  {
    id: "2026-09-21-communication-reliability",
    version: "Beta 0.8",
    publishedAt: "2026-09-21T20:30:00+02:00",
    title: "Betrouwbare communicatie en betalingen",
    titleEn: "Reliable communication and payments",
    summary:
      "Verbeteringen voor mailopmaak, vertaling, betalingen en agenda zijn in de beta beschikbaar. De bestaande mailbezorging blijft via ZXCS lopen.",
    summaryEn:
      "Improvements to email formatting, translation, payments and calendars are available in beta. Existing email delivery continues through ZXCS.",
    changes: [
      {
        kind: "improved",
        title: "Professionele bedrijfsmail",
        titleEn: "Professional company email",
        description:
          "Bedrijfsmail gebruikt veilige HTML, een herkenbare handtekening en behoudt opmaak en bijlagen bij opnieuw bezorgen.",
        descriptionEn:
          "Company email uses safe HTML, a recognisable signature and preserves formatting and attachments when retried.",
      },
      {
        kind: "new",
        title: "Vertaalconcepten met controle",
        titleEn: "Translation drafts with review",
        description:
          "Feedback, meldingen, onderhoud, recensies en bedrijfsmail kunnen tussen Nederlands en Engels als controleerbaar concept worden vertaald.",
        descriptionEn:
          "Feedback, notices, maintenance, testimonials and company email can be translated between Dutch and English as reviewable drafts.",
      },
      {
        kind: "fixed",
        title: "Betaling en live agenda hersteld",
        titleEn: "Payments and live calendars restored",
        description:
          "Betaalrechten, gelokaliseerde betaalmeldingen en live agenda-abonnementen zijn na de productie-uitrol gecontroleerd.",
        descriptionEn:
          "Payment entitlements, localised payment notices and live calendar subscriptions were verified after the production rollout.",
      },
    ],
  },
  {
    id: "2026-09-21-trip-polish",
    version: "Beta 0.7",
    publishedAt: "2026-09-21T12:00:00+02:00",
    title: "Reizen delen en exporteren",
    titleEn: "Share and export trips",
    summary: "Verbeteringen die in de actieve beta zijn bevestigd.",
    summaryEn: "Improvements confirmed in the active beta.",
    changes: [
      {
        kind: "improved",
        title: "Overzichtelijke openbare reispagina",
        titleEn: "Clearer public trip page",
        description: "De gedeelde reis toont de planning leesbaarder.",
        descriptionEn: "Shared trips present the itinerary more clearly.",
      },
      {
        kind: "fixed",
        title: "GPX en losse agenda-export",
        titleEn: "GPX and one-time calendar export",
        description:
          "GPX-download en losse ICS-export werkten vanaf deze beta; de live abonnementlink was in deze release nog in onderzoek.",
        descriptionEn:
          "GPX download and one-time ICS export worked from this beta; the live subscription link was still under investigation in this release.",
      },
      {
        kind: "fixed",
        title: "Uitgaven en bedrijfsbeheer",
        titleEn: "Expenses and corporate management",
        description:
          "De tekst bij 'betaald door' past weer in de knop en bedrijfsbeheerderaccounts kunnen worden opgeslagen.",
        descriptionEn:
          "The paid-by label fits its button and corporate administrator accounts can be saved.",
      },
    ],
  },
  {
    id: "2026-09-15-payments-calendar",
    version: "Beta 0.6",
    publishedAt: "2026-09-15T16:00:00+02:00",
    title: "Betalen en agenda",
    titleEn: "Payments and calendar",
    summary:
      "Paddle-checkout, facturen en agenda-export zijn samengebracht in één duidelijke productupdate.",
    summaryEn:
      "Paddle checkout, invoices and calendar export are combined in one clear product update.",
    changes: [
      {
        kind: "new",
        title: "Maandelijks of één losse maand",
        titleEn: "Monthly or one-time month",
        description:
          "Pro en Agency ondersteunen een doorlopend abonnement en een losse maand zonder automatische verlenging.",
        descriptionEn:
          "Pro and Agency support a recurring subscription and a one-time month without automatic renewal.",
      },
      {
        kind: "new",
        title: "Facturen en abonnement beheren",
        titleEn: "Manage invoices and subscriptions",
        description:
          "Betalingen lopen via Paddle en het klantportaal geeft toegang tot facturen, betaalmethode en opzegging.",
        descriptionEn:
          "Payments use Paddle and the customer portal provides invoices, payment methods and cancellation.",
      },
      {
        kind: "improved",
        title: "Agenda exporteren",
        titleEn: "Export your calendar",
        description:
          "Een reisplanning kan als los ICS-bestand worden gebruikt; live agenda-abonnementen worden tijdens de beta verder getest.",
        descriptionEn:
          "A trip schedule can be used as an ICS file; live calendar subscriptions continue to be tested during beta.",
      },
    ],
  },
  {
    id: "2026-09-14-access-communication",
    version: "Beta 0.5",
    publishedAt: "2026-09-14T23:55:00+02:00",
    title: "Toegang en communicatie",
    titleEn: "Access and communication",
    summary:
      "Accountbeveiliging, servicemail, privacyverzoeken en bedrijfsmail kregen één samenhangende basis.",
    summaryEn:
      "Account security, service email, privacy requests and company email received one coherent foundation.",
    changes: [
      {
        kind: "secure",
        title: "Meer veilige inlogmethoden",
        titleEn: "More secure sign-in methods",
        description:
          "Naast e-mail ondersteunt GlobeTrotr Google, Discord, passkeys en authenticatorcodes.",
        descriptionEn:
          "Alongside email, GlobeTrotr supports Google, Discord, passkeys and authenticator codes.",
      },
      {
        kind: "improved",
        title: "Communicatievoorkeuren",
        titleEn: "Communication preferences",
        description:
          "Gebruikers kiezen welke uitnodigingen, reisupdates en betaalberichten zij per e-mail ontvangen.",
        descriptionEn:
          "Users choose which invitations, trip updates and payment messages they receive by email.",
      },
      {
        kind: "new",
        title: "Privacyverzoeken volgen",
        titleEn: "Track privacy requests",
        description: "Privacyverzoeken kunnen vanuit het account worden ingediend en gevolgd.",
        descriptionEn: "Privacy requests can be submitted and tracked from the account.",
      },
      {
        kind: "new",
        title: "Bedrijfsmail en postvakken",
        titleEn: "Company email and mailboxes",
        description:
          "Bevoegde medewerkers kunnen gedeelde en persoonlijke postvakken met een vaste handtekening gebruiken.",
        descriptionEn:
          "Authorised staff can use shared and personal mailboxes with a consistent signature.",
      },
    ],
  },
  {
    id: "2026-09-14-travel-tools",
    version: "Beta 0.4",
    publishedAt: "2026-09-14T12:00:00+02:00",
    title: "Meer gereedschap voor onderweg",
    titleEn: "More tools for the road",
    summary:
      "Reisstatistieken, taken, exports en een rustiger dagoverzicht maken lange reizen overzichtelijker.",
    summaryEn:
      "Trip statistics, tasks, exports and a calmer daily view make longer trips easier to manage.",
    changes: [
      {
        kind: "new",
        title: "Reisstatistieken en budgettempo",
        titleEn: "Trip statistics and budget pace",
        description:
          "Bekijk reisdagen, landen, boekingen, uitgaven per categorie en de verwachte budgetontwikkeling.",
        descriptionEn:
          "See travel days, countries, bookings, spending by category and projected budget progress.",
      },
      {
        kind: "new",
        title: "Taken en Vandaag",
        titleEn: "Tasks and Today",
        description:
          "Verdeel reistaken en bekijk onderweg alleen wat voor de huidige dag van belang is.",
        descriptionEn:
          "Assign trip tasks and see only what matters for the current day while travelling.",
      },
      {
        kind: "improved",
        title: "Route en reisversies",
        titleEn: "Route and trip versions",
        description:
          "Keer een route om, maak een conceptkopie en vergelijk route, boekingen en budget.",
        descriptionEn:
          "Reverse a route, create a draft copy and compare route, bookings and budget.",
      },
    ],
  },
  {
    id: "2026-09-12-agency-operations",
    version: "Beta 0.3",
    publishedAt: "2026-09-12T20:00:00+02:00",
    title: "Agency als werkruimte",
    titleEn: "Agency as a workspace",
    summary:
      "Reisorganisaties beheren klanten, offertes, teamrechten en branding vanuit één omgeving.",
    summaryEn:
      "Travel organisations manage clients, quotes, team permissions and branding from one workspace.",
    changes: [
      {
        kind: "new",
        title: "Klanten en offertes",
        titleEn: "Clients and quotes",
        description:
          "Maak offertes met varianten, deel ze veilig en zet een geaccepteerd voorstel om naar een reis.",
        descriptionEn:
          "Create quotes with variants, share them securely and convert an accepted proposal into a trip.",
      },
      {
        kind: "secure",
        title: "Rollen en audit",
        titleEn: "Roles and audit",
        description: "Teamrechten begrenzen toegang en belangrijke beheeracties worden vastgelegd.",
        descriptionEn:
          "Team permissions restrict access and important administrative actions are recorded.",
      },
      {
        kind: "improved",
        title: "Eigen uitstraling",
        titleEn: "Custom branding",
        description:
          "Agency-reizen gebruiken een organisatienaam, accentkleur en gecontroleerde domeinkoppeling.",
        descriptionEn:
          "Agency trips use an organisation name, accent colour and verified domain connection.",
      },
    ],
  },
  {
    id: "2026-09-10-public-beta",
    version: "Beta 0.2",
    publishedAt: "2026-09-10T18:00:00+02:00",
    title: "Publieke beta en beheer",
    titleEn: "Public beta and administration",
    summary:
      "De publieke website, feedbackstroom en Corporate Admin zijn klaargemaakt voor een beheerste beta.",
    summaryEn:
      "The public website, feedback flow and Corporate Admin were prepared for a controlled beta.",
    changes: [
      {
        kind: "new",
        title: "Feedback en bekende problemen",
        titleEn: "Feedback and known issues",
        description:
          "Testers kunnen feedback indienen en beheerders volgen problemen, reacties en productstatus.",
        descriptionEn:
          "Testers can submit feedback while administrators track issues, replies and product status.",
      },
      {
        kind: "improved",
        title: "Duidelijkere website",
        titleEn: "Clearer website",
        description:
          "Product, prijzen, contact, status, roadmap en juridische informatie hebben ieder een duidelijke plek.",
        descriptionEn:
          "Product, pricing, contact, status, roadmap and legal information each have a clear place.",
      },
      {
        kind: "secure",
        title: "Europese infrastructuur en privacy",
        titleEn: "European infrastructure and privacy",
        description:
          "De website legt primaire opslag in Frankfurt, Duitse applicatieservers en privacykeuzes uit.",
        descriptionEn:
          "The website explains primary storage in Frankfurt, German application servers and privacy choices.",
      },
    ],
  },
  {
    id: "2026-09-07-core-planner",
    version: "Beta 0.1",
    publishedAt: "2026-09-07T23:34:00+02:00",
    title: "De reisplanner staat",
    titleEn: "The trip planner is ready",
    summary:
      "De basis voor gezamenlijk plannen, boeken, uitgaven bijhouden en reizen delen is beschikbaar.",
    summaryEn:
      "The foundation for planning together, tracking bookings and expenses, and sharing trips is available.",
    changes: [
      {
        kind: "new",
        title: "Planning en route",
        titleEn: "Planning and route",
        description: "Bestemmingen, dagplanning, boekingen en routekaart komen samen in één reis.",
        descriptionEn:
          "Destinations, daily planning, bookings and the route map come together in one trip.",
      },
      {
        kind: "new",
        title: "Uitgaven en verrekening",
        titleEn: "Expenses and settlement",
        description: "Houd uitgaven in meerdere valuta bij en bereken wie nog aan wie betaalt.",
        descriptionEn: "Track expenses in multiple currencies and calculate who still owes whom.",
      },
      {
        kind: "secure",
        title: "Samenwerken met rollen",
        titleEn: "Collaborate with roles",
        description: "Eigenaar, reiziger, kijker en financiële rollen krijgen passende toegang.",
        descriptionEn: "Owner, traveller, viewer and finance roles receive appropriate access.",
      },
    ],
  },
];
