import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stats")({
  server: {
    handlers: {
      GET: async () => {
        const { publicStatsResponse } = await import("@/lib/public-stats-db.server");
        return publicStatsResponse(process.env.PUBLIC_PLATFORM_STATS_ENABLED === "true");
      },
    },
  },
});
