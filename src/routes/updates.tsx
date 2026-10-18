import { createFileRoute } from "@tanstack/react-router";
import { ChangelogPage } from "./changelog";
export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Product updates — GlobeTrotr" },
      {
        name: "description",
        content: "Follow GlobeTrotr product releases, fixes and improvements.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/updates" }],
  }),
  component: ChangelogPage,
});
