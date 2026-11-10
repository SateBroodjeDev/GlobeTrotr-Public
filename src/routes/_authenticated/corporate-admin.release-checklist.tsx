import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve existing bookmarks after retiring the completed release checklist.
export const Route = createFileRoute("/_authenticated/corporate-admin/release-checklist")({
  beforeLoad: () => {
    throw redirect({ to: "/corporate-admin", replace: true });
  },
});
