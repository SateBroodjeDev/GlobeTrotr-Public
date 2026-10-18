import { CalendarDays, MapPinned, Plane, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, convert, type Rates } from "@/lib/services";
import { isRoutePlanningItem, type Trip } from "@/lib/types";

export function TripComparison({ left, right, base, rates, text }: { left: Trip; right: Trip; base: string; rates: Rates; text: (nl: string, en: string) => string }) {
  const spent = (trip: Trip) => trip.expenses.reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base, rates), 0);
  const rows = [
    { icon: CalendarDays, label: text("Reisperiode", "Travel dates"), value: (trip: Trip) => `${trip.start || "—"} → ${trip.end || "—"}` },
    { icon: MapPinned, label: text("Bestemmingen", "Destinations"), value: (trip: Trip) => String(trip.stops.length) },
    { icon: Plane, label: text("Boekingen", "Bookings"), value: (trip: Trip) => String((trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item)).length) },
    { icon: WalletCards, label: text("Budget", "Budget"), value: (trip: Trip) => formatMoney(trip.budget, base) },
    { icon: WalletCards, label: text("Uitgegeven", "Spent"), value: (trip: Trip) => formatMoney(spent(trip), base) },
  ];
  return <Card className="surface"><CardHeader><CardTitle>{text("Reisvarianten vergelijken", "Compare trip variants")}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><div className="min-w-[560px]"><div className="grid grid-cols-[1.1fr_1fr_1fr] border-b pb-3"><span/><strong className="break-anywhere pr-4">{left.name}</strong><strong className="break-anywhere">{right.name}</strong></div>{rows.map(({ icon: Icon, label, value }) => <div key={label} className="grid grid-cols-[1.1fr_1fr_1fr] items-center border-b py-3 text-sm last:border-0"><span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4"/>{label}</span><span className="pr-4 font-medium">{value(left)}</span><span className="font-medium">{value(right)}</span></div>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><RouteSummary trip={left}/><RouteSummary trip={right}/></div></CardContent></Card>;
}

function RouteSummary({ trip }: { trip: Trip }) { return <div className="rounded-xl bg-muted/40 p-4"><p className="mb-2 font-medium">{trip.name}</p>{trip.stops.length ? <ol className="space-y-1 text-sm text-muted-foreground">{trip.stops.map((stop, index) => <li key={stop.id} className="flex gap-2"><span>{index + 1}.</span><span>{stop.name}{stop.country ? ` · ${stop.country}` : ""}</span></li>)}</ol> : <p className="text-sm text-muted-foreground">—</p>}</div>; }
