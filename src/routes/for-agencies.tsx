import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness, Palette, UsersRound } from "lucide-react";
import { AudiencePage } from "@/components/AudiencePage";
export const Route = createFileRoute("/for-agencies")({
  head: () => ({
    meta: [
      { title: "Reisplanning en klantenbeheer voor reisorganisaties — GlobeTrotr" },
      {
        name: "description",
        content:
          "Beheer klanten, reizen, teamleden en documenten in GlobeTrotr Agency. Deel reisvoorstellen en reisinformatie in de huisstijl van je reisorganisatie.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/for-agencies" }],
  }),
  component: Page,
});
function Page() {
  return (
    <AudiencePage
      audience="agency"
      badge={["Voor reisprofessionals", "For travel professionals"]}
      title={[
        "Van klantaanvraag tot reisdocument in je eigen huisstijl.",
        "From client request to travel document in your own brand.",
      ]}
      intro={[
        "Beheer klanten, teamrechten, offertes, taken en reizen vanuit één Agency-workspace.",
        "Manage clients, team permissions, quotes, tasks and trips from one Agency workspace.",
      ]}
      highlights={[
        {
          icon: BriefcaseBusiness,
          title: ["Klanten en werkvoorraad", "Clients and operations"],
          body: [
            "Koppel klanten aan reizen en houd acties, offertes en deadlines zichtbaar.",
            "Connect clients to trips and keep actions, quotes and deadlines visible.",
          ],
        },
        {
          icon: UsersRound,
          title: ["Rechten per medewerker", "Permissions per team member"],
          body: [
            "Combineer een basisrol met gerichte uitzonderingen per persoon.",
            "Combine a base role with focused exceptions per person.",
          ],
        },
        {
          icon: Palette,
          title: ["Eigen merkbeleving", "Your own brand experience"],
          body: [
            "Gebruik bedrijfsnaam, logo, kleuren en contactgegevens op gedeelde reizen.",
            "Use your company name, logo, colours and contact details on shared trips.",
          ],
        },
      ]}
      workflow={[
        [
          "Richt de Agency-workspace en huisstijl in",
          "Configure the Agency workspace and branding",
        ],
        [
          "Voeg medewerkers en klanten met passende toegang toe",
          "Add team members and clients with suitable access",
        ],
        [
          "Lever iedere reis vanuit één gecontroleerd proces",
          "Deliver every trip from one controlled process",
        ],
      ]}
    />
  );
}
