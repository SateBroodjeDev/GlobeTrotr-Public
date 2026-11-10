import { createServerFn } from "@tanstack/react-start";

export type PublicQuote = {
  status: "available" | "accepted" | "rejected" | "invalid" | "expired" | "unavailable";
  quote?: {
    title: string; introduction: string; currency: string; validUntil: string;
    clientName: string; tripName: string; expiresAt: string;
    variants: { id: string; name: string; description: string; amount: number }[];
    branding: { brandName: string; tagline: string; accent: number; logoUrl?: string };
  };
};

async function hash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")}

export const getPublicAgencyQuote=createServerFn({method:"GET"}).validator((input:{token:string})=>input).handler(async({data})=>{
  if(!/^[0-9a-f]{64}$/i.test(data.token))return{status:"invalid"} as PublicQuote;
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const db:any=supabaseAdmin;
  const {data:quote,error}=await db.from("agency_quotes").select("id,workspace_uuid,client_id,trip_uuid,title,introduction,currency,status,valid_until,share_expires_at").eq("share_token_hash",await hash(data.token)).maybeSingle();
  if(error||!quote)return{status:"invalid"} as PublicQuote;
  if(quote.status==="accepted"||quote.status==="rejected")return{status:quote.status} as PublicQuote;
  if(quote.status!=="ready")return{status:"unavailable"} as PublicQuote;
  if(!quote.share_expires_at||new Date(quote.share_expires_at).getTime()<=Date.now())return{status:"expired"} as PublicQuote;
  const [{data:variants},{data:client},{data:trip},{data:workspace},{data:settings}]=await Promise.all([
    db.from("agency_quote_variants").select("id,name,description,amount,position").eq("quote_id",quote.id).order("position"),
    db.from("agency_clients").select("full_name").eq("id",quote.client_id).eq("workspace_uuid",quote.workspace_uuid).maybeSingle(),
    quote.trip_uuid?db.from("trips").select("name").eq("trip_uuid",quote.trip_uuid).eq("workspace_uuid",quote.workspace_uuid).maybeSingle():Promise.resolve({data:null}),
    db.from("workspaces").select("plan,branding").eq("workspace_uuid",quote.workspace_uuid).maybeSingle(),
    db.from("agency_settings").select("system_name,tagline,accent,logo_path").eq("workspace_uuid",quote.workspace_uuid).maybeSingle(),
  ]);
  if(workspace?.plan!=="agency"||!client)return{status:"unavailable"} as PublicQuote;
  const legacy=workspace.branding??{},logoPath=settings?.logo_path??legacy.logoPath??null;
  let logoUrl:string|undefined;if(logoPath){const {data:signed}=await db.storage.from("agency-logos").createSignedUrl(logoPath,900);logoUrl=signed?.signedUrl}
  return{status:"available",quote:{title:quote.title,introduction:quote.introduction??"",currency:quote.currency,validUntil:quote.valid_until??"",clientName:client.full_name,tripName:trip?.name??"",expiresAt:quote.share_expires_at,variants:(variants??[]).map((v:any)=>({id:v.id,name:v.name,description:v.description??"",amount:Number(v.amount)})),branding:{brandName:settings?.system_name??legacy.brandName??"GlobeTrotr Agency",tagline:settings?.tagline??legacy.tagline??"",accent:Number(settings?.accent??legacy.accent??172),...(logoUrl?{logoUrl}:{})}}} as PublicQuote;
});

export const respondToAgencyQuote=createServerFn({method:"POST"}).validator((input:{token:string;response:"accept"|"reject";variantId?:string;note?:string})=>input).handler(async({data})=>{
 if(!/^[0-9a-f]{64}$/i.test(data.token)||data.note&&data.note.length>500||data.variantId&&!/^[0-9a-f-]{36}$/i.test(data.variantId))throw new Error("INVALID_QUOTE_RESPONSE");const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data:result,error}=await (supabaseAdmin as any).rpc("respond_agency_quote",{p_token_hash:await hash(data.token),p_response:data.response,p_variant_id:data.variantId??null,p_note:data.note?.trim()||null});if(error||!result)throw new Error(error?.code==="PGRST202"?"QUOTE_RESPONSE_UNAVAILABLE":"QUOTE_RESPONSE_FAILED");return result as{status:"accepted"|"rejected"|"expired"|"invalid"|"invalid_variant"|"variant_required"};
});
