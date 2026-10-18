import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";

type Comment = { id: string; author_id: string; body: string; created_at: string };
type CommentsClient = { from: (table: string) => any };
const commentsDb = supabase as unknown as CommentsClient;

export function TripOptionDiscussion({ tripId, optionId }: { tripId: string; optionId: string }) {
  const { user } = useAuth();
  const { locale, text } = useLocale();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await commentsDb
        .from("trip_option_comments")
        .select("id,author_id,body,created_at")
        .eq("trip_uuid", tripId)
        .eq("option_id", optionId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      setComments((data ?? []) as Comment[]);
    } catch {
      toast.error(text("Reacties konden niet worden geladen.", "Comments could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [optionId, text, tripId]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  async function submit() {
    const body = draft.trim();
    if (!user || !body || body.length > 1000) return;
    setSaving(true);
    try {
      const { error } = await commentsDb
        .from("trip_option_comments")
        .insert({ trip_uuid: tripId, option_id: optionId, author_id: user.id, body });
      if (error) throw error;
      setDraft("");
      await load();
    } catch {
      toast.error(text("Reactie kon niet worden geplaatst.", "Comment could not be posted."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!user || !window.confirm(text("Je reactie verwijderen?", "Delete your comment?"))) return;
    try {
      const { error } = await commentsDb
        .from("trip_option_comments")
        .delete()
        .eq("id", id)
        .eq("trip_uuid", tripId)
        .eq("author_id", user.id);
      if (error) throw error;
      setComments((current) => current.filter((comment) => comment.id !== id));
    } catch {
      toast.error(text("Reactie kon niet worden verwijderd.", "Comment could not be deleted."));
    }
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MessageCircle className="size-4" /> {text("Bespreken", "Discuss")}
      </Button>
      {open && (
        <div className="space-y-3">
          {loading && (
            <p className="text-xs text-muted-foreground">
              {text("Reacties laden…", "Loading comments…")}
            </p>
          )}
          {!loading && !comments.length && (
            <p className="text-xs text-muted-foreground">
              {text("Nog geen reacties bij deze kandidaat.", "No comments for this candidate yet.")}
            </p>
          )}
          <div className="max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {comment.author_id === user?.id
                      ? text("Jij", "You")
                      : text("Reisgenoot", "Trip member")}
                    {" · "}
                    {new Date(comment.created_at).toLocaleString(locale)}
                  </p>
                  {comment.author_id === user?.id && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={text("Reactie verwijderen", "Delete comment")}
                      onClick={() => void remove(comment.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              </div>
            ))}
          </div>
          {user && (
            <div className="space-y-2">
              <Textarea
                value={draft}
                maxLength={1000}
                rows={3}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={text("Reactie", "Comment")}
                placeholder={text(
                  "Wat vind je van deze kandidaat?",
                  "What do you think of this candidate?",
                )}
              />
              <Button
                type="button"
                size="sm"
                disabled={saving || !draft.trim()}
                onClick={() => void submit()}
              >
                <Send className="size-4" />
                {text("Reactie plaatsen", "Post comment")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
