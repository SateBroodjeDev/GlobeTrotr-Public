import { createFileRoute } from "@tanstack/react-router";
import { staffAvatarResponse } from "@/lib/staff-profile-outbound.server";

export const Route = createFileRoute("/api/staff-avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return staffAvatarResponse(
          request,
          supabaseAdmin,
          process.env.STAFF_SESSION_SIGNING_KEY || "",
        );
      },
    },
  },
});
