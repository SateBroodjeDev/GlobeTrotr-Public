import { createFileRoute } from "@tanstack/react-router";
import { GroupsPage } from "./for-groups";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/for-groups")({ head: () => marketingHead("/for-groups", "en-GB"), component: GroupsPage });
