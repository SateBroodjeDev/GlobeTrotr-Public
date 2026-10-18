import { createFileRoute } from "@tanstack/react-router";
import { tripCalendarResponse } from "@/lib/calendar-response.server";

export const Route = createFileRoute("/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return tripCalendarResponse(String(params.token ?? ""));
      },
    },
  },
});
