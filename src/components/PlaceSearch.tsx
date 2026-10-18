import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { type GeoResult } from "@/lib/services";
import {searchPlacesServer} from "@/lib/place.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";
import { localizeCountry } from "@/lib/localized-values";

export function PlaceSearch({
  onPick,
  disabled,
}: {
  onPick: (r: GeoResult) => void;
  disabled?: boolean;
}) {
  const { locale, text } = useLocale();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchPlacesServer({data:{query:q,language:locale === "en-GB" ? "en" : "nl"}}));
    } catch {
      setError(text("Zoeken lukte niet, probeer opnieuw.", "Search failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <Input
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          placeholder={text("Zoek elk dorp, stad of land ter wereld…", "Search any town, city or country worldwide…")}
        />
        <Button type="submit" disabled={disabled || loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y rounded-xl border border-border bg-card">
          {results.map((r) => (
            <li key={`${r.lat}-${r.lon}`}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(r);
                  setResults([]);
                  setQ("");
                }}
              >
                <span className="min-w-0"><span className="block font-medium">{r.name}</span>{r.addressLine && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{r.addressLine}</span>}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{localizeCountry(r.country, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
