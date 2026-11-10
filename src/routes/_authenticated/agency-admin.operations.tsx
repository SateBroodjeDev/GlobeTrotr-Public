import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CircleDollarSign, Clock3, FileWarning, Lock } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "@/lib/workspace";
import { hasFeature } from "@/lib/plans";
import { CATEGORIES } from "@/lib/types";
import { convert, formatMoney } from "@/lib/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/locale";
import { useQuery } from "@tanstack/react-query";
import { getAgencyOperations, getMyAgencyAccess, type AgencyOperationItem } from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/agency-admin/operations")({
  head: () => ({
    meta: [
      { title: "Agency-overzicht — GlobeTrotr" },
      {
        name: "description",
        content: "Inzicht in reizen, kosten en declarabele uitgaven voor je agency.",
      },
      { property: "og:title", content: "Agency-overzicht — GlobeTrotr" },
      {
        property: "og:description",
        content: "Overzicht van reizen, kosten en declarabele uitgaven.",
      },
    ],
  }),
  component: Analytics,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

function Analytics() {
  const { text, locale } = useLocale();
  const { state, rates } = useWorkspace();
  const access=useQuery({queryKey:["my-agency-access"],queryFn:()=>getMyAgencyAccess(),enabled:state.plan==="agency",retry:false});
  const allowed = hasFeature(state.plan, "analytics") && access.data?.permissions.analytics_view===true;
  const operations=useQuery({queryKey:["agency-operations"],queryFn:()=>getAgencyOperations(),enabled:allowed,retry:false});
  const base = state.baseCurrency;
  const trips = state.trips ?? [];

  const perCategory = CATEGORIES.map((c) => ({
    name: categoryLabel(c.id, c.label, text),
    value: trips
      .flatMap((t) => t.expenses)
      .filter((e) => e.category === c.id)
      .reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0),
  })).filter((d) => d.value > 0);

  const perTrip = trips.map((t) => ({
    name: t.name.length > 18 ? `${t.name.slice(0, 18)}…` : t.name,
    expenses: Math.round(
      t.expenses.reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0),
    ),
    budget: t.budget,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const activeTrips = trips.filter((trip) => !trip.archived && trip.end >= today).length;
  const travellers = trips.reduce(
    (total, trip) => total + 1 + (trip.members ?? []).filter((member) => member.status === "active").length,
    0,
  );
  const totalSpent = trips
    .flatMap((trip) => trip.expenses)
    .reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base, rates), 0);
  const totalBillable = trips
    .flatMap((trip) => trip.expenses)
    .filter((expense) => expense.billable)
    .reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base, rates), 0);

  if (!allowed) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        <Lock className="size-4" /> {text("Het analytics-dashboard is onderdeel van Agency.", "The analytics dashboard is part of Agency.")} {" "}
        <Link to="/billing" className="underline">
          {text("Upgraden", "Upgrade")}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{text("Agency-overzicht", "Agency overview")}</h1>
        <p className="text-sm text-muted-foreground">
          {text("Inzicht in je reisportfolio, kosten en declarabele uitgaven.", "Insights into your trip portfolio, costs and billable expenses.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={text("Actieve reizen", "Active trips")} value={String(activeTrips)} sub={`${trips.length} ${text("totaal", "total")}`} />
        <Kpi label={text("Reisgenoten", "Travellers")} value={String(travellers)} sub={text("over al je reizen", "across all your trips")} />
        <Kpi label={text("Uitgaven", "Expenses")} value={formatMoney(totalSpent, base)} sub={text("in je basisvaluta", "in your base currency")} />
        <Kpi label={text("Declarabel", "Billable")} value={formatMoney(totalBillable, base)} sub={text("nog te factureren", "to be invoiced")} />
      </div>

      <section className="space-y-3">
        <div><h2 className="font-display text-xl font-semibold">{text("Werkvoorraad","Work queue")}</h2><p className="text-sm text-muted-foreground">{text("Concrete aandachtspunten uit de actuele Agency-data.","Actionable items from current Agency data.")}</p></div>
        {operations.isError&&<p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{text("De werkvoorraad kon niet worden geladen.","The work queue could not be loaded.")}</p>}
        <div className="grid gap-4 xl:grid-cols-2">
          <QueueCard icon={CalendarClock} title={text("Aankomende reizen","Upcoming trips")} empty={text("Geen aankomende reizen.","No upcoming trips.")} items={operations.data?.upcoming??[]} locale={locale} text={text}/>
          <QueueCard icon={AlertTriangle} title={text("Ontbrekende boekingsgegevens","Missing booking details")} empty={text("Alle toekomstige boekingen zijn compleet.","All future bookings are complete.")} items={operations.data?.missingBookings??[]} locale={locale} text={text} missing/>
          <QueueCard icon={CircleDollarSign} title={text("Open declarabele kosten","Open billable expenses")} empty={text("Geen declarabele kosten gevonden.","No billable expenses found.")} items={operations.data?.billableExpenses??[]} locale={locale} text={text}/>
          <QueueCard icon={FileWarning} title={text("Documenten verlopen binnen 30 dagen","Documents expiring within 30 days")} empty={text("Geen documenten verlopen binnenkort.","No documents expire soon.")} items={operations.data?.expiringDocuments??[]} locale={locale} text={text}/>
          <Card className="surface"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4 text-primary"/>{text("Verlopen teamuitnodigingen","Expired team invitations")}<span className="ml-auto text-sm text-muted-foreground">{operations.data?.expiredInvitations.length??0}</span></CardTitle></CardHeader><CardContent className="max-h-72 space-y-2 overflow-y-auto">{operations.data?.expiredInvitations.map(item=><div key={item.id} className="rounded-xl border p-3"><p className="truncate text-sm font-medium">{item.email}</p><p className="text-xs text-muted-foreground">{text("Verlopen op","Expired on")} {formatDate(item.expiresAt,locale)}</p></div>)}{operations.data&&!operations.data.expiredInvitations.length&&<Empty>{text("Geen verlopen uitnodigingen.","No expired invitations.")}</Empty>}</CardContent></Card>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{text("Budget vs. uitgaven per reis", "Budget vs expenses per trip")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perTrip}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="budget" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name={text("Uitgaven", "Expenses")} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{text("Uitgaven per categorie", "Expenses by category")} ({base})</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={perCategory} dataKey="value" nameKey="name" outerRadius={95} label>
                  {perCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QueueCard({icon:Icon,title,empty,items,locale,text,missing=false}:{icon:typeof CalendarClock;title:string;empty:string;items:AgencyOperationItem[];locale:string;text:(nl:string,en:string)=>string;missing?:boolean}){return <Card className="surface"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-primary"/>{title}<span className="ml-auto text-sm text-muted-foreground">{items.length}</span></CardTitle></CardHeader><CardContent className="max-h-72 space-y-2 overflow-y-auto">{items.map(item=><Link key={`${item.tripId}:${item.id}`} to="/trips/$tripId" params={{tripId:item.tripId}} className="block rounded-xl border p-3 transition-colors hover:bg-muted"><div className="flex gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.tripName}{item.date?` · ${formatDate(item.date,locale)}`:""}</span></span>{item.detail&&<span className="shrink-0 text-xs text-muted-foreground">{missing?missingLabel(item.detail,text):item.detail}</span>}</div></Link>)}{!items.length&&<Empty>{empty}</Empty>}</CardContent></Card>}
function Empty({children}:{children:string}){return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{children}</p>}
function formatDate(value:string,locale:string){const date=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(locale==="en"?"en-GB":"nl-NL",{dateStyle:"medium"}).format(date)}
function missingLabel(value:string,text:(nl:string,en:string)=>string){return value.split(",").map(part=>part==="provider"?text("aanbieder","provider"):text("boekingsnummer","reference")).join(" + ")}

function categoryLabel(id: string, fallback: string, text: (nl: string, en: string) => string) {
  const labels: Record<string, string> = {
    transport: "Transport", lodging: "Accommodation", food: "Food and drink",
    activities: "Activities", shopping: "Shopping", other: "Other",
  };
  return text(fallback, labels[id] ?? fallback);
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="surface">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

