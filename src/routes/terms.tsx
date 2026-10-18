import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "./algemene-voorwaarden";
export const Route=createFileRoute("/terms")({head:()=>({meta:[{title:"Terms and conditions — GlobeTrotr"},{name:"description",content:"Terms and conditions for GlobeTrotr services and subscriptions."}]}),component:TermsPage});
