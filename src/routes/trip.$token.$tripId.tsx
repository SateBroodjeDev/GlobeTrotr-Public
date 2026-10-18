import { createFileRoute } from "@tanstack/react-router";
import { PublicTrip } from "./reis.$token.$tripId";
export const Route=createFileRoute("/trip/$token/$tripId")({component:PublicTrip});
