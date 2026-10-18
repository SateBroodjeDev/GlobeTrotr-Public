import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Gauge,
  Inbox,
  KeyRound,
  Landmark,
  Mail,
  MessageSquare,
  Scale,
  Server,
  ShieldCheck,
  Star,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyCorporateCapabilities } from "@/lib/corporate-business.functions";
import { useLocale } from "@/lib/locale";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { staffLoginOptions } from "@/lib/staff-sso";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/corporate-admin")({
  beforeLoad: ({ context }) => {
    if (context.user.app_metadata?.corporate_admin !== true) throw redirect({ to: "/dashboard" });
  },
  component: Layout,
});

function Layout() {
  const { text } = useLocale();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [loginError, setLoginError] = useState(false);
  const { user } = Route.useRouteContext();
  const security = useQuery({ queryKey: ["corporate-staff-security", user.id], queryFn: () => getStaffSecurityStatus(), retry: false, staleTime: 0, refetchInterval: 60_000 });
  const access = useQuery({
    queryKey: ["corporate-capabilities"],
    queryFn: () => getMyCorporateCapabilities(),
    retry: false,
    enabled: security.isSuccess && (!security.data.enforced || security.data.verifiedSession),
  });
  if (!security.isSuccess || !security.data.linked || (security.data.enforced && !security.data.verifiedSession)) return (
    <section className="mx-auto max-w-xl space-y-4 rounded-xl border p-6">
      <h1 className="font-display text-xl font-semibold">{text("Welkom bij het GlobeTrotr-team", "Welcome to the GlobeTrotr team")}</h1>
      <p>{text("Beheer vraagt een beveiligde Teamlogin. Je bestaande account en reizen blijven behouden.", "Administration requires secure team sign-in. Your existing account and trips are preserved.")}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>{text("Je beheerder maakt een persoonlijk Authentik-account en kent de juiste staffgroep toe.", "Your administrator creates a personal Authentik account and assigns the appropriate staff group.")}</li>
        <li>{text("Stel 2FA en een afzonderlijk herstelmiddel in via Teambeveiliging. Deel geen codes of wachtwoorden.", "Set up MFA and a separate recovery method in team security. Never share codes or passwords.")}</li>
        <li>{text("Koppel vanuit Account je eigen teamidentiteit aan je bestaande GlobeTrotr-account.", "Link your own team identity to your existing GlobeTrotr account from Account.")}</li>
        <li>{text("Meld je aan met Teamlogin. Je toegewezen rol bepaalt daarna wat je mag doen.", "Sign in using team sign-in. Your assigned role determines what you can do.")}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/account">{text("Accountkoppeling", "Account linking")}</Link></Button>
        <Button asChild variant="outline"><a href="https://sso.globetrotr.nl/if/user/" target="_blank" rel="noopener noreferrer">{text("Teambeveiliging", "Team security")}</a></Button>
        <Button disabled={!security.isSuccess} onClick={() => void supabase.auth.signInWithOAuth(staffLoginOptions(path, text("nl", "en"))).then(({ error }) => setLoginError(Boolean(error))).catch(() => setLoginError(true))}>{text("Teamlogin", "Team sign-in")}</Button>
      </div>
      {loginError && <p role="alert">{text("Teamlogin is niet beschikbaar. Neem contact op met je beheerder.", "Team sign-in is unavailable. Contact your administrator.")}</p>}
      {security.isError && <p role="alert">{text("De beveiligingscontrole is niet beschikbaar. Beheer blijft gesloten.", "The security check is unavailable. Administration remains closed.")}</p>}
    </section>
  );
  const permissions = access.data?.permissions;
  const links = [
    {
      to: "/corporate-admin",
      label: text("Overzicht", "Overview"),
      icon: Gauge,
      show: true,
      exact: true,
    },
    {
      to: "/corporate-admin/users",
      label: text("Gebruikers", "Users"),
      icon: Users,
      show: permissions?.users,
    },
    {
      to: "/corporate-admin/staff",
      label: text("Medewerkers", "Staff"),
      icon: UserCog,
      show: access.data?.role === "owner",
    },
    {
      to: "/corporate-admin/agencies",
      label: "Agencies",
      icon: Building2,
      show: permissions?.agencies,
    },
    {
      to: "/corporate-admin/finance",
      label: text("Financiën", "Finance"),
      icon: Landmark,
      show: permissions?.finance,
    },
    {
      to: "/corporate-admin/licenses",
      label: text("Licenties", "Licences"),
      icon: KeyRound,
      show: permissions?.finance || access.data?.role === "owner",
    },
    {
      to: "/corporate-admin/mail",
      label: text("Bedrijfsmail", "Company mail"),
      icon: Inbox,
      show: permissions?.mail,
    },
    {
      to: "/corporate-admin/contact",
      label: text("Contact", "Contact"),
      icon: Mail,
      show: permissions?.mail,
    },
    {
      to: "/corporate-admin/status",
      label: "Status",
      icon: Activity,
      show: permissions?.operations,
    },
    {
      to: "/corporate-admin/infrastructure",
      label: text("Infrastructuur", "Infrastructure"),
      icon: Server,
      show: access.data?.role === "owner",
    },
    {
      to: "/corporate-admin/release-checklist",
      label: text("Releasecheck", "Release check"),
      icon: ClipboardCheck,
      show: permissions?.operations,
    },
    {
      to: "/corporate-admin/governance",
      label: text("Governance", "Governance"),
      icon: Scale,
      show: permissions?.operations,
    },
    {
      to: "/corporate-admin/notifications",
      label: text("Berichten", "Messages"),
      icon: MessageSquare,
      show: permissions?.operations,
    },
    {
      to: "/corporate-admin/issues",
      label: text("Problemen", "Issues"),
      icon: TriangleAlert,
      show: permissions?.issues,
    },
    {
      to: "/corporate-admin/feedback",
      label: "Feedback",
      icon: MessageSquare,
      show: permissions?.issues,
    },
    {
      to: "/corporate-admin/testimonials",
      label: text("Recensies", "Testimonials"),
      icon: Star,
      show: permissions?.issues,
    },
    {
      to: "/corporate-admin/public-trips",
      label: text("Openbare reizen", "Public trips"),
      icon: Eye,
      show: permissions?.issues,
    },
    {
      to: "/corporate-admin/audit",
      label: "Auditlog",
      icon: ShieldCheck,
      show: permissions?.operations || access.data?.role === "owner",
    },
  ] as const;
  const visible = links.filter((item) => item.show);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Corporate Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {text(
            "Beheer GlobeTrotr binnen jouw toegewezen bedrijfsrechten.",
            "Manage GlobeTrotr within your assigned company permissions.",
          )}
        </p>
      </header>
      {access.isError ? (
        <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {text(
            "Je bedrijfsrechten konden niet worden geladen.",
            "Your company permissions could not be loaded.",
          )}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <details className="group rounded-xl border bg-background lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              {visible.find((item) =>
                "exact" in item && item.exact
                  ? path === "/corporate-admin" || path === "/corporate-admin/"
                  : path.startsWith(item.to),
              )?.label ?? text("Beheermenu", "Admin menu")}
            </summary>
            <nav
              className="grid grid-cols-2 gap-1 border-t p-2 sm:grid-cols-3"
              aria-label="Corporate Admin"
            >
              {visible.map((item) => {
                const { to, label, icon: Icon } = item;
                const active =
                  "exact" in item && item.exact
                    ? path === "/corporate-admin" || path === "/corporate-admin/"
                    : path.startsWith(to);
                return (
                  <Button
                    key={to}
                    asChild
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    className="min-h-10 min-w-0 justify-start"
                  >
                    <Link to={to}>
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </details>
          <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
            <nav
              className="grid gap-1 rounded-xl border bg-background p-2"
              aria-label="Corporate Admin"
            >
              {visible.map((item) => {
                const { to, label, icon: Icon } = item;
                const active =
                  "exact" in item && item.exact
                    ? path === "/corporate-admin" || path === "/corporate-admin/"
                    : path.startsWith(to);
                return (
                  <Button
                    key={to}
                    asChild
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    className="min-w-0 justify-start"
                  >
                    <Link to={to}>
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
}
