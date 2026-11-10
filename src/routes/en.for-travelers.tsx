import { createFileRoute } from "@tanstack/react-router";
import { TravelersPage } from "./for-travelers";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/for-travelers")({ head: () => marketingHead("/for-travelers", "en-GB"), component: TravelersPage });
