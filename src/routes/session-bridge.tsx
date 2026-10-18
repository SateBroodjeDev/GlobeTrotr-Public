import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/session-bridge")({
  head: () => ({ meta: [{ title: "GlobeTrotr session bridge" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SessionBridge,
});

function SessionBridge() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.location.hostname !== "portal.globetrotr.nl" || window.parent === window) {
      setDone(true);
      return;
    }
    const refresh = async () => {
      const parentOrigin = (() => {
        try { const origin = new URL(document.referrer).origin; return ["https://globetrotr.nl", "https://www.globetrotr.nl"].includes(origin) ? origin : "https://globetrotr.nl"; }
        catch { return "https://globetrotr.nl"; }
      })();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.parent.postMessage({ type: "globetrotr:session-summary", summary: null }, parentOrigin);
        setDone(true);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("display_name, avatar_path").eq("id", user.id).maybeSingle();
      let avatarUrl: string | undefined;
      if (profile?.avatar_path) {
        const signed = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60);
        avatarUrl = signed.data?.signedUrl;
      }
      window.parent.postMessage({ type: "globetrotr:session-summary", summary: {
        authenticated: true,
        displayName: profile?.display_name || String(user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "Account"),
        avatarUrl,
      } }, parentOrigin);
      setDone(true);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return <span className="sr-only">{done ? "Session checked" : "Checking session"}</span>;
}
