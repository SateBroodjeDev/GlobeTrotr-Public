import { createFileRoute } from "@tanstack/react-router";
import { BetaPage } from "./beta-voorwaarden";
export const Route=createFileRoute("/beta")({head:()=>({meta:[{title:"Testing and release acceptance — GlobeTrotr"},{name:"description",content:"Test the GlobeTrotr release candidate, provide feedback and read test participation terms."}],links:[{rel:"canonical",href:"https://globetrotr.nl/beta"}]}),component:BetaPage});
