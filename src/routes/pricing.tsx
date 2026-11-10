import { marketingHead } from "@/lib/marketing-head";
import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "./prijzen";
export const Route=createFileRoute("/pricing")({head: () => marketingHead("/pricing", "nl-NL"),component:PricingPage});
