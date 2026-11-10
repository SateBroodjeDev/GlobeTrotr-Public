import { marketingHead } from "@/lib/marketing-head";
import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "./mogelijkheden";
export const Route=createFileRoute("/features")({head: () => marketingHead("/features", "nl-NL"),component:FeaturesPage});
