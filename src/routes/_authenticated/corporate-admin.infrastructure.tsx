import { createFileRoute } from "@tanstack/react-router";
import { DeploymentControlPanel } from "@/components/DeploymentControlPanel";

export const Route = createFileRoute("/_authenticated/corporate-admin/infrastructure")({
  component: DeploymentControlPanel,
});
