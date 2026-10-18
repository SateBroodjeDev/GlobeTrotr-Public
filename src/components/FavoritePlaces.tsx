import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Stop } from "@/lib/types";
import {
  getFavoritePlaces,
  removeFavoritePlace,
  saveFavoritePlace,
  type FavoritePlace,
} from "@/lib/favorite-places.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const samePlace = (a: Pick<Stop, "lat" | "lon">, b: Pick<Stop, "lat" | "lon">) =>
  Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lon - b.lon) < 0.00001;

export function FavoritePlaces({
  stops,
  editable,
  onAdd,
  text,
}: {
  stops: Stop[];
  editable: boolean;
  onAdd: (place: FavoritePlace) => Promise<boolean>;
  text: (nl: string, en: string) => string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState("");
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["favorite-places"], queryFn: () => getFavoritePlaces() });
  const favorites = query.data ?? [];
  const routeOnly = stops.filter((stop) => !favorites.some((place) => samePlace(stop, place)));
  async function save(stop: Stop) {
    setBusy(`save:${stop.id}`);
    try {
      await saveFavoritePlace({
        data: { name: stop.name, country: stop.country, lat: stop.lat, lon: stop.lon },
      });
      await client.invalidateQueries({ queryKey: ["favorite-places"] });
      toast.success(text("Plaats opgeslagen als favoriet.", "Place saved as a favourite."));
    } catch {
      toast.error(text("Favoriet kon niet worden opgeslagen.", "Favourite could not be saved."));
    } finally {
      setBusy("");
    }
  }
  async function remove(id: string) {
    setBusy(`remove:${id}`);
    try {
      await removeFavoritePlace({ data: { id } });
      await client.invalidateQueries({ queryKey: ["favorite-places"] });
      toast.success(text("Favoriet verwijderd.", "Favourite removed."));
    } catch {
      toast.error(text("Favoriet kon niet worden verwijderd.", "Favourite could not be removed."));
    } finally {
      setBusy("");
    }
  }
  async function add(place: FavoritePlace) {
    setBusy(`add:${place.id}`);
    try {
      if (await onAdd(place)) setOpen(false);
    } catch {
      toast.error(text("Favoriet kon niet worden toegevoegd.", "Favourite could not be added."));
    } finally {
      setBusy("");
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <Star className="size-4" />
          {text("Favoriete plaatsen", "Favourite places")}
          {favorites.length > 0 && (
            <span className="text-xs text-muted-foreground">({favorites.length})</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{text("Favoriete plaatsen", "Favourite places")}</DialogTitle>
          <DialogDescription>
            {text(
              "Bewaar persoonlijke plaatsen en voeg ze later aan iedere reis toe. Favorieten zijn alleen voor jou zichtbaar.",
              "Save personal places and add them to any trip later. Favourites are visible only to you.",
            )}
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{text("Laden…", "Loading…")}</p>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold">{text("Opgeslagen", "Saved")}</h3>
              {favorites.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {text("Nog geen favoriete plaatsen.", "No favourite places yet.")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {favorites.map((place) => {
                    const present = stops.some((stop) => samePlace(stop, place));
                    return (
                      <li key={place.id} className="flex items-center gap-2 rounded-lg border p-3">
                        <MapPin className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <strong className="block break-words text-sm">{place.name}</strong>
                          <span className="text-xs text-muted-foreground">{place.country}</span>
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!editable || present || Boolean(busy)}
                          onClick={() => void add(place)}
                        >
                          <Plus className="size-3.5" />
                          {present ? text("In route", "In route") : text("Toevoegen", "Add")}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={Boolean(busy)}
                          aria-label={text("Favoriet verwijderen", "Remove favourite")}
                          onClick={() => void remove(place.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {routeOnly.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">
                  {text("Uit deze route bewaren", "Save from this route")}
                </h3>
                <ul className="space-y-2">
                  {routeOnly.map((stop) => (
                    <li key={stop.id} className="flex items-center gap-2 rounded-lg border p-3">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 break-words text-sm">
                        {stop.name}
                        {stop.country ? ` · ${stop.country}` : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(busy)}
                        onClick={() => void save(stop)}
                      >
                        <Star className="size-3.5" />
                        {text("Bewaren", "Save")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
