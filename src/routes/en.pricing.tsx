import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "./prijzen";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/pricing")({ head: () => marketingHead("/pricing", "en-GB"), component: PricingPage });
