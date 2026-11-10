import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { getMyAgencyAccess, getTripBranding, saveTripBranding, type TripBrandingSettings as Values } from "@/lib/agency.functions";
import type { Branding } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function TripBrandingSettings({tripId,agencyBranding,onSaved}:{tripId:string;agencyBranding:Branding;onSaved?:(branding:Partial<Branding>|undefined)=>void}){
  const {text}=useLocale();
  const access=useQuery({queryKey:["my-agency-access"],queryFn:()=>getMyAgencyAccess(),retry:false});
  const query=useQuery({queryKey:["trip-branding",tripId],queryFn:()=>getTripBranding({data:{tripId}}),enabled:access.data?.permissions.branding_manage===true,retry:false});
  const [form,setForm]=useState<Values|null>(null); const [saving,setSaving]=useState(false);
  useEffect(()=>{if(query.data)setForm(query.data)},[query.data]);
  if(access.data&&!access.data.permissions.branding_manage)return null;
  if(access.isError||query.isError)return <Card className="surface"><CardContent className="p-5 text-sm text-muted-foreground">{text("Branding per reis wordt beschikbaar nadat de bijbehorende Agency-migratie is uitgevoerd.","Per-trip branding becomes available after its Agency migration has been applied.")}</CardContent></Card>;
  if(!form)return null;
  const set=<K extends keyof Values>(key:K,value:Values[K])=>setForm(current=>current?{...current,[key]:value}:current);
  const effective={brandName:form.brandName||agencyBranding.brandName,domain:form.domain||agencyBranding.domain,tagline:form.tagline||agencyBranding.tagline,accent:form.accent??agencyBranding.accent};
  async function save(){setSaving(true);try{await saveTripBranding({data:{tripId,branding:form!}});await query.refetch();onSaved?.(form!.enabled?{...(form!.brandName?{brandName:form!.brandName}:{}),...(form!.domain?{domain:form!.domain}:{}),...(form!.tagline?{tagline:form!.tagline}:{}),...(form!.accent==null?{}:{accent:form!.accent})}:undefined);toast.success(text("Reishuisstijl opgeslagen.","Trip branding saved."));}catch{toast.error(text("Reishuisstijl kon niet worden opgeslagen.","Trip branding could not be saved."));}finally{setSaving(false)}}
  function reset(){setForm({enabled:false,brandName:"",domain:"",tagline:"",accent:null});}
  return <Card className="surface"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Palette className="size-4"/>{text("Huisstijl van deze reis","Branding for this trip")}</CardTitle></CardHeader><CardContent className="space-y-5"><label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-medium">{text("Eigen reishuisstijl gebruiken","Use custom trip branding")}</span><span className="block text-xs text-muted-foreground">{text("Lege velden blijven de Agency-standaard gebruiken.","Empty fields continue to use the Agency default.")}</span></span><Switch checked={form.enabled} onCheckedChange={value=>set("enabled",value)}/></label>{form.enabled&&<div className="grid gap-4 sm:grid-cols-2"><Field label={text("Merknaam","Brand name")} value={form.brandName} max={50} placeholder={agencyBranding.brandName} onChange={value=>set("brandName",value)}/><Field label={text("Domein","Domain")} value={form.domain} max={120} placeholder={agencyBranding.domain} onChange={value=>set("domain",value)}/><div className="sm:col-span-2"><Field label="Tagline" value={form.tagline} max={120} placeholder={agencyBranding.tagline} onChange={value=>set("tagline",value)}/></div><label className="space-y-2 text-sm sm:col-span-2"><span className="flex justify-between"><span>{text("Accentkleur","Accent colour")}</span><span className="text-muted-foreground">{effective.accent}°</span></span><Slider min={0} max={360} value={[effective.accent]} onValueChange={value=>set("accent",value[0]??null)}/></label><div className="rounded-2xl border p-4 sm:col-span-2" style={{borderColor:`hsl(${effective.accent} 70% 45% / .5)`,background:`linear-gradient(135deg,hsl(${effective.accent} 70% 45% / .14),transparent)`}}><span className="text-xs text-muted-foreground">{effective.domain}</span><h3 className="break-words font-display text-xl font-semibold">{effective.brandName}</h3><p className="break-words text-sm text-muted-foreground">{effective.tagline}</p></div></div>}<div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={()=>void save()}><Save className="size-4"/>{text("Reishuisstijl opslaan","Save trip branding")}</Button><Button type="button" variant="outline" disabled={saving} onClick={reset}><RotateCcw className="size-4"/>{text("Agency-standaard herstellen","Restore Agency default")}</Button></div></CardContent></Card>;
}
function Field({label,value,max,placeholder,onChange}:{label:string;value:string;max:number;placeholder:string;onChange:(value:string)=>void}){return <label className="space-y-1 text-sm"><span className="flex justify-between"><span>{label}</span><span className="text-xs text-muted-foreground">{value.length}/{max}</span></span><Input value={value} maxLength={max} placeholder={placeholder} onChange={event=>onChange(event.target.value)}/></label>}
