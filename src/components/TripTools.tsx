import { useMemo, useState } from "react";
import { Fuel, Repeat } from "lucide-react";
import { CURRENCIES, convert, formatMoney, type Rates } from "@/lib/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale";

export function CurrencyConverter({
  rates,
  base,
  live,
}: {
  rates: Rates;
  base: string;
  live: boolean;
}) {
  const { text } = useLocale();
  const [amount, setAmount] = useState(100);
  const [from, setFrom] = useState("SEK");
  const [to, setTo] = useState(base);
  const result = convert(amount || 0, from, to, rates);

  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Repeat className="size-4" /> {text("Valuta-omrekenaar", "Currency converter")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            aria-label={text("Bedrag", "Amount")}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <select
            aria-label={text("Van valuta", "From currency")}
            className="rounded-lg border border-input bg-card px-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <select
            aria-label={text("Naar valuta", "To currency")}
            className="rounded-lg border border-input bg-card px-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <p className="font-display text-2xl font-semibold">{formatMoney(result, to)}</p>
        <p className="text-xs text-muted-foreground">
          1 {from} = {convert(1, from, to, rates).toFixed(4)} {to} ·{" "}
          {live ? text("Bijgewerkte wisselkoersen", "Updated exchange rates") : text("Indicatieve wisselkoersen", "Estimated exchange rates")}
        </p>
      </CardContent>
    </Card>
  );
}

export function FuelCalculator({
  rates,
  base,
}: {
  rates: Rates;
  base: string;
}) {
  const [km, setKm] = useState(1200);
  const [consumption, setConsumption] = useState(6.5); // l/100km
  const [price, setPrice] = useState(19.5);
  const [currency, setCurrency] = useState("SEK");
  const [people, setPeople] = useState(2);
  const [tolls, setTolls] = useState(0);

  const calc = useMemo(() => {
    const liters = (km * consumption) / 100;
    const localCost = liters * price;
    const fuelBase = convert(localCost, currency, base, rates);
    const total = fuelBase + convert(tolls, currency, base, rates);
    return { liters, fuelBase, total, perPerson: total / Math.max(1, people) };
  }, [km, consumption, price, currency, people, tolls, base, rates]);

  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Fuel className="size-4" /> Brandstof- & autocalculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Afstand (km)" value={km} onChange={setKm} />
          <Field label="Verbruik (l/100km)" value={consumption} onChange={setConsumption} step={0.1} />
          <div className="space-y-1.5">
            <Label className="text-xs">Prijs per liter</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                step={0.01}
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
              <select
                aria-label="Brandstofvaluta"
                className="rounded-lg border border-input bg-card px-2 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Tol/veerboot (lokaal)" value={tolls} onChange={setTolls} />
          <Field label="Aantal personen" value={people} onChange={setPeople} />
        </div>
        <div className="grid gap-2 rounded-xl bg-muted/60 p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Brandstof</p>
            <p className="font-semibold">{calc.liters.toFixed(1)} liter</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Totale rittenkosten</p>
            <p className="font-semibold">{formatMoney(calc.total, base)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Per persoon</p>
            <p className="font-semibold">{formatMoney(calc.perPerson, base)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step ?? 1}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
