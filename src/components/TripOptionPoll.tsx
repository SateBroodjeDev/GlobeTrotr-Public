import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import type { TravelOption } from "@/lib/types";

type Poll = {
  id: string;
  option_ids: string[];
  option_labels: Record<string, string>;
  closes_at: string | null;
  status: "open" | "closed";
  chosen_option_id: string | null;
};
type VoteRow = { user_id: string; option_id: string };
type PollClient = { from: (table: string) => any };
const db = supabase as unknown as PollClient;

export function TripOptionPoll({
  tripId,
  options,
  editable,
}: {
  tripId: string;
  options: TravelOption[];
  editable: boolean;
}) {
  const { user } = useAuth();
  const { locale, text } = useLocale();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const candidates = options.filter((option) => option.status === "candidate");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pollResult = await db.from("trip_option_polls")
        .select("id,option_ids,option_labels,closes_at,status,chosen_option_id")
        .eq("trip_uuid", tripId).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (pollResult.error) throw pollResult.error;
      const current = (pollResult.data ?? null) as Poll | null;
      setPoll(current);
      if (!current) { setVotes([]); return; }
      const voteResult = await db.from("trip_option_votes")
        .select("user_id,option_id").eq("poll_id", current.id);
      if (voteResult.error) throw voteResult.error;
      setVotes((voteResult.data ?? []) as VoteRow[]);
    } catch {
      toast.error(text("Peiling kon niet worden geladen.", "Poll could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [tripId, text]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 4 ? [...current, id] : current);
  }

  async function create() {
    if (!user || !editable || selected.length < 2 || selected.length > 4) return;
    if (poll?.status === "open") return;
    const closesAt = deadline ? new Date(deadline) : null;
    if (closesAt && (Number.isNaN(closesAt.getTime()) || closesAt <= new Date())) {
      toast.error(text("Kies een toekomstige deadline.", "Choose a future deadline."));
      return;
    }
    setBusy(true);
    try {
      const result = await db.from("trip_option_polls").insert({
        trip_uuid: tripId, option_ids: selected, created_by: user.id,
        closes_at: closesAt?.toISOString() ?? null,
      });
      if (result.error) throw result.error;
      setSelected([]);
      setDeadline("");
      await load();
      toast.success(text("Peiling gestart.", "Poll started."));
    } catch {
      toast.error(text("Peiling kon niet worden gestart. Controleer de kandidaten en reisrechten.",
        "Poll could not be started. Check the candidates and trip permissions."));
    } finally { setBusy(false); }
  }

  async function cast(optionId: string | null) {
    if (!user || !poll || poll.status !== "open") return;
    setBusy(true);
    try {
      const existing = votes.find((vote) => vote.user_id === user.id);
      const query = optionId === null
        ? db.from("trip_option_votes").delete().eq("poll_id", poll.id).eq("user_id", user.id)
        : existing
          ? db.from("trip_option_votes").update({ option_id: optionId })
            .eq("poll_id", poll.id).eq("user_id", user.id)
          : db.from("trip_option_votes").insert({ poll_id: poll.id, user_id: user.id, option_id: optionId });
      const result = await query;
      if (result.error) throw result.error;
      await load();
    } catch {
      toast.error(text("Stem kon niet worden opgeslagen. Mogelijk is de peiling verlopen.",
        "Vote could not be saved. The poll may have expired."));
    } finally { setBusy(false); }
  }

  async function close(optionId: string) {
    if (!poll || !editable || !window.confirm(text(
      "Deze keuze definitief vastleggen? Dit maakt nog geen boeking.",
      "Confirm this choice? This does not create a booking yet.",
    ))) return;
    setBusy(true);
    try {
      const result = await db.from("trip_option_polls").update({
        status: "closed", chosen_option_id: optionId, closed_at: new Date().toISOString(),
      }).eq("id", poll.id).eq("trip_uuid", tripId);
      if (result.error) throw result.error;
      await load();
      toast.success(text("Keuze vastgelegd.", "Choice confirmed."));
    } catch {
      toast.error(text("Keuze kon niet worden vastgelegd.", "Choice could not be confirmed."));
    } finally { setBusy(false); }
  }

  const expired = Boolean(poll?.closes_at && new Date(poll.closes_at) <= new Date());
  const canVote = poll?.status === "open" && !expired;
  const myVote = votes.find((vote) => vote.user_id === user?.id)?.option_id;

  return (
    <Card className="surface">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><Vote className="size-5 text-primary" />
            {text("Samen kiezen", "Decide together")}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{text(
            "Stem op een kandidaat. Een planner legt de definitieve keuze vast; boeken gebeurt apart.",
            "Vote for a candidate. A planner confirms the final choice; booking is separate.",
          )}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label={text("Peiling verversen", "Refresh poll")}
          disabled={loading || busy} onClick={() => void load()}><RefreshCw className="size-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">{text("Laden…", "Loading…")}</p>}
        {!loading && poll && <>
          <p className="text-sm text-muted-foreground">
            {poll.status === "closed" ? text("Afgesloten", "Closed")
              : expired ? text("Stemtermijn verstreken", "Voting deadline passed")
                : text("Peiling open", "Poll open")}
            {poll.closes_at && ` · ${text("Deadline", "Deadline")}: ${new Date(poll.closes_at).toLocaleString(locale)}`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {poll.option_ids.map((id) => {
              const count = votes.filter((vote) => vote.option_id === id).length;
              return <div key={id} className="min-w-0 space-y-2 rounded-lg border p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <strong className="min-w-0 break-words text-sm">{poll.option_labels[id] || text("Verwijderde kandidaat", "Deleted candidate")}</strong>
                  {poll.chosen_option_id === id && <Check className="size-4 shrink-0 text-primary" aria-label={text("Gekozen", "Chosen")} />}
                </div>
                <p className="text-xs text-muted-foreground">{count} {count === 1 ? text("stem", "vote") : text("stemmen", "votes")}</p>
                <div className="flex flex-wrap gap-2">
                  {canVote && <Button type="button" size="sm" variant={myVote === id ? "secondary" : "outline"}
                    disabled={busy || myVote === id} onClick={() => void cast(id)}>
                    {myVote === id ? text("Jouw stem", "Your vote") : text("Stem hierop", "Vote for this")}
                  </Button>}
                  {editable && poll.status === "open" && <Button type="button" size="sm" variant="outline"
                    disabled={busy} onClick={() => void close(id)}>{text("Kies definitief", "Confirm choice")}</Button>}
                </div>
              </div>;
            })}
          </div>
          {canVote && myVote && <Button type="button" size="sm" variant="ghost" disabled={busy}
            onClick={() => void cast(null)}>{text("Stem intrekken", "Withdraw vote")}</Button>}
        </>}
        {!loading && !poll && <p className="text-sm text-muted-foreground">{text(
          "Nog geen peiling voor deze reis.", "No poll for this trip yet.",
        )}</p>}
        {!loading && editable && poll?.status !== "open" && candidates.length >= 2 && <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">{text("Nieuwe peiling: kies twee tot vier kandidaten", "New poll: choose two to four candidates")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((option) => <label key={option.id} className="flex min-w-0 items-start gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={selected.includes(option.id)}
                disabled={!selected.includes(option.id) && selected.length >= 4}
                onChange={() => toggle(option.id)} />
              <span className="min-w-0 break-words">{option.title}</span>
            </label>)}
          </div>
          <label className="block max-w-xs space-y-1 text-sm">
            <span>{text("Deadline (optioneel)", "Deadline (optional)")}</span>
            <Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </label>
          <Button type="button" disabled={busy || selected.length < 2} onClick={() => void create()}>
            {text("Peiling starten", "Start poll")}
          </Button>
        </div>}
      </CardContent>
    </Card>
  );
}
