export type AgencyDnsRecord = { type: "TXT" | "CNAME" | "ALIAS"; name: string; value: string };
export type AgencyDnsCheck = AgencyDnsRecord & {
  status: "matched" | "missing" | "mismatch" | "unavailable" | "pending";
};

export function agencyDnsRecords(settings: {
  customDomain: string; domainCnameTarget: string; verificationToken: string;
  dnsKind?: string; providerDnsRecords?: { type: "TXT" | "CNAME"; name: string; value: string }[];
}): AgencyDnsRecord[] {
  const records: AgencyDnsRecord[] = [
    { type: settings.dnsKind === "alias" ? "ALIAS" : "CNAME", name: settings.customDomain, value: settings.domainCnameTarget },
    ...(settings.verificationToken ? [{ type: "TXT" as const, name: `_globetrotr.${settings.customDomain}`, value: `globetrotr-verification=${settings.verificationToken}` }] : []),
    ...(settings.providerDnsRecords ?? []),
  ];
  return records.filter((record, index) => records.findIndex(other =>
    other.type === record.type && other.name === record.name && other.value === record.value) === index);
}

export async function checkAgencyDnsRecords(records: AgencyDnsRecord[], lookup: {
  cname: (name: string) => Promise<string[]>;
  txt: (name: string) => Promise<string[][]>;
}): Promise<AgencyDnsCheck[]> {
  const normalize = (value: string) => value.toLowerCase().replace(/\.$/, "");
  return Promise.all(records.map(async record => {
    try {
      const values = record.type === "TXT"
        ? (await lookup.txt(record.name)).map(parts => parts.join(""))
        : await lookup.cname(record.name);
      const matched = record.type === "TXT" ? values.includes(record.value)
        : values.some(value => normalize(value) === normalize(record.value));
      // Flattening hides CNAMEs. Only the activation worker's signed HTTPS
      // proof establishes routing; shared A/AAAA addresses are not evidence.
      const status = matched ? "matched" : record.type === "ALIAS" ? "pending"
        : values.length ? "mismatch" : "missing";
      return { ...record, status };
    } catch (error) {
      const code = (error as { code?: string }).code;
      const absent = code === "ENODATA" || code === "ENOTFOUND";
      return { ...record, status: absent ? record.type === "ALIAS" ? "pending" : "missing" : "unavailable" };
    }
  }));
}
