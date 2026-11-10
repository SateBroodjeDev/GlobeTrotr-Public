import { marketingHead } from "@/lib/marketing-head";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, ShieldCheck, Users } from "lucide-react";
import { AudiencePage } from "@/components/AudiencePage";
import { TravelPlanningExample } from "@/components/TravelPlanningExample";
export const Route = createFileRoute("/for-groups")({
  head: () => marketingHead("/for-groups", "nl-NL"),
  component: GroupsPage,
});
export function GroupsPage() {
  return (
    <AudiencePage
      experience="groups"
      badge={["Voor groepen", "For groups"]}
      title={[
        "Samen je groepsreis plannen en reiskosten verdelen.",
        "Plan your group trip and split travel expenses together.",
      ]}
      intro={[
        "Geef iedere deelnemer de juiste rol en houd planning, besluiten, herinneringen en uitgaven voor de hele groep begrijpelijk.",
        "Give every participant the right role and keep plans, decisions, memories and expenses clear for the whole group.",
      ]}
      highlights={[
        {
          icon: Users,
          title: ["Duidelijke rollen", "Clear roles"],
          body: [
            "Laat mensen plannen, financiën beheren, herinneringen delen of veilig meekijken.",
            "Let people plan, manage finances, share memories or view safely.",
          ],
        },
        {
          icon: BellRing,
          title: ["Gerichte meldingen", "Relevant notifications"],
          body: [
            "Belangrijke wijzigingen komen bij de juiste deelnemers terecht.",
            "Important changes reach the right participants.",
          ],
        },
        {
          icon: ShieldCheck,
          title: ["Privacy per onderdeel", "Privacy by area"],
          body: [
            "Financiële gegevens blijven beperkt en ieder dagboekitem krijgt een bewuste zichtbaarheid.",
            "Financial data stays restricted and every journal memory gets an explicit visibility choice.",
          ],
        },
      ]}
      workflow={[
        ["Maak de gezamenlijke reis", "Create the shared trip"],
        [
          "Nodig deelnemers uit en verdeel verantwoordelijkheden",
          "Invite participants and assign responsibilities",
        ],
        [
          "Plan, stem, verreken en bewaar herinneringen in dezelfde reis",
          "Plan, vote, settle and keep memories in the same trip",
        ],
      ]}
    ><TravelPlanningExample kind="expenses" /></AudiencePage>
  );
}
