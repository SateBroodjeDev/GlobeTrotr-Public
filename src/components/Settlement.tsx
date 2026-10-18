import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Plus, Send, Users, X } from "lucide-react";
import { balances, participantsOf, settle, type FinancialParticipant } from "@/lib/settle";
import { formatMoney, type Rates } from "@/lib/services";
import type { Trip } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale";
import { publishTripSettlement } from "@/lib/settlement.functions";
import { toast } from "sonner";

export function Settlement({
  trip,
  base,
  rates,
  owner,
  editable,
  onTravelers,
  manageTravelersInSettings = false,
}: {
  trip: Trip;
  base: string;
  rates: Rates;
  owner: FinancialParticipant;
  editable: boolean;
  onTravelers?: (people: string[]) => void;
  /** Reisgenoten worden in de instellingen beheerd, niet in de geldtool. */
  manageTravelersInSettings?: boolean;
}) {
  const { text } = useLocale();
  const [name, setName] = useState("");
  const [settlementBusy,setSettlementBusy]=useState<"request"|"complete"|null>(null);
  const participants = useMemo(() => participantsOf(trip, owner), [trip, owner]);
  const people = participants.map((participant) => participant.name);
  const list = useMemo(
    () => balances(trip, participants, base, rates),
    [trip, participants, base, rates],
  );
  const transfers = useMemo(() => settle(list), [list]);
  async function publish(action:"request"|"complete"){
    setSettlementBusy(action);
    try {
      const result=await publishTripSettlement({data:{tripId:trip.id,action,currency:base,transfers}});
      toast.success(action==="complete"?text("De verrekening is afgerond.","The settlement was completed."):result.count?text(`${result.count} betaalverzoek(en) verstuurd.`,`${result.count} payment request(s) sent.`):text("Er zijn geen gekoppelde accounts om een betaalverzoek aan te sturen.","There are no linked accounts to receive a payment request."));
    } catch { toast.error(text("De verrekening kon niet worden gepubliceerd.","The settlement could not be published.")); }
    finally { setSettlementBusy(null); }
  }

  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4" /> {text("Slimme verrekening", "Smart settlement")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1">
              {p}
              {editable && !manageTravelersInSettings && people.length > 1 && onTravelers && (
                <button
                  aria-label={`${text("Verwijder", "Remove")} ${p}`}
                  onClick={() => onTravelers(people.filter((x) => x !== p))}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>

        {editable && !manageTravelersInSettings && onTravelers && (
          <div className="flex gap-2">
            <Input
              value={name}
              placeholder={text("Reisgenoot toevoegen", "Add traveller")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = name.trim();
                if (!v || people.includes(v)) return;
                onTravelers([...people, v]);
                setName("");
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                const v = name.trim();
                if (!v || people.includes(v)) return;
                onTravelers([...people, v]);
                setName("");
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}

        {manageTravelersInSettings && (
          <p className="text-xs text-muted-foreground">
            {text(
              "Beheer deelnemers via Reisinstellingen → Reisgenoten. Dezelfde personen worden hier gebruikt voor kosten en verrekening.",
              "Manage participants under Trip settings → Travellers. The same people are used for expenses and settlement.",
            )}
          </p>
        )}

        <div className="space-y-2 sm:hidden">
          {list.map((balance) => (
            <div key={balance.id} className="rounded-xl border border-border p-3">
              <p className="break-words font-medium">{balance.name}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{text("Betaald", "Paid")}</dt>
                  <dd className="mt-1 break-words font-medium">
                    {formatMoney(balance.paid, base)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{text("Aandeel", "Share")}</dt>
                  <dd className="mt-1 break-words font-medium">
                    {formatMoney(balance.owes, base)}
                  </dd>
                </div>
                <div className="col-span-2 mt-1 flex min-w-0 items-baseline justify-between gap-3 border-t border-border pt-2">
                  <dt className="text-muted-foreground">{text("Saldo", "Balance")}</dt>
                  <dd
                    className={`min-w-0 break-words text-right font-semibold ${
                      balance.net < -0.01 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMoney(balance.net, base)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">{text("Persoon", "Person")}</th>
                <th className="p-3 text-right">{text("Betaald", "Paid")}</th>
                <th className="p-3 text-right">{text("Aandeel", "Share")}</th>
                <th className="p-3 text-right">{text("Saldo", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-3">{b.name}</td>
                  <td className="p-3 text-right">{formatMoney(b.paid, base)}</td>
                  <td className="p-3 text-right">{formatMoney(b.owes, base)}</td>
                  <td
                    className={`p-3 text-right font-medium ${
                      b.net < -0.01 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMoney(b.net, base)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {text("Minimale overboekingen", "Minimum transfers")}
          </p>
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {text(
                "Alles staat gelijk — niets te verrekenen.",
                "Everything is settled — no transfers needed.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {transfers.map((t, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-words font-medium">{t.from}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words font-medium">{t.to}</span>
                  <span className="ml-auto shrink-0 font-medium">
                    {formatMoney(t.amount, base)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {editable&&<div className="flex flex-wrap gap-2 pt-2"><Button type="button" disabled={settlementBusy!==null||transfers.length===0} onClick={()=>void publish("request")}><Send className="size-4"/>{settlementBusy==="request"&&<Loader2 className="size-4 animate-spin"/>}{text("Betaalverzoeken versturen","Send payment requests")}</Button><Button type="button" variant="outline" disabled={settlementBusy!==null} onClick={()=>void publish("complete")}><CheckCircle2 className="size-4"/>{settlementBusy==="complete"&&<Loader2 className="size-4 animate-spin"/>}{text("Verrekening afronden","Complete settlement")}</Button></div>}
        </div>
      </CardContent>
    </Card>
  );
}
