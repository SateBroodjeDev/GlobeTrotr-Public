import { isBetaTesterAccount } from "./beta-tester";
import { mailLocale } from "./mail-locale.ts";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicDatabaseClient } from "@/lib/public.functions";

const SLUG=/^[a-z0-9][a-z0-9-]{2,39}$/;
const RESERVED=new Set(["admin","administrator","api","auth","billing","contact","corp","corporate-admin","dashboard","globetrotr","help","journal","login","privacy","register","root","security","status","support","trips","users","vrienden"]);
function validSlug(value:string){return SLUG.test(value)&&!RESERVED.has(value)}
export type PublicTravelerProfile={slug:string;displayName:string;biography:string;avatarUrl?:string;friendRequestsEnabled:boolean;isPro:boolean;isBetaTester:boolean;countries:string[];places:number;friends:number;trips:{tripId:string;token:string;name:string;description?:string;start?:string;end?:string;countries:string[]}[]};

export const getPublicTravelerProfile=createServerFn({method:"GET"}).validator((input:{slug:string})=>input).handler(async({data})=>{
  const slug=data.slug.trim().toLowerCase();if(!validSlug(slug))return null;
  const db=await createPublicDatabaseClient();const{data:profile,error}=await db.rpc("get_public_traveler_profile" as never,{p_slug:slug} as never);
  if(error||!profile||typeof profile!=="object")return null;
  const result=profile as unknown as PublicTravelerProfile&{avatarPath?:string};
  result.friendRequestsEnabled=true;result.isPro=Boolean(result.isPro);result.isBetaTester=false;if(process.env["SUPABASE_SERVICE_ROLE_KEY"]){const{supabaseAdmin}=await import("@/integrations/supabase/client.server"),admin=supabaseAdmin as any;const{data:setting}=await admin.from("profiles").select("id,friend_requests_enabled").eq("public_slug",slug).eq("public_profile_enabled",true).maybeSingle();result.friendRequestsEnabled=setting?.friend_requests_enabled!==false;
    if(setting?.id){const{data:account,error:accountError}=await admin.auth.admin.getUserById(setting.id);if(!accountError)result.isBetaTester=isBetaTesterAccount(account?.user?.created_at);}
    if(result.avatarPath){const{data:signed}=await admin.storage.from("avatars").createSignedUrl(result.avatarPath,900);if(signed?.signedUrl)result.avatarUrl=signed.signedUrl;}}
  delete result.avatarPath;return result;
});

async function socialDb(userId:string){const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;const{data:user}=await db.auth.admin.getUserById(userId);if(!user.user)throw new Error("UNAUTHORIZED");return db;}
async function notifyFriend(db:any,userId:string,eventKey:string,titleNl:string,titleEn:string,bodyNl:string,bodyEn:string,link:string){const{data:target}=await db.from("profiles").select("locale").eq("id",userId).maybeSingle();const english=mailLocale(target?.locale ?? "nl")==="en",title=english?titleEn:titleNl,body=english?bodyEn:bodyNl;const{data:notification,error}=await db.from("notifications").insert({user_id:userId,kind:"account",title,body,event_key:eventKey,link}).select("id").single();if(error)throw new Error("FRIEND_NOTIFICATION_FAILED");await db.from("email_outbox").update({payload:{title,body,actionUrl:`https://portal.globetrotr.nl${link}`},updated_at:new Date().toISOString()}).eq("notification_id",notification.id);}
export const getFriendshipState=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).validator((input:{slug:string})=>input).handler(async({data,context})=>{
  const db=await socialDb(context.userId);const{data:profile}=await db.from("profiles").select("id").eq("public_slug",data.slug.toLowerCase()).eq("public_profile_enabled",true).maybeSingle();if(!profile)return{status:"not_found" as const};if(profile.id===context.userId)return{status:"self" as const};
  const{data:row}=await db.from("traveler_friendships").select("id,requester_id,addressee_id,status").or(`and(requester_id.eq.${context.userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${context.userId})`).maybeSingle();
  if(!row)return{status:"none" as const};return{id:row.id,status:row.status==="accepted"?"accepted" as const:row.addressee_id===context.userId?"incoming" as const:"outgoing" as const};
});
export const searchTravelerProfiles=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).validator((input:{query:string})=>input).handler(async({data,context})=>{
  const query=data.query.trim().toLowerCase();if(query.length<2)return[];const db=await socialDb(context.userId);const safe=query.replace(/[%_]/g,"").slice(0,60);const base=()=>db.from("profiles").select("id,display_name,public_slug").eq("public_profile_enabled",true).neq("id",context.userId);const[byName,bySlug]=await Promise.all([base().ilike("display_name",`%${safe}%`).limit(12),base().ilike("public_slug",`%${safe}%`).limit(12)]);if(byName.error||bySlug.error)throw new Error("PROFILE_SEARCH_FAILED");const unique=new Map([...(byName.data??[]),...(bySlug.data??[])].map((profile:any)=>[profile.id,profile]));return[...unique.values()].slice(0,12).filter((profile:any)=>profile.public_slug).map((profile:any)=>({name:profile.display_name||"GlobeTrotr-reiziger",slug:profile.public_slug}));
});

export const listMyFriendships=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=await socialDb(context.userId);const{data:rows,error}=await db.from("traveler_friendships").select("id,requester_id,addressee_id,status,created_at").or(`requester_id.eq.${context.userId},addressee_id.eq.${context.userId}`).order("created_at",{ascending:false});if(error)throw new Error("FRIENDS_UNAVAILABLE");
  const ids=[...new Set((rows??[]).map((row:any)=>row.requester_id===context.userId?row.addressee_id:row.requester_id))];const{data:profiles}=ids.length?await db.from("profiles").select("id,display_name,public_slug,public_profile_enabled").in("id",ids):{data:[]};const byId=new Map((profiles??[]).map((profile:any)=>[profile.id,profile]));return(rows??[]).map((row:any)=>{const otherId=row.requester_id===context.userId?row.addressee_id:row.requester_id,profile:any=byId.get(otherId);return{id:row.id,name:profile?.display_name||"GlobeTrotr-reiziger",slug:profile?.public_profile_enabled?profile.public_slug:null,status:row.status,incoming:row.addressee_id===context.userId};});
});

export const changeFriendship=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator((input:{slug:string;action:"request"|"accept"|"remove"})=>input).handler(async({data,context})=>{
  if(!validSlug(data.slug))throw new Error("INVALID_PROFILE");const db=await socialDb(context.userId);const{data:profile}=await db.from("profiles").select("id,display_name,friend_requests_enabled").eq("public_slug",data.slug).eq("public_profile_enabled",true).maybeSingle();if(!profile||profile.id===context.userId)throw new Error("INVALID_PROFILE");
  const{data:existing}=await db.from("traveler_friendships").select("id,requester_id,addressee_id,status").or(`and(requester_id.eq.${context.userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${context.userId})`).maybeSingle();
  if(data.action==="request"){if(!profile.friend_requests_enabled)throw new Error("FRIEND_REQUESTS_DISABLED");if(existing)return{ok:true};const{data:created,error}=await db.from("traveler_friendships").insert({requester_id:context.userId,addressee_id:profile.id}).select("id").single();if(error)throw new Error("FRIEND_REQUEST_FAILED");const{data:requester}=await db.from("profiles").select("display_name").eq("id",context.userId).maybeSingle();const name=requester?.display_name||"GlobeTrotr-reiziger";await notifyFriend(db,profile.id,`friend-request:${created.id}`,"Nieuw vriendschapsverzoek","New friend request",`${name} wil vrienden worden.`,`${name} wants to be friends.`,"/vrienden");}
  if(data.action==="accept"){if(!existing||existing.addressee_id!==context.userId||existing.status!=="pending")throw new Error("INVALID_FRIEND_REQUEST");const{error}=await db.from("traveler_friendships").update({status:"accepted",responded_at:new Date().toISOString()}).eq("id",existing.id);if(error)throw new Error("FRIEND_ACCEPT_FAILED");const{data:acceptor}=await db.from("profiles").select("display_name,public_slug").eq("id",context.userId).maybeSingle();const name=acceptor?.display_name||"GlobeTrotr-reiziger",link=acceptor?.public_slug?`/users/${acceptor.public_slug}`:"/vrienden";await notifyFriend(db,existing.requester_id,`friend-accepted:${existing.id}`,"Vriendschapsverzoek geaccepteerd","Friend request accepted",`${name} heeft je verzoek geaccepteerd.`,`${name} accepted your request.`,link);}
  if(data.action==="remove"&&existing){const{error}=await db.from("traveler_friendships").delete().eq("id",existing.id);if(error)throw new Error("FRIEND_REMOVE_FAILED");}
  return{ok:true};
});
