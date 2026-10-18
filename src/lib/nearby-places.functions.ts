import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTripManagementAccess } from "@/lib/trip-management-access.server";
import { isNearbyPlaceCategory, nearbyPlacesQuery, overpassElements, overpassEndpoints, type NearbyPlaceCategory } from "@/lib/nearby-places";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type { NearbyPlaceCategory } from "@/lib/nearby-places";
export type NearbyPlace = { id:string; name:string; category:NearbyPlaceCategory; kind:string; lat:number; lon:number; distanceKm:number; openingHours?:string; website?:string; osmUrl:string };
const calls = new Map<string, number[]>();
const cache = new Map<string, { expires:number; results:NearbyPlace[] }>();

function distanceKm(a:number,b:number,c:number,d:number){const r=6371,toRad=(x:number)=>x*Math.PI/180,p1=toRad(a),p2=toRad(c),dp=toRad(c-a),dl=toRad(d-b),q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*r*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
function safeUrl(value:unknown){if(typeof value!=="string"||value.length>2048)return undefined;try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.toString():undefined}catch{return undefined}}

async function requestOverpass(endpoint:string,query:string,sharedSignal:AbortSignal){
  try{
    const response=await fetch(endpoint,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","User-Agent":"GlobeTrotr/1.1 (https://globetrotr.nl/contact)"},body:new URLSearchParams({data:query}),signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(6_500)])});
    if(!response.ok)return undefined;
    const elements=overpassElements(await response.json());
    return elements ? {elements} : undefined;
  }catch{return undefined}
}

function firstAvailable(requests:Promise<{elements?:unknown[]}|undefined>[]){
  return new Promise<{elements?:unknown[]}|undefined>(resolve=>{
    let remaining=requests.length,settled=false;
    if(!remaining){resolve(undefined);return}
    for(const request of requests)void request.then(payload=>{
      if(settled)return;
      if(payload){settled=true;resolve(payload);return}
      remaining-=1;if(!remaining){settled=true;resolve(undefined)}
    }).catch(()=>{remaining-=1;if(!settled&&!remaining){settled=true;resolve(undefined)}});
  });
}

async function requestFirstOverpass(endpoints:string[],query:string){
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const requests=endpoints.slice(0,3).map(async(endpoint,index)=>{
    if(index)await new Promise(resolve=>setTimeout(resolve,index*1_200));
    if(controller.signal.aborted)return undefined;
    return requestOverpass(endpoint,query,controller.signal);
  });
  const deadline=new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),9_000)});
  try{return await Promise.race([firstAvailable(requests),deadline])}
  finally{if(timer)clearTimeout(timer);controller.abort()}
}

export const searchNearbyPlaces=createServerFn({method:"POST"})
 .middleware([requireSupabaseAuth])
 .validator((input:{tripId:string;lat:number;lon:number;category:NearbyPlaceCategory;radiusKm?:number})=>input)
 .handler(async({data,context})=>{
  const radiusKm=[5,10,15,20].includes(data.radiusKm??15)?data.radiusKm??15:15;
  if(!UUID.test(data.tripId)||!isNearbyPlaceCategory(data.category)||!Number.isFinite(data.lat)||!Number.isFinite(data.lon)||Math.abs(data.lat)>90||Math.abs(data.lon)>180)throw new Error("INVALID_NEARBY_SEARCH");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;
  const {data:trip,error:tripError}=await db.from("trips").select("workspace_user_id").eq("trip_uuid",data.tripId).maybeSingle();
  if(tripError||!trip)throw new Error("TRIP_NOT_FOUND");
  if(trip.workspace_user_id!==context.userId){const {data:member,error:memberError}=await db.from("trip_members").select("id").eq("trip_uuid",data.tripId).eq("user_id",context.userId).eq("status","active").maybeSingle();if(memberError)throw new Error("TRIP_ACCESS_UNAVAILABLE");if(!member)await requireTripManagementAccess(db,context.userId,data.tripId,"trips_view");}
  const now=Date.now(),recent=(calls.get(context.userId)??[]).filter(time=>now-time<60_000);if(recent.length>=10)throw new Error("NEARBY_SEARCH_RATE_LIMIT");recent.push(now);calls.set(context.userId,recent);
  const key=`${data.category}:${radiusKm}:${data.lat.toFixed(3)}:${data.lon.toFixed(3)}`,cached=cache.get(key);if(cached&&cached.expires>now)return{results:cached.results,cached:true,radiusKm};
  const query=nearbyPlacesQuery(data.category,data.lat,data.lon,radiusKm*1_000);
  const endpoints=overpassEndpoints(process.env.OVERPASS_API_URLS??process.env.OVERPASS_API_URL),payload=await requestFirstOverpass(endpoints,query);
  if(!payload){console.error(`[Nearby places] Alle ${endpoints.length} Overpass-providers zijn onbereikbaar.`);throw new Error("NEARBY_SEARCH_UNAVAILABLE")}
  const results=(payload.elements??[]).map(raw=>{const element=raw as Record<string,any>,lat=Number(element.lat??element.center?.lat),lon=Number(element.lon??element.center?.lon),tags=element.tags??{},kind=String(tags.amenity??tags.tourism??tags.leisure??tags.shop??data.category).slice(0,60);return{id:`${element.type}/${element.id}`,name:String(tags.name??"").trim().slice(0,160),category:data.category,kind,lat,lon,distanceKm:Number(distanceKm(data.lat,data.lon,lat,lon).toFixed(1)),openingHours:tags.opening_hours?String(tags.opening_hours).slice(0,240):undefined,website:safeUrl(tags["contact:website"]??tags.website),osmUrl:`https://www.openstreetmap.org/${element.type}/${element.id}`} satisfies NearbyPlace}).filter(item=>item.name&&Number.isFinite(item.lat)&&Number.isFinite(item.lon)).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,20);
  cache.set(key,{expires:now+15*60_000,results});return{results,cached:false,radiusKm};
 });
