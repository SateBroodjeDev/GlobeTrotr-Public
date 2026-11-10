import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyStatusUrl } from "@/lib/platform-status-link";

// Old bookmarks lead to the complete, independently hosted status page.
export const Route = createFileRoute("/status")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: legacyStatusUrl(location.searchStr, location.hash), statusCode: 301 });
  },
});
