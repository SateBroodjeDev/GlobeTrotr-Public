import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/profiel/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/users/$username",
      params: { username: params.slug },
      replace: true,
    });
  },
});
