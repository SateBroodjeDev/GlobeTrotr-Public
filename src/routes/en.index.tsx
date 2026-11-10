import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "./index";
import { marketingHead } from "@/lib/marketing-head";
export const Route = createFileRoute("/en/")({ head: () => marketingHead("/", "en-GB"), component: Landing });
