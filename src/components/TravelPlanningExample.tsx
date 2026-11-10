import { MarketingLink as Link } from "@/components/MarketingLink";
import { ArrowRight, Check, MapPinned, Users, WalletCards } from "lucide-react";
import { useLocale } from "@/lib/locale";

const EXAMPLES = {
  route: {
    title: ["Een rondreis met meerdere stops plannen", "Plan a trip with multiple stops"],
    intro: [
      "Bijvoorbeeld een week Portugal: eerst Lissabon, dan Sintra en daarna Porto. In GlobeTrotr zet je bestemmingen op volgorde en leg je vast waar je overnacht. Boekingsgegevens en je dagplanning blijven bij dezelfde reis.",
      "For example, a week in Portugal: Lisbon first, then Sintra and finally Porto. In GlobeTrotr you order destinations and record where you stay. Your booking details and daily itinerary stay with the same trip.",
    ],
    steps: [
      [
        "Voeg Lissabon, Sintra en Porto toe aan je route.",
        "Add Lisbon, Sintra and Porto to your route.",
      ],
      [
        "Kies per stop of je er overnacht en geef je aankomst en aantal nachten op.",
        "Choose whether to stay overnight at each stop and enter your arrival and number of nights.",
      ],
      [
        "Bewaar je verblijf en vervoer en vul de dagen aan met eigen plannen.",
        "Record accommodation and transport, then add your own daily plans.",
      ],
    ],
    note: [
      "Dit is een fictief reisvoorbeeld. Een boeking vastleggen in de planner reserveert geen hotel of vervoer.",
      "This is a fictional trip example. Recording a booking in the planner does not reserve accommodation or transport.",
    ],
    related: ["Samen plannen en kosten verdelen", "Plan together and split expenses"],
    to: "/for-groups",
  },
  expenses: {
    title: [
      "Reiskosten verdelen: wie heeft wat betaald?",
      "Split travel expenses: who paid for what?",
    ],
    intro: [
      "Noor betaalt een diner van €120 voor zichzelf en Sam. Als ze de kosten gelijk delen, draagt ieder €60 bij. Sam moet Noor dan €60 terugbetalen. Zo wordt het verschil tussen wie betaalt en wie meedeelt zichtbaar.",
      "Noor pays €120 for dinner for herself and Sam. If they split the cost equally, each contributes €60. Sam then owes Noor €60. This makes the difference between the payer and the people sharing the expense clear.",
    ],
    steps: [
      [
        "Voer het bedrag, de oorspronkelijke valuta en de betaler in.",
        "Enter the amount, original currency and payer.",
      ],
      [
        "Selecteer de reisgenoten die in deze uitgave meedelen.",
        "Select the travellers who share this expense.",
      ],
      [
        "Bekijk de saldi en voorgestelde verrekening voor de reis.",
        "Review the balances and suggested settlement for the trip.",
      ],
    ],
    note: [
      "GlobeTrotr houdt de verdeling bij en stelt terugbetalingen voor; de app voert geen bankoverboekingen uit. Financiële gegevens zijn alleen zichtbaar volgens de gekozen reisrollen.",
      "GlobeTrotr tracks the split and suggests repayments; the app does not make bank transfers. Financial details are only visible according to the selected trip roles.",
    ],
    related: [
      "Bekijk routes, boekingen en andere mogelijkheden",
      "Explore routes, bookings and other features",
    ],
    to: "/features",
  },
  collaboration: {
    title: [
      "Samen een rondreis organiseren, met duidelijke afspraken",
      "Organise a trip together, with clear responsibilities",
    ],
    intro: [
      "De een zoekt een verblijf, de ander plant een dag in de stad. In GlobeTrotr nodig je reisgenoten uit bij dezelfde reis en kies je welke onderdelen zij mogen bekijken of aanpassen. Ideeën vergelijken en uitgaven bijhouden blijven verbonden met jullie planning.",
      "One person finds accommodation while another plans a day in the city. In GlobeTrotr you invite travellers to the same trip and choose which areas they can view or edit. Comparing ideas and tracking expenses stay connected to your itinerary.",
    ],
    steps: [
      [
        "Maak de reis en nodig je reisgenoten uit.",
        "Create the trip and invite your fellow travellers.",
      ],
      [
        "Kies toegang die past bij ieders taak, ook voor de financiën.",
        "Choose access suited to each person's role, including financial access.",
      ],
      [
        "Bekijk dezelfde route en planning, met boekingsgegevens op één plek.",
        "Use the same route and itinerary, with booking details in one place.",
      ],
    ],
    note: [
      "Samen plannen is beschikbaar met Free. Live weer en ruimere vlucht- en routelimieten horen bij Pro. Bekijk de prijzen voor de actuele verschillen.",
      "Planning together is included in Free. Live weather and higher flight and routing limits are part of Pro. See pricing for the current differences.",
    ],
    related: [
      "Een route met meerdere bestemmingen plannen",
      "Plan a route with multiple destinations",
    ],
    to: "/for-travelers",
  },
} as const;

export function TravelPlanningExample({ kind }: { kind: keyof typeof EXAMPLES }) {
  const { text } = useLocale();
  const example = EXAMPLES[kind];
  const Icon = kind === "expenses" ? WalletCards : kind === "collaboration" ? Users : MapPinned;
  return (
    <section className="marketing-example mx-auto max-w-6xl space-y-5 rounded-3xl border p-6 sm:p-8">
      <span className="feature-icon feature-tone-0">
        <Icon className="size-6" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        {text("Zo gebruik je GlobeTrotr", "How to use GlobeTrotr")}
      </p>
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">
        {text(example.title[0], example.title[1])}
      </h2>
      <p className="max-w-3xl leading-relaxed text-muted-foreground">
        {text(example.intro[0], example.intro[1])}
      </p>
      <ol className="grid gap-3 text-sm leading-relaxed lg:grid-cols-3">
        {example.steps.map((step, index) => (
          <li key={step[0]} className={`rounded-2xl bg-card p-5 feature-tone-${index}`}>
            <Check className="mb-3 size-5 text-primary" />
            {text(step[0], step[1])}
          </li>
        ))}
      </ol>
      <details className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer py-2 font-medium">
          {text("Goed om te weten", "Good to know")}
        </summary>
        <p className="mt-2">{text(example.note[0], example.note[1])}</p>
      </details>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          to={example.to}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text(example.related[0], example.related[1])}
          <ArrowRight className="size-4" />
        </Link>
        <Link
          to="/pricing"
          className="rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text("Gratis en betaalde plannen", "Free and paid plans")}
        </Link>
      </div>
    </section>
  );
}
