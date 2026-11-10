import { createFileRoute } from "@tanstack/react-router";
import { DeploymentControlPanel } from "@/components/DeploymentControlPanel";
import { DevelopmentIssues } from "@/components/development-issues";
import { useQuery } from "@tanstack/react-query";
import { getMyCorporateCapabilities } from "@/lib/corporate-business.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/infrastructure")({
  component: Infrastructure,
});

function Infrastructure() {
  const { text } = useLocale();
  const access = useQuery({ queryKey: ["corporate-capabilities"], queryFn: () => getMyCorporateCapabilities(), retry: false });
  if (access.isPending) return <p role="status">{text("Laden...", "Loading...")}</p>;
  const owner = access.data?.role === "owner", development = Boolean(access.data?.permissions.issues);
  if (!owner && !development) return <p role="alert">{text("Geen toegang tot infrastructuur.", "No infrastructure access.")}</p>;
  return <Tabs defaultValue={owner ? "servers" : "development"} className="space-y-4">
    <TabsList className="h-auto flex-wrap">
      {owner && <TabsTrigger value="servers">{text("Servers en releases", "Servers and releases")}</TabsTrigger>}
      {development && <TabsTrigger value="development">Development</TabsTrigger>}
    </TabsList>
    {owner && <TabsContent value="servers"><DeploymentControlPanel /></TabsContent>}
    {development && <TabsContent value="development"><DevelopmentIssues /></TabsContent>}
  </Tabs>;
}
