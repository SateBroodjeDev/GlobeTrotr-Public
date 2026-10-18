import {createServerFn} from "@tanstack/react-start";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
export const getPublicFeatureFlags=createServerFn({method:"GET"}).handler(async()=>{const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const{data,error}=await(supabaseAdmin as any).from("platform_feature_flags").select("flag_key,enabled").eq("audience","all");if(error)throw new Error("PUBLIC_FLAGS_UNAVAILABLE");return Object.fromEntries((data??[]).map((x:any)=>[x.flag_key,Boolean(x.enabled)])) as Record<string,boolean>;});
async function access(userId:string){const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;const[{data:user},{data:admin}]=await Promise.all([db.auth.admin.getUserById(userId),db.from("platform_admins").select("role,permissions").eq("user_id",userId).eq("active",true).maybeSingle()]);if(user.user?.app_metadata?.corporate_admin!==true||!admin||(admin.role!=="owner"&&admin.permissions?.operations!==true))throw new Error("FORBIDDEN");return db;}
async function audit(db:any,actor:string,action:string,target:string,id:string|null,details:Record<string,unknown>){await db.from("platform_admin_audit_log").insert({actor_user_id:actor,action,target_type:target,target_id:id,result:"success",details});}
export const getCorporateGovernance=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const db=await access(context.userId);const now=new Date().toISOString();const cleanup=await db.from("platform_maintenance").update({active:false,starts_at:null,ends_at:null,progress_percent:0,updated_at:now}).eq("singleton",true).eq("active",true).lte("ends_at",now);if(cleanup.error)throw new Error("GOVERNANCE_UNAVAILABLE");const[flags,requests,incidents,maintenance]=await Promise.all([db.from("platform_feature_flags").select("*").order("flag_key"),db.from("privacy_requests").select("*").order("due_at"),db.from("platform_incidents").select("*").order("started_at",{ascending:false}).limit(100),db.from("platform_maintenance").select("*").eq("singleton",true).maybeSingle()]);if(flags.error||requests.error||incidents.error||maintenance.error)throw new Error("GOVERNANCE_UNAVAILABLE");return{flags:flags.data??[],requests:requests.data??[],incidents:incidents.data??[],maintenance:maintenance.data};});
export const saveFeatureFlag=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator((x:{key:string;enabled:boolean;audience:"internal"|"beta"|"all";reason:string})=>x).handler(async({data,context})=>{if(!/^[a-z][a-z0-9_.-]{2,79}$/.test(data.key)||data.reason.trim().length<10)throw new Error("INVALID_FLAG_CHANGE");const db=await access(context.userId);const{data:row,error}=await db.from("platform_feature_flags").update({enabled:data.enabled,audience:data.audience,updated_by:context.userId,updated_at:new Date().toISOString()}).eq("flag_key",data.key).select("flag_key").maybeSingle();if(error||!row)throw new Error("FLAG_SAVE_FAILED");await audit(db,context.userId,"platform.feature_flag.update","feature_flag",data.key,{enabled:data.enabled,audience:data.audience,reason:data.reason.trim()});return{ok:true};});
export const savePrivacyRequest=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator((x:{id?:string;email:string;type:string;status:string;notes:string;response?:string})=>x).handler(async({data,context})=>{const db=await access(context.userId);const response=data.response?.trim()||null;if(response&&response.length>5000)throw new Error("INVALID_PRIVACY_RESPONSE");const payload={requester_email:data.email.trim().toLowerCase(),request_type:data.type,status:data.status,notes:data.notes.trim()||null,response_text:response,responded_at:response?new Date().toISOString():null,closed_at:["completed","rejected"].includes(data.status)?new Date().toISOString():null,updated_by:context.userId,updated_at:new Date().toISOString()};const q=data.id?db.from("privacy_requests").update(payload).eq("id",data.id):db.from("privacy_requests").insert(payload);const{data:row,error}=await q.select("id,user_id").single();if(error)throw new Error("PRIVACY_REQUEST_SAVE_FAILED");if(response&&row.user_id)await db.from("notifications").insert({user_id:row.user_id,kind:"account",title:"Antwoord op je privacyverzoek / Response to your privacy request",body:response,event_key:`privacy-response:${row.id}`,link:"/account"});await audit(db,context.userId,data.id?"privacy.request.update":"privacy.request.create","privacy_request",row.id,{status:data.status,type:data.type,responded:Boolean(response)});return{ok:true};});
export const setPrivacyRequestArchived=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .validator((input:{id:string;archived:boolean})=>input)
  .handler(async({data,context})=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id))
      throw new Error("INVALID_PRIVACY_REQUEST");
    const db=await access(context.userId);
    const{data:request,error:readError}=await db.from("privacy_requests")
      .select("id,status,archived_at").eq("id",data.id).maybeSingle();
    if(readError||!request)throw new Error("PRIVACY_REQUEST_NOT_FOUND");
    if(data.archived&&!['completed','rejected'].includes(request.status))
      throw new Error("PRIVACY_REQUEST_STILL_OPEN");
    if(Boolean(request.archived_at)===data.archived)return{ok:true};
    let update=db.from("privacy_requests").update({
      archived_at:data.archived?new Date().toISOString():null,
      updated_by:context.userId,
      updated_at:new Date().toISOString(),
    }).eq("id",data.id);
    if(data.archived)update=update.in("status",["completed","rejected"]);
    const{data:updated,error}=await update.select("id").maybeSingle();
    if(error||!updated)throw new Error("PRIVACY_ARCHIVE_FAILED");
    await audit(db,context.userId,data.archived?"privacy.request.archive":"privacy.request.restore",
      "privacy_request",data.id,{status:request.status});
    return{ok:true};
  });
export const saveIncident=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator((x:{id?:string;title:string;severity:string;status:string;summary:string})=>x).handler(async({data,context})=>{const db=await access(context.userId);const payload={title:data.title.trim(),severity:data.severity,status:data.status,summary:data.summary.trim(),resolved_at:data.status==="resolved"?new Date().toISOString():null,updated_by:context.userId,updated_at:new Date().toISOString()};const q=data.id?db.from("platform_incidents").update(payload).eq("id",data.id):db.from("platform_incidents").insert(payload);const{data:row,error}=await q.select("id").single();if(error)throw new Error("INCIDENT_SAVE_FAILED");await audit(db,context.userId,data.id?"platform.incident.update":"platform.incident.create","incident",row.id,{status:data.status,severity:data.severity});return{ok:true};});

export const saveMaintenance=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .validator((x:{active:boolean;reasonNl:string;reasonEn:string;startsAt:string|null;endsAt:string|null;progressPercent:number;statusNl:string;statusEn:string;reason:string})=>x)
  .handler(async({data,context})=>{
    if(data.reason.trim().length<10||data.reasonNl.trim().length<10||data.reasonEn.trim().length<10||data.statusNl.trim().length<3||data.statusEn.trim().length<3||!Number.isInteger(data.progressPercent)||data.progressPercent<0||data.progressPercent>100)throw new Error("INVALID_MAINTENANCE");
    const starts=data.startsAt?Date.parse(data.startsAt):null,ends=data.endsAt?Date.parse(data.endsAt):null;
    if((starts!==null&&!Number.isFinite(starts))||(ends!==null&&!Number.isFinite(ends))||(starts!==null&&ends!==null&&ends<=starts))throw new Error("INVALID_MAINTENANCE_WINDOW");
    const db=await access(context.userId);
    const{data:previous}=await db.from("platform_maintenance").select("active,starts_at,ends_at,reason_nl,reason_en").eq("singleton",true).maybeSingle();
    const payload={singleton:true,active:data.active,reason_nl:data.reasonNl.trim(),reason_en:data.reasonEn.trim(),starts_at:data.active?(data.startsAt||null):null,ends_at:data.active?(data.endsAt||null):null,progress_percent:data.active?data.progressPercent:0,status_nl:data.statusNl.trim(),status_en:data.statusEn.trim(),updated_by:context.userId,updated_at:new Date().toISOString()};
    const{data:row,error}=await db.from("platform_maintenance").upsert(payload,{onConflict:"singleton"}).select("active,reason_nl,reason_en,starts_at,ends_at,progress_percent,status_nl,status_en,updated_at").single();
    if(error||!row)throw new Error("MAINTENANCE_SAVE_FAILED");
    const announce=Boolean(payload.active&&payload.starts_at)&&(
      !previous?.active||previous.starts_at!==payload.starts_at||previous.ends_at!==payload.ends_at||
      previous.reason_nl!==payload.reason_nl||previous.reason_en!==payload.reason_en
    );
    if(announce){
      const startLabel=new Intl.DateTimeFormat("nl-NL",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Amsterdam"}).format(new Date(payload.starts_at!));
      const startLabelEn=new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Amsterdam"}).format(new Date(payload.starts_at!));
      const{error:noticeError}=await db.rpc("publish_platform_announcement_v2",{
        p_actor_id:context.userId,p_announcement_type:"update",p_severity:"info",
        p_title_nl:"Onderhoud gepland",p_title_en:"Maintenance scheduled",
        p_body_nl:`${payload.reason_nl}\nStart: ${startLabel}`,
        p_body_en:`${payload.reason_en}\nStarts: ${startLabelEn}`,
        p_status_key:null,
      });
      if(noticeError)console.error("[Maintenance] Notification publish failed",{code:noticeError.code});
    }
    await audit(db,context.userId,"platform.maintenance.update","maintenance",null,{active:data.active,progressPercent:payload.progress_percent,reason:data.reason.trim(),startsAt:payload.starts_at,endsAt:payload.ends_at,announced:announce});
    return{ok:true,maintenance:row,announced:announce};
  });
