import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "./mogelijkheden";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/features")({ head: () => marketingHead("/features", "en-GB"), component: FeaturesPage });
