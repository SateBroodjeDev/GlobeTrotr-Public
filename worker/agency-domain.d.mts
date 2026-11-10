export const reservedAgencyLabels: ReadonlySet<string>;
export const agencyCloudflareTarget: string;
export function agencySubdomainForTls(domain: unknown): string | null;
export function agencyDomainFilter(domain: unknown): string | null;
export function agencyDnsEvidence(cnames: string[], txtRecords: string[][], token: string, cloudflare?: boolean): {
  cnameOk: boolean; txtOk: boolean;
};
