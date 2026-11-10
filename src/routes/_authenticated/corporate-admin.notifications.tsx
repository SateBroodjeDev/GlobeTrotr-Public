import { createFileRoute } from "@tanstack/react-router";
import { PlatformAnnouncementsAdmin } from "@/components/platform-announcements-admin";

export const Route = createFileRoute("/_authenticated/corporate-admin/notifications")({
  component: () => <PlatformAnnouncementsAdmin mode="updates" />,
});
