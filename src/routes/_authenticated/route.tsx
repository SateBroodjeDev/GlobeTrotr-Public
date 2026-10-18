import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { supabase } from "@/integrations/supabase/client";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { staffLoginRequired, authSessionCacheId } from "@/lib/staff-account-access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 150,
  pendingMinMs: 0,
  pendingComponent: AuthenticatedPending,
  beforeLoad: async ({ location }) => {
    // Keep the exact in-app location across a hard refresh and a sign-in roundtrip.
    // `href` is router/history implementation detail; pathname/search/hash is stable.
    const requestedPath = `${location.pathname}${location.searchStr}${location.hash}`;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: requestedPath } });
    const [security, { data: profile }] = await Promise.all([
      getStaffSecurityStatus(),
      supabase.from("profiles").select("onboarding_completed_at")
        .eq("id", data.user.id).maybeSingle(),
    ]);
    if (staffLoginRequired(security))
      throw redirect({ to: "/team-login", search: { redirect: requestedPath } });
    if (!profile?.onboarding_completed_at)
      throw redirect({ to: "/complete-profile", search: { next: requestedPath } });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedPending() {
  const { text } = useLocale();
  return (
    <section className="mx-auto flex max-w-xl items-center gap-3 p-6 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <p>{text("Pagina laden…", "Loading page…")}</p>
    </section>
  );
}

function AuthenticatedLayout() {
  const { user, session } = useAuth(),
    { text } = useLocale(),
    navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const destination = `${location.pathname}${location.searchStr}${location.hash}`;
  const security = useQuery({
    queryKey: ["account-session-security", user?.id, authSessionCacheId(session?.access_token)],
    queryFn: () => getStaffSecurityStatus(),
    enabled: Boolean(user),
    retry: false,
    refetchInterval: 60_000,
  });
  const needsLogin = security.isSuccess && staffLoginRequired(security.data);
  useEffect(() => {
    if (needsLogin)
      void navigate({ to: "/team-login", search: { redirect: destination }, replace: true });
  }, [needsLogin, navigate, destination]);
  if (!security.isSuccess || needsLogin)
    return (
      <section className="mx-auto max-w-xl p-6">
        <p role={security.isError ? "alert" : "status"}>
          {security.isError
            ? text(
                "De inlogcontrole is niet beschikbaar. Je account blijft gesloten.",
                "The sign-in check is unavailable. Your account remains closed.",
              )
            : text("Je inlog controleren…", "Checking your sign-in…")}
        </p>
        {security.isError && (
          <button className="mt-3 text-primary underline" onClick={() => void security.refetch()}>
            {text("Opnieuw proberen", "Retry")}
          </button>
        )}
      </section>
    );
  return <Outlet />;
}
