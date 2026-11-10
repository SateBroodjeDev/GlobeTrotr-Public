import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "./about";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/about")({ head: () => marketingHead("/about", "en-GB"), component: AboutPage });
