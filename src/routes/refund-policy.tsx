import { createFileRoute } from "@tanstack/react-router";
import { RefundPage } from "./terugbetalingsbeleid";
export const Route=createFileRoute("/refund-policy")({head:()=>({meta:[{title:"Refund policy — GlobeTrotr"},{name:"description",content:"Cancellation, withdrawal and refund arrangements for GlobeTrotr."}]}),component:RefundPage});
