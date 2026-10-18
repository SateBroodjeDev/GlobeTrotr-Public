import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "./prijzen";
export const Route=createFileRoute("/pricing")({head:()=>({meta:[{title:"Prijzen voor Free, Pro en Agency — GlobeTrotr"},{name:"description",content:"Vergelijk GlobeTrotr Free, Pro en Agency. Kies de reisplanner die past bij jouw vakantie, groepsreis of reisorganisatie."}],links:[{rel:"canonical",href:"https://globetrotr.nl/pricing"}]}),component:PricingPage});
