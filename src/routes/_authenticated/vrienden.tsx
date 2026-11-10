import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale";
import { useAuth } from "@/lib/auth";
import { changeFriendship, listMyFriendships, searchTravelerProfiles } from "@/lib/social-profile.functions";
import type { FriendshipChange } from "@/lib/friendship.server";

type Traveler = { name: string; slug?: string | null; avatarUrl?: string };
export const Route = createFileRoute("/_authenticated/vrienden")({ component: FriendsPage });
function FriendsPage() {
  const { text } = useLocale();
  const { user } = useAuth();
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const [settledQuery, setSettledQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(normalizedQuery), 300);
    return () => clearTimeout(timer);
  }, [normalizedQuery]);
  const currentSearch = normalizedQuery === settledQuery && settledQuery.length >= 2;
  const friends = useQuery({ queryKey: ["my-friendships", user?.id], queryFn: () => listMyFriendships() });
  const search = useQuery({ queryKey: ["traveler-search", user?.id, settledQuery], enabled: Boolean(user) && currentSearch,
    staleTime: 30_000, refetchOnWindowFocus: false, retry: false,
    queryFn: () => searchTravelerProfiles({ data: { query: settledQuery } }) });
  const change = useMutation({ mutationFn: (data: FriendshipChange) => changeFriendship({ data }),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ["my-friendships"] }),
        client.invalidateQueries({ queryKey: ["friendship"] }), client.invalidateQueries({ queryKey: ["public-traveler-profile"] })]);
      toast.success(text("Vriendschap bijgewerkt.", "Friendship updated."));
    }, onError: () => toast.error(text("De actie is niet gelukt. Probeer het opnieuw.", "The action failed. Please try again.")) });
  const rows = friends.data ?? [];
  const incoming = rows.filter(item => item.status === "pending" && item.incoming);
  const outgoing = rows.filter(item => item.status === "pending" && !item.incoming);
  const accepted = rows.filter(item => item.status === "accepted");
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="font-display text-3xl font-semibold">{text("Vrienden", "Friends")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{text("Vind reizigers via hun openbare profiel en beheer verzoeken.", "Find travelers through their public profile and manage requests.")}</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="size-5" />{text("Reizigers zoeken", "Find travelers")}</CardTitle></CardHeader>
      <CardContent className="space-y-3"><Input value={query} onChange={event => setQuery(event.target.value)} aria-label={text("Reizigers zoeken", "Find travelers")} placeholder={text("Zoek op naam of profielnaam...", "Search by name or profile name...")} />
        {normalizedQuery.length >= 2 && (!currentSearch || search.isFetching) && <p role="status" className="text-sm text-muted-foreground">{text("Zoeken...", "Searching...")}</p>}
        {currentSearch && search.isError && <div className="space-y-2"><p role="alert">{text("Zoeken is niet gelukt. Probeer het opnieuw.", "Search failed. Please try again.")}</p><Button size="sm" variant="outline" disabled={search.isFetching} onClick={() => void search.refetch()}>{text("Opnieuw proberen", "Retry")}</Button></div>}
        {currentSearch && <div className="grid gap-2">{(search.data ?? []).map(profile => {
          const relation = rows.find(item => item.slug === profile.slug);
          return <FriendRow key={profile.slug} item={profile} action={relation?.status === "accepted"
            ? <span className="text-xs text-muted-foreground">{text("Vrienden", "Friends")}</span>
            : relation ? <Button size="sm" variant="outline" disabled={change.isPending || friends.isPending || friends.isError} onClick={() => change.mutate({ friendshipId: relation.id, action: relation.incoming ? "accept" : "remove" })}>
                {relation.incoming ? text("Accepteren", "Accept") : text("Intrekken", "Withdraw")}</Button>
              : <Button size="sm" disabled={change.isPending || friends.isPending || friends.isError} onClick={() => change.mutate({ slug: profile.slug, action: "request" })}><UserPlus className="size-4" />{text("Toevoegen", "Add")}</Button>} />;
        })}</div>}
        {currentSearch && search.isSuccess && !search.data.length && <p className="text-sm text-muted-foreground">{text("Geen openbare profielen gevonden.", "No public profiles found.")}</p>}
      </CardContent></Card>
    {friends.isError && <div role="alert"><p>{text("Verzoeken konden niet worden geladen.", "Could not load requests.")}</p><Button variant="outline" onClick={() => void friends.refetch()}>{text("Opnieuw proberen", "Try again")}</Button></div>}
    {incoming.length > 0 && <Card><CardHeader><CardTitle>{text("Ontvangen verzoeken", "Received requests")}</CardTitle></CardHeader><CardContent className="grid gap-2">{incoming.map(item => <FriendRow key={item.id} item={item} action={<div className="flex flex-wrap gap-2"><Button size="sm" disabled={change.isPending} onClick={() => change.mutate({ friendshipId: item.id, action: "accept" })}><Check className="size-4" />{text("Accepteren", "Accept")}</Button><Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate({ friendshipId: item.id, action: "remove" })}>{text("Afwijzen", "Decline")}</Button></div>} />)}</CardContent></Card>}
    {outgoing.length > 0 && <Card><CardHeader><CardTitle>{text("Verstuurde verzoeken", "Sent requests")}</CardTitle></CardHeader><CardContent className="grid gap-2">{outgoing.map(item => <FriendRow key={item.id} item={item} action={<Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate({ friendshipId: item.id, action: "remove" })}><X className="size-4" />{text("Intrekken", "Withdraw")}</Button>} />)}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-5" />{text("Mijn vrienden", "My friends")}</CardTitle></CardHeader><CardContent className="grid gap-2">{friends.isPending ? <p role="status">{text("Laden...", "Loading...")}</p> : accepted.length ? accepted.map(item => <FriendRow key={item.id} item={item} action={<Button size="sm" variant="ghost" disabled={change.isPending} onClick={() => change.mutate({ friendshipId: item.id, action: "remove" })}><UserMinus className="size-4" />{text("Verwijderen", "Remove")}</Button>} />) : !friends.isError && <p className="text-sm text-muted-foreground">{text("Je hebt nog geen geaccepteerde vrienden.", "You do not have accepted friends yet.")}</p>}</CardContent></Card>
  </div>;
}
function FriendRow({ item, action }: { item: Traveler; action: ReactNode }) {
  const { text } = useLocale();
  const identity = <><Avatar className="size-10 shrink-0"><AvatarImage src={item.avatarUrl} alt="" /><AvatarFallback>{item.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><span className="block truncate font-medium">{item.name}</span>{item.slug && <span className="block truncate text-xs text-muted-foreground">@{item.slug} · {text("Profiel bekijken", "View profile")}</span>}</div></>;
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
    {item.slug ? <Link className="flex min-w-0 flex-1 items-center gap-3 rounded hover:underline focus-visible:outline focus-visible:outline-2" to="/users/$username" params={{ username: item.slug }}>{identity}</Link> : <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>}{action}
  </div>;
}
