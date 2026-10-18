import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";
import { authEmailDestination, authEmailType } from "@/lib/auth-email-flow";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";

export const Route = createFileRoute("/token/$tokenHash")({
  validateSearch: (search: Record<string, unknown>) => ({ type: authEmailType(search["type"]) }),
  component: TokenPage,
});

function TokenPage() {
  const { tokenHash } = Route.useParams();
  const { type } = Route.useSearch();
  const { text } = useLocale();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        const status = data.session ? await getStaffSecurityStatus() : null;
        if (!active) return;
        setState("success");
        const destination = status ? authEmailDestination(type, status.isStaff) : "/auth";
        if (destination === "/team-login") {
          await navigate({ to: destination, search: { redirect: "/dashboard" }, replace: true });
        } else {
          await navigate({ to: destination, replace: true });
        }
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, tokenHash, type]);
  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state === "loading" ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : state === "success" ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            {state === "loading"
              ? text("Link controleren", "Checking link")
              : state === "success"
                ? text("Account bevestigd", "Account confirmed")
                : text("Link niet geldig", "Invalid link")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {state === "loading"
              ? text(
                  "Even geduld terwijl we je beveiligde link controleren.",
                  "Please wait while we verify your secure link.",
                )
              : state === "success"
                ? type === "recovery"
                  ? text(
                      "Je wordt doorgestuurd om een nieuw wachtwoord in te stellen.",
                      "You are being redirected to choose a new password.",
                    )
                  : text(
                      "Je wordt doorgestuurd naar je reizen.",
                      "You are being redirected to your trips.",
                    )
                : text(
                    "Deze link is verlopen of al gebruikt. Vraag vanuit het inlogscherm een nieuwe link aan.",
                    "This link has expired or has already been used. Request a new link from the sign-in page.",
                  )}
          </p>
          {state === "error" && (
            <Button asChild>
              <Link to="/auth">{text("Naar inloggen", "Go to sign in")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
