import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyStatusUrl } from "@/lib/platform-status-link";

export const Route = createFileRoute("/known-issues")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: legacyStatusUrl(location.searchStr, location.hash), statusCode: 301 });
  },
});
