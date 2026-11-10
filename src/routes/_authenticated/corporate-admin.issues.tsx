import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlatformAnnouncementsAdmin } from "@/components/platform-announcements-admin";
import { ApplicationDiagnosticsAdmin } from "@/components/application-diagnostics-admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyCorporateCapabilities } from "@/lib/corporate-business.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/issues")({ component: IssuesPage });
function IssuesPage() {
  const { text } = useLocale();
  const access = useQuery({ queryKey: ["corporate-capabilities"], queryFn: () => getMyCorporateCapabilities(), retry: false });
  if (access.isPending) return <p role="status">{text("Laden...", "Loading...")}</p>;
  if (!access.data?.permissions.operations) return <p role="alert">{text("Geen toegang tot problemenbeheer.", "No access to issue management.")}</p>;
  return <Tabs defaultValue="incidents" className="space-y-4">
    <TabsList className="h-auto flex-wrap">
      <TabsTrigger value="incidents">{text("Incidenten", "Incidents")}</TabsTrigger>
      <TabsTrigger value="diagnostics">{text("Technische fouten", "Application errors")}</TabsTrigger>
    </TabsList>
    <TabsContent value="incidents"><PlatformAnnouncementsAdmin mode="incidents" /></TabsContent>
    <TabsContent value="diagnostics"><ApplicationDiagnosticsAdmin owner={access.data.role === "owner"} /></TabsContent>
  </Tabs>;
}
