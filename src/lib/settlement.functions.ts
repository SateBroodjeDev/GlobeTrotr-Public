import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SettlementTransfer={from:string;fromId:string;to:string;toId:string;amount:number};

export const publishTripSettlement=createServerFn({method:"POST"})
 .middleware([requireSupabaseAuth])
 .validator((input:{tripId:string;action:"request"|"complete";currency:string;transfers:SettlementTransfer[]})=>input)
 .handler(async({data,context})=>{
  if(!UUID.test(data.tripId)||!/^[A-Z]{3}$/.test(data.currency)||data.transfers.length>50)throw new Error("INVALID_SETTLEMENT");
  const transfers=data.transfers.map(item=>({from:item.from.trim().slice(0,120),fromId:item.fromId,to:item.to.trim().slice(0,120),toId:item.toId,amount:Math.round(Number(item.amount)*100)/100}));
  if(transfers.some(item=>!item.from||!item.to||!Number.isFinite(item.amount)||item.amount<=0||item.amount>100_000_000))throw new Error("INVALID_SETTLEMENT");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:result,error}=await supabaseAdmin.rpc("publish_trip_settlement",{p_actor:context.userId,p_trip:data.tripId,p_action:data.action,p_currency:data.currency,p_transfers:transfers});
  if(error)throw new Error(error.message.includes("SETTLEMENT_ACCESS_REQUIRED")?"SETTLEMENT_ACCESS_REQUIRED":"SETTLEMENT_SAVE_FAILED");
  return result as {status:string;count:number};
 });
