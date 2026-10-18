import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/report-content")({
  beforeLoad: () => {
    throw redirect({ to: "/contact", hash: "illegale-inhoud", statusCode: 301 });
  },
});
