import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileLocale, supportedLocale } from "@/lib/locale-policy";

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
    let active = true;
    let revision = 0;
    const parentOrigin = (() => {
        try { const origin = new URL(document.referrer).origin; return ["https://globetrotr.nl", "https://www.globetrotr.nl"].includes(origin) ? origin : "https://globetrotr.nl"; }
        catch { return "https://globetrotr.nl"; }
    })();
    const refresh = async () => {
      const currentRevision = ++revision;
      const { data } = await supabase.auth.getSession();
      if (!active || currentRevision !== revision) return;
      const user = data.session?.user;
      if (!user) {
        window.parent.postMessage({ type: "globetrotr:session-summary", summary: null }, parentOrigin);
        setDone(true);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("display_name, avatar_path, locale").eq("id", user.id).maybeSingle();
      let avatarUrl: string | undefined;
      if (profile?.avatar_path) {
        const signed = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60);
        avatarUrl = signed.data?.signedUrl;
      }
      if (!active || currentRevision !== revision) return;
      window.parent.postMessage({ type: "globetrotr:session-summary", summary: {
        authenticated: true,
        displayName: profile?.display_name || String(user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "Account"),
        avatarUrl,
        locale: profileLocale(profile?.locale, user.user_metadata.language),
      } }, parentOrigin);
      setDone(true);
    };
    let saving = false;
    const receive = async (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      if (event.data?.type === "globetrotr:session-request") {
        if (!saving) void refresh();
        return;
      }
      if (event.data?.type !== "globetrotr:set-locale") return;
      const locale = supportedLocale(event.data.locale);
      const requestId = event.data.requestId;
      if (!locale || typeof requestId !== "string" || requestId.length > 100 || saving) return;
      saving = true;
      ++revision;
      let success = false;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Not signed in");
        const [{ error: profileError }, { error: metadataError }] = await Promise.all([
          supabase.from("profiles").upsert({ id: data.user.id, locale }),
          supabase.auth.updateUser({ data: { language: locale === "nl-NL" ? "nl" : "en" } }),
        ]);
        if (profileError || metadataError) throw new Error("Language save failed");
        success = true;
      } catch { /* Report failure without sharing auth details with the parent. */ }
      finally { saving = false; }
      if (!active) return;
      window.parent.postMessage({ type: "globetrotr:locale-saved", requestId, success }, parentOrigin);
      void refresh();
    };
    window.addEventListener("message", receive);
    void refresh();
    const interval = window.setInterval(() => { if (!saving) void refresh(); }, 30_000);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("message", receive); };
  }, []);
  return <span className="sr-only">{done ? "Session checked" : "Checking session"}</span>;
}
