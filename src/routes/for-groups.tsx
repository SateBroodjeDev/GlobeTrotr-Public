import { createFileRoute } from "@tanstack/react-router";
import { BellRing, ShieldCheck, Users } from "lucide-react";
import { AudiencePage } from "@/components/AudiencePage";
export const Route = createFileRoute("/for-groups")({
  head: () => ({
    meta: [
      { title: "Groepsreis plannen en kosten verdelen — GlobeTrotr" },
      {
        name: "description",
        content: "Plan je groepsreis samen: deel de route en boekingen, stem over ideeën en verdeel vakantiekosten eerlijk met je reisgenoten.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/for-groups" }],
  }),
  component: Page,
});
function Page() {
  return (
    <AudiencePage
      experience="groups"
      badge={["Voor groepen", "For groups"]}
      title={[
        "Samen plannen, zonder dat iedereen alles hoeft te beheren.",
        "Plan together, without everyone managing everything.",
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
    />
  );
}
