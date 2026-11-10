import { supabase } from "@/integrations/supabase/client";
import { agencyHostLookup } from "./agency-domain";

export type PublicAgencyBranding = {
  workspaceId: string;
  brandName: string;
  tagline: string;
  accent: number;
  logoPath: string | null;
  domain: string;
  turnstileConfigured: boolean;
};

export async function getPublicAgencyHostBranding(
  hostname: string,
): Promise<PublicAgencyBranding | null> {
  if (!agencyHostLookup(hostname)) return null;
  const { data, error } = await (supabase as any).rpc("get_public_agency_host_branding", {
    p_host: hostname,
  }).abortSignal(AbortSignal.timeout(10_000));
  if (error) throw error;
  return data && typeof data === "object" ? (data as PublicAgencyBranding) : null;
}

export function publicAgencyLogoUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return supabase.storage.from("agency-logos").getPublicUrl(path).data.publicUrl;
}
