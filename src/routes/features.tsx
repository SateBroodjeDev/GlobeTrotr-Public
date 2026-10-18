import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "./mogelijkheden";
export const Route=createFileRoute("/features")({head:()=>({meta:[{title:"Reisplanner: routes, boekingen en reisdagboek — GlobeTrotr"},{name:"description",content:"Ontdek hoe je routes, boekingen, dagplanning, paklijsten, groepskosten en je reisdagboek samenbrengt in GlobeTrotr."}],links:[{rel:"canonical",href:"https://globetrotr.nl/features"}]}),component:FeaturesPage});
