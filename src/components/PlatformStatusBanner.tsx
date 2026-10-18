import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

export function PlatformStatusBanner({ userId }: { userId: string }) {
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const queryKey = ["notifications", userId];
  const query = useQuery({
    queryKey: ["platform-status-banners", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*")
        .eq("user_id", userId).eq("kind", "platform").is("dismissed_at", null)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data.filter((item) => {
        const parts = item.body.split("|");
        return parts[0] === "status" && parts[1] !== "resolved";
      });
    },
    refetchInterval: 30_000,
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-status-banners", userId] }),
        queryClient.invalidateQueries({ queryKey }),
      ]);
    },
  });
  if (!query.data?.length) return null;
  return <div className="mx-auto max-w-7xl space-y-2 px-4 pt-4">
    {query.data.map((item) => {
      const parts = item.body.split("|");
      const severity = parts[1];
      const title = locale.startsWith("nl") ? item.title : parts[2] || item.title;
      const body = locale.startsWith("nl") ? parts[3] || item.body : parts[4] || item.body;
      const critical = severity === "critical";
      const Icon = critical || severity === "warning" ? AlertTriangle : Info;
      return <aside key={item.id} role={critical ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${critical ? "border-destructive/40 bg-destructive/10 text-destructive" : severity === "warning" ? "border-amber-400/50 bg-amber-400/10" : "border-blue-400/40 bg-blue-400/10"}`}>
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="mt-0.5 whitespace-pre-wrap text-sm opacity-90">{body}</p></div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => dismiss.mutate(item.id)} aria-label={text("Statusbericht sluiten", "Dismiss status message")}><X className="size-4" /></Button>
      </aside>;
    })}
  </div>;
}
