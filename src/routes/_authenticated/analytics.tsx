import { createFileRoute, redirect } from "@tanstack/react-router";

// Bewaar bestaande bookmarks terwijl Operatie voortaan onderdeel is van de
// vaste Agency Admin-shell.
export const Route = createFileRoute("/_authenticated/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/agency-admin/operations" });
  },
});
