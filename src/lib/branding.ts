import type { Branding, PlanId } from "./types";

export const GLOBETROTR_BRANDING: Branding={brandName:"GlobeTrotr",domain:"globetrotr.nl",accent:172,tagline:"Plan elke reis. Verantwoord elke euro."};
export type AgencyBrandingSource={system_name?:string;domain?:string;accent?:number;tagline?:string;logo_path?:string|null}|null|undefined;

/** Eén hiërarchie voor app, exports en later reisafwijkingen. */
export function resolveBranding(plan:PlanId,agency:AgencyBrandingSource,legacy?:Partial<Branding>|null,trip?:Partial<Branding>|null):Branding{
  if(plan!=="agency")return GLOBETROTR_BRANDING;
  const base:Branding={
    brandName:agency?.system_name?.trim()||legacy?.brandName?.trim()||GLOBETROTR_BRANDING.brandName,
    domain:agency?.domain?.trim()||legacy?.domain?.trim()||GLOBETROTR_BRANDING.domain,
    accent:Number.isFinite(agency?.accent)?Math.min(360,Math.max(0,Number(agency?.accent))):legacy?.accent??GLOBETROTR_BRANDING.accent,
    tagline:agency?.tagline?.trim()||legacy?.tagline?.trim()||GLOBETROTR_BRANDING.tagline,
    logoPath:agency?.logo_path||legacy?.logoPath||undefined,
  };
  return {...base,...Object.fromEntries(Object.entries(trip??{}).filter(([,value])=>value!==undefined&&value!==null&&value!==""))};
}
