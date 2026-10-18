import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Registreren — GlobeTrotr" }, { name: "description", content: "Maak je GlobeTrotr-account aan en begin met het plannen van je reis." }] }),
  component: () => <AuthPage initialMode="signup" />,
});
