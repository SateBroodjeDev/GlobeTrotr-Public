import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTripManagementAccess } from "@/lib/trip-management-access.server";

import { ownedTripCoverPath } from "./security-object-path";

const UUID = /^[0-9a-f-]{36}$/i;
async function db(){const{supabaseAdmin}=await import("@/integrations/supabase/client.server");return supabaseAdmin as any}
async function canView(client: any, userId: string, tripId: string) {
  const { data: trip, error: tripError } = await client.from("trips")
    .select("workspace_user_id,workspace_uuid").eq("trip_uuid", tripId).maybeSingle();
  if (tripError || !trip) throw new Error("TRIP_NOT_FOUND");
  if (trip.workspace_user_id === userId) return;
  const { data: workspace, error: workspaceError } = await client.from("workspaces")
    .select("plan").eq("workspace_uuid", trip.workspace_uuid).maybeSingle();
  if (workspaceError || !workspace) throw new Error("TRIP_NOT_FOUND");
  if (workspace.plan === "agency") {
    const { data: member, error: memberError } = await client.from("workspace_members")
      .select("role").eq("workspace_uuid", trip.workspace_uuid).eq("user_id", userId)
      .eq("status", "active").maybeSingle();
    if (memberError) throw new Error("AGENCY_PERMISSION_REQUIRED");
    if (member && ["advisor", "finance"].includes(member.role)) {
      await requireTripManagementAccess(client, userId, tripId, "trips_view");
      return;
    }
  }
  const { data: member, error: memberError } = await client.from("trip_members")
    .select("id").eq("trip_uuid", tripId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (memberError || !member) throw new Error("AGENCY_PERMISSION_REQUIRED");
}

export const getTripCover=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).validator((x:{tripId:string})=>x).handler(async({data,context})=>{if(!UUID.test(data.tripId))throw new Error("INVALID_TRIP");const client=await db();await canView(client,context.userId,data.tripId);const{data:t,error}=await client.from("trips").select("cover_path").eq("trip_uuid",data.tripId).single();if(error||!ownedTripCoverPath(t?.cover_path,data.tripId))return{path:null,url:null};const{data:signed}=await client.storage.from("trip-covers").createSignedUrl(t.cover_path,3600);return{path:t.cover_path as string,url:signed?.signedUrl??null}});

export const saveTripCover=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator((x:{tripId:string;path:string|null})=>x).handler(async({data,context})=>{if(!UUID.test(data.tripId)||(data.path!==null&&!ownedTripCoverPath(data.path,data.tripId)))throw new Error("INVALID_COVER");const client=await db();await requireTripManagementAccess(client,context.userId,data.tripId,"trips_plan");const{data:old,error:readError}=await client.from("trips").select("cover_path").eq("trip_uuid",data.tripId).single();if(readError)throw new Error("COVER_SAVE_FAILED");const{error}=await client.from("trips").update({cover_path:data.path}).eq("trip_uuid",data.tripId);if(error)throw new Error("COVER_SAVE_FAILED");if(ownedTripCoverPath(old?.cover_path,data.tripId)&&old.cover_path!==data.path)await client.storage.from("trip-covers").remove([old.cover_path]);return{ok:true}});
