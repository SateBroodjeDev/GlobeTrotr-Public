import { updateFriendship, type FriendshipChange } from "./friendship.server";
import { withApplicationDiagnostics } from "./application-diagnostics.server";
import { isBetaTesterAccount } from "./beta-tester";
import { mailLocale } from "./mail-locale.ts";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicDatabaseClient } from "@/lib/public.functions";

import { ownedAvatarPath } from "./security-object-path";

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
    if(ownedAvatarPath(result.avatarPath,setting?.id)){const{data:signed}=await admin.storage.from("avatars").createSignedUrl(result.avatarPath,900);if(signed?.signedUrl)result.avatarUrl=signed.signedUrl;}}
  delete result.avatarPath;return result;
});

async function socialDb(userId:string){const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;const{data:user}=await db.auth.admin.getUserById(userId);if(!user.user)throw new Error("UNAUTHORIZED");return db;}
async function travelerAvatar(db:any,profile:any):Promise<string|undefined>{
  if(!ownedAvatarPath(profile?.avatar_path,profile?.id))return undefined;
  const {data,error}=await db.storage.from("avatars").createSignedUrl(profile.avatar_path,900);
  return error?undefined:data?.signedUrl;
}
async function notifyFriend(db:any,userId:string,eventKey:string,titleNl:string,titleEn:string,bodyNl:string,bodyEn:string,link:string){const{data:target}=await db.from("profiles").select("locale").eq("id",userId).maybeSingle();const english=mailLocale(target?.locale ?? "nl")==="en",title=english?titleEn:titleNl,body=english?bodyEn:bodyNl;const{data:notification,error}=await db.from("notifications").insert({user_id:userId,kind:"account",title,body,event_key:eventKey,link}).select("id").single();if(error)throw new Error("FRIEND_NOTIFICATION_FAILED");await db.from("email_outbox").update({payload:{title,body,actionUrl:`https://portal.globetrotr.nl${link}`},updated_at:new Date().toISOString()}).eq("notification_id",notification.id);}
export const getFriendshipState=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).validator((input:{slug:string})=>input).handler(async({data,context})=>{
  const db=await socialDb(context.userId);const{data:profile}=await db.from("profiles").select("id").eq("public_slug",data.slug.toLowerCase()).eq("public_profile_enabled",true).maybeSingle();if(!profile)return{status:"not_found" as const};if(profile.id===context.userId)return{status:"self" as const};
  const{data:row}=await db.from("traveler_friendships").select("id,requester_id,addressee_id,status").or(`and(requester_id.eq.${context.userId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${context.userId})`).maybeSingle();
  if(!row)return{status:"none" as const};return{id:row.id,status:row.status==="accepted"?"accepted" as const:row.addressee_id===context.userId?"incoming" as const:"outgoing" as const};
});
export const searchTravelerProfiles=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).validator((input:{query:string})=>input).handler(async({data,context})=>{
  const query=data.query.trim().toLowerCase();if(query.length<2)return[];const db=await socialDb(context.userId);const safe=query.replace(/[%_]/g,"").trim().slice(0,60);if(safe.length<2)return[];const base=()=>db.from("profiles").select("id,display_name,public_slug,avatar_path").eq("public_profile_enabled",true).neq("id",context.userId);const[byName,bySlug]=await Promise.all([base().ilike("display_name",`%${safe}%`).limit(12),base().ilike("public_slug",`%${safe}%`).limit(12)]);if(byName.error||bySlug.error)throw new Error("PROFILE_SEARCH_FAILED");const unique=new Map([...(byName.data??[]),...(bySlug.data??[])].map((profile:any)=>[profile.id,profile]));return Promise.all([...unique.values()].slice(0,12).filter((profile:any)=>validSlug(profile.public_slug)).map(async(profile:any)=>({name:profile.display_name||"GlobeTrotr-reiziger",slug:profile.public_slug,avatarUrl:await travelerAvatar(db,profile)})));
});

export const listMyFriendships=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=await socialDb(context.userId);const{data:rows,error}=await db.from("traveler_friendships").select("id,requester_id,addressee_id,status,created_at").or(`requester_id.eq.${context.userId},addressee_id.eq.${context.userId}`).order("created_at",{ascending:false});if(error)throw new Error("FRIENDS_UNAVAILABLE");
  const ids=[...new Set((rows??[]).map((row:any)=>row.requester_id===context.userId?row.addressee_id:row.requester_id))];const{data:profiles,error:profileError}=ids.length?await db.from("profiles").select("id,display_name,public_slug,public_profile_enabled,avatar_path").in("id",ids):{data:[],error:null};if(profileError)throw new Error("FRIENDS_UNAVAILABLE");const byId=new Map((profiles??[]).map((profile:any)=>[profile.id,profile]));return Promise.all((rows??[]).map(async(row:any)=>{const otherId=row.requester_id===context.userId?row.addressee_id:row.requester_id,profile:any=byId.get(otherId);return{id:row.id,name:profile?.display_name||"GlobeTrotr-reiziger",slug:profile?.public_profile_enabled?profile.public_slug:null,status:row.status,incoming:row.addressee_id===context.userId,avatarUrl:profile?.public_profile_enabled?await travelerAvatar(db,profile):undefined};}));
});

export const changeFriendship = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: FriendshipChange) => input).handler(async ({ data, context }) => withApplicationDiagnostics("friendship.change", async () => {
    const db = await socialDb(context.userId);
    return updateFriendship(db, context.userId, data, async (targetId, eventKey, accepted) => {
      const { data: actor } = await db.from("profiles").select("display_name,public_slug,public_profile_enabled").eq("id", context.userId).maybeSingle();
      const name = actor?.display_name || "GlobeTrotr-reiziger";
      const link = accepted && actor?.public_profile_enabled && actor?.public_slug ? `/users/${actor.public_slug}` : "/vrienden";
      await notifyFriend(db, targetId, eventKey,
        accepted ? "Vriendschapsverzoek geaccepteerd" : "Nieuw vriendschapsverzoek",
        accepted ? "Friend request accepted" : "New friend request",
        accepted ? `${name} heeft je verzoek geaccepteerd.` : `${name} wil vrienden worden.`,
        accepted ? `${name} accepted your request.` : `${name} wants to be friends.`, link);
    });
  }));
