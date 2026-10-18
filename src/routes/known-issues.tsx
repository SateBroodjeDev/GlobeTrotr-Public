import { createFileRoute } from "@tanstack/react-router";
import { KnownIssuesPage } from "./bekende-problemen";
export const Route=createFileRoute("/known-issues")({head:()=>({meta:[{title:"Known issues — GlobeTrotr"},{name:"description",content:"Current GlobeTrotr limitations, status and workarounds."}]}),component:KnownIssuesPage});
