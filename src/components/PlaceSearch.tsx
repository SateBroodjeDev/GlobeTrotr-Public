import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Pencil } from "lucide-react";
import { type GeoResult } from "@/lib/services";
import { searchPlacesServer } from "@/lib/place.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";
import { PlaceResults } from "@/components/PlaceResults";
import { ManualLocationEditor } from "@/components/ManualLocationEditor";
import { normalizePlaceQuery } from "@/lib/place-search";

export function PlaceSearch({
  onPick,
  disabled,
  compact = false,
  initialLocation,
  onCancel,
  onEditingChange,
}: {
  onPick: (r: GeoResult) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  initialLocation?: GeoResult;
  onCancel?: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { locale, text } = useLocale();
  const [manual, setManual] = useState(Boolean(initialLocation));
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [searched, setSearched] = useState(false);
  const generation = useRef(0), pending = useRef<number | null>(null), selecting = useRef(false);
  useEffect(() => () => { generation.current++; pending.current = null; }, []);
  function invalidate() {
    generation.current++; pending.current = null; setLoading(false); setResults([]); setError(null); setSearched(false);
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || pending.current !== null || selecting.current) return;
    let query: string;
    try { query = normalizePlaceQuery(q); }
    catch { setResults([]); setError(text("Vul een zoekterm van 1 tot 160 tekens in.", "Enter a search term of 1 to 160 characters.")); setSearched(false); return; }
    const token = ++generation.current; pending.current = token;
    setLoading(true);
    setError(null);
    setResults([]); setSearched(false);
    try {
      const values = await searchPlacesServer({ data: { query, language: locale === "en-GB" ? "en" : "nl" } });
      if (token === generation.current) { setResults(values); setSearched(true); }
    } catch {
      if (token === generation.current) setError(text("Zoeken lukte niet, probeer opnieuw of voer de locatie handmatig in.", "Search failed. Please try again or enter the location manually."));
    } finally {
      if (pending.current === token) { pending.current = null; setLoading(false); }
    }
  }
  async function pick(value: GeoResult) {
    if (disabled || selecting.current) return;
    selecting.current = true; setPicking(true); setError(null);
    const token = generation.current;
    try { await onPick(value); if (token === generation.current) { setResults([]); setQ(""); setSearched(false); } }
    catch { if (token === generation.current) setError(text("De locatie kon niet worden overgenomen. Je resultaat blijft beschikbaar; probeer opnieuw.", "Could not apply the location. Your result is kept; please retry.")); }
    finally { selecting.current = false; if (token === generation.current) setPicking(false); }
  }

  if (manual)
    return (
      <ManualLocationEditor
        initialLocation={initialLocation}
        disabled={disabled}
        onPick={async (value) => {
          await onPick(value);
          setManual(false);
          onEditingChange?.(false);
        }}
        onCancel={() => {
          setManual(false);
          onEditingChange?.(false);
          onCancel?.();
        }}
      />
    );
  return (
    <div>
      <form
        onSubmit={run}
        className={
          compact
            ? "flex min-w-0 items-center rounded-xl border border-input bg-background transition-shadow focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15"
            : "flex gap-2"
        }
        autoComplete="off"
      >
        <Input
          type="search"
          name="destination-search"
          className={
            compact
              ? "h-12 min-w-0 flex-1 border-0 bg-transparent pr-1 shadow-none focus-visible:ring-0"
              : undefined
          }
          autoComplete="off"
          aria-label={text("Zoek een bestemming", "Search for a destination")}
          value={q}
          disabled={disabled || picking}
          maxLength={160}
          onChange={(e) => { invalidate(); setQ(e.target.value); }}
          placeholder={
            compact
              ? text("Plaats, stad of land", "Town, city or country")
              : text(
                  "Zoek elk dorp, stad of land ter wereld…",
                  "Search any town, city or country worldwide…",
                )
          }
        />
        <Button
          type="submit"
          className={compact ? "mr-0.5 size-11 shrink-0 rounded-lg p-0" : undefined}
          disabled={disabled || loading || picking}
          aria-label={text("Zoeken", "Search")}
          title={text("Bestemming zoeken", "Search for a destination")}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {!error && searched && !results.length && <p role="status" className="mt-2 text-sm text-muted-foreground">{text("Geen locaties gevonden. Voeg een plaats of land toe, of voer de locatie handmatig in.", "No locations found. Add a town or country, or enter the location manually.")}</p>}
      {results.length > 0 && (
        <PlaceResults
          results={results}
          disabled={disabled || loading || picking}
          onPick={value => void pick(value)}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 gap-2 text-xs"
        disabled={disabled || picking}
        onClick={() => {
          invalidate();
          setManual(true);
          onEditingChange?.(true);
        }}
      >
        <Pencil className="size-3" />
        {text("Locatie handmatig invoeren", "Enter location manually")}
      </Button>
    </div>
  );
}
