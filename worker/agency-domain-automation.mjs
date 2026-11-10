import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { resolveCname, resolveTxt, resolveSoa } from 'node:dns/promises';
import { agencyCloudflareTarget, agencyDnsEvidence, agencyDomainFilter } from './agency-domain.mjs';
import { publicHttpsAgent } from './public-network.mjs';

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fail = code => Object.assign(new Error(code), { code });
export const domainProofPath = '/.well-known/globetrotr-domain-proof';

export function domainAutomationConfig(env) {
  const flag = env.CLOUDFLARE_DOMAIN_AUTOMATION_ENABLED ?? 'false';
  if (!['true','false'].includes(flag)) throw fail('DOMAIN_AUTOMATION_CONFIG_INVALID');
  if (flag === 'false') return { enabled: false };
  const zoneId = env.CLOUDFLARE_DOMAIN_ZONE_ID;
  const token = env.CLOUDFLARE_DOMAIN_API_TOKEN;
  const proofKey = env.CLOUDFLARE_DOMAIN_PROOF_KEY;
  const maxHostnames = Number(env.CLOUDFLARE_DOMAIN_MAX_HOSTNAMES ?? '100');
  if (!/^[a-f0-9]{32}$/i.test(zoneId ?? '') || !/^[a-z0-9_-]{20,256}$/i.test(token ?? '')
    || !/^[a-f0-9]{64}$/i.test(proofKey ?? '') || !Number.isInteger(maxHostnames)
    || maxHostnames < 1 || maxHostnames > 1000) throw fail('DOMAIN_AUTOMATION_CONFIG_INVALID');
  return { enabled: true, zoneId, token, proofKey, maxHostnames };
}

function externalHostname(hostname) {
  return typeof hostname === 'string' && /^[a-z0-9.-]+\.[a-z]{2,63}$/.test(hostname)
    && agencyDomainFilter(hostname)?.startsWith('custom_domain=')
    && !/\.(local|internal|localhost|home|lan|test|invalid|example)$/.test(hostname);
}

/** Return only DNS instructions belonging to this exact hostname; never keys/provider errors. */
export function cloudflareDnsRecords(record, hostname) {
  if (record?.hostname !== hostname || !uuid.test(record.id ?? '')) throw fail('DOMAIN_PROVIDER_RESPONSE_INVALID');
  const records = [];
  function add(type, name, value) {
    name = String(name ?? '').toLowerCase().replace(/\.$/, '');
    if (!name.endsWith('.' + hostname) || !/^[a-z0-9_.-]{1,253}$/.test(name)
      || typeof value !== 'string' || !value || value.length > 2048 || /[\r\n\x00]/.test(value)) return;
    if (type === 'CNAME' && !/^(?:[a-z0-9-]+\.)+dcv\.cloudflare\.com\.?$/i.test(value)
      && value !== 'dcv.cloudflare.com') return;
    const item = { type, name, value };
    if (!records.some(r => r.type === type && r.name === name && r.value === value)) records.push(item);
  }
  if (record.ownership_verification?.type === 'txt') {
    const item = record.ownership_verification;
    add('TXT', item.name, item.value);
  }
  for (const item of record.ssl?.validation_records ?? []) {
    if (item.txt_name && item.txt_value) add('TXT', item.txt_name, item.txt_value);
    if (item.cname && item.cname_target) add('CNAME', item.cname, item.cname_target);
  }
  if (records.length > 12) throw fail('DOMAIN_PROVIDER_RESPONSE_INVALID');
  return records;
}

export function createDomainProvider(config, fetcher = fetch) {
  async function call(method, suffix = '', body) {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames${suffix}`, {
        method, headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8000), redirect: 'error',
      });
    if (response.status === 404 && method === 'GET' && suffix.startsWith('/')) return null;
    if (!response.ok) throw fail(response.status === 429 ? 'DOMAIN_PROVIDER_RATE_LIMITED' : 'DOMAIN_PROVIDER_UNAVAILABLE');
    const result = await response.json();
    if (result?.success !== true) throw fail('DOMAIN_PROVIDER_UNAVAILABLE');
    return result;
  }
  return {
    async inspect(id, hostname) {
      if (!uuid.test(id)) throw fail('DOMAIN_PROVIDER_ID_INVALID');
      const body = await call('GET', '/' + id);
      if (!body) return null;
      if (body.result?.hostname !== hostname || body.result?.id !== id) throw fail('DOMAIN_PROVIDER_BINDING_MISMATCH');
      cloudflareDnsRecords(body.result, hostname);
      return body.result;
    },
    async find(hostname) {
      if (!externalHostname(hostname)) throw fail('INVALID_CUSTOM_DOMAIN');
      const query = new URLSearchParams({ 'hostname.exact': hostname, per_page: '5' });
      const body = await call('GET', '?' + query);
      if (!Array.isArray(body.result)) throw fail('DOMAIN_PROVIDER_RESPONSE_INVALID');
      const matches = body.result.filter(r => r.hostname === hostname);
      if (matches.length > 1) throw fail('DOMAIN_PROVIDER_BINDING_MISMATCH');
      if (matches[0]) cloudflareDnsRecords(matches[0], hostname);
      return matches[0] ?? null;
    },
    async create(hostname) {
      if (!externalHostname(hostname)) throw fail('INVALID_CUSTOM_DOMAIN');
      const count = await call('GET', '?per_page=5');
      if (!Number.isInteger(count.result_info?.total_count)) throw fail('DOMAIN_PROVIDER_RESPONSE_INVALID');
      if (count.result_info.total_count >= config.maxHostnames) throw fail('DOMAIN_HOSTNAME_LIMIT');
      const body = await call('POST', '', { hostname,
        ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } } });
      cloudflareDnsRecords(body.result, hostname);
      return body.result;
    },
    async remove(id, hostname) {
      const record = await this.inspect(id, hostname);
      if (record) await call('DELETE', '/' + id);
    },
  };
}

export function domainProof(config, hostname, nonce) {
  if (!config.enabled || !externalHostname(hostname) || !uuid.test(nonce)) return null;
  return { hostname, nonce,
    signature: createHmac('sha256', config.proofKey).update(`${hostname}\n${nonce}`).digest('hex') };
}

export async function verifyDomainRoute(config, hostname, { agentFor = publicHttpsAgent, request = httpsRequest } = {}) {
  const nonce = randomUUID();
  const url = new URL(`https://${hostname}${domainProofPath}?nonce=${nonce}`);
  const agent = await agentFor(url.href);
  try {
    const body = await new Promise((resolve, reject) => {
      const connection = request(url, { agent, method: 'GET', rejectUnauthorized: true,
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } }, response => {
        if (response.statusCode !== 200) { response.resume(); reject(fail('DOMAIN_ROUTE_PENDING')); return; }
        let raw = '';
        response.on('data', chunk => {
          raw += chunk.toString('utf8');
          if (raw.length > 1024) connection.destroy(fail('DOMAIN_ROUTE_PENDING'));
        });
        response.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(fail('DOMAIN_ROUTE_PENDING')); } });
        response.on('error', reject);
      });
      const timer = setTimeout(() => connection.destroy(fail('DOMAIN_ROUTE_PENDING')), 15000);
      connection.once('close', () => clearTimeout(timer));
      connection.on('error', reject);
      connection.end();
    });
    const expected = domainProof(config, hostname, nonce);
    return body?.hostname === hostname && body?.nonce === nonce && /^[a-f0-9]{64}$/.test(body?.signature ?? '')
      && timingSafeEqual(Buffer.from(body.signature, 'hex'), Buffer.from(expected.signature, 'hex'));
  } finally { agent.destroy(); }
}

async function dnsResult(resolve, hostname) {
  try { return await resolve(hostname); }
  catch (error) {
    if (['ENODATA','ENOTFOUND'].includes(error.code)) return [];
    throw fail('DOMAIN_DNS_UNAVAILABLE');
  }
}

/** One durable, globally serialized job. Credentials and raw provider bodies never reach logs/UI. */
export async function processAgencyDomainJob({ config, rpc, provider = createDomainProvider(config),
  cname = resolveCname, txt = resolveTxt, soa = resolveSoa, route = verifyDomainRoute }) {
  if (!config.enabled) return;
  const rows = await rpc('claim_agency_domain_provisioning');
  const job = rows?.[0];
  if (!job) return;
  let providerId = job.provider_id;
  let managed = job.managed;
  let records = job.dns_records ?? [];
  async function finish(state, error = null) {
    await rpc('finish_agency_domain_provisioning', { p_id: job.id, p_lease: job.lease,
      p_token: job.verification_token, p_provider_id: providerId, p_managed: managed,
      p_records: records, p_state: state, p_error: error });
  }
  try {
    if (!externalHostname(job.hostname)) throw fail('INVALID_CUSTOM_DOMAIN');
    if (!job.desired) {
      if (providerId && managed) await provider.remove(providerId, job.hostname);
      // Manually created legacy resources are never destroyed without a prior
      // app ownership proof. All resources this worker created are managed.
      await finish('deleted');
      return;
    }
    let record = providerId ? await provider.inspect(providerId, job.hostname) : await provider.find(job.hostname);
    if (providerId && !record) throw fail('DOMAIN_PROVIDER_RECORD_REMOVED');
    if (!record) { record = await provider.create(job.hostname); managed = true; }
    providerId = record.id;
    records = cloudflareDnsRecords(record, job.hostname);
    if (!job.verify_requested) { await finish('dns_pending'); return; }

    const [cnames, txts] = await Promise.all([
      dnsResult(cname, job.hostname), dnsResult(txt, '_globetrotr.' + job.hostname),
    ]);
    const evidence = agencyDnsEvidence(cnames, txts, job.verification_token, true);
    if (!evidence.txtOk) { await finish('dns_pending'); return; }
    if (job.dns_kind === 'cname' && !evidence.cnameOk) { await finish('dns_pending'); return; }
    if (job.dns_kind === 'alias') {
      // An apex is an authoritative zone cut. Flattening hides its CNAME, so
      // never infer routing from shared A/AAAA addresses; prove actual HTTPS.
      if (!(await dnsResult(soa, job.hostname))?.nsname) { await finish('dns_pending'); return; }
    }
    managed = true; // Exact legacy hostname can be adopted only after our unique ownership proof.
    if (record.status !== 'active' || record.ssl?.status !== 'active') {
      await finish('certificate_pending'); return;
    }
    if (!await rpc('authorize_agency_domain_origin', {
      p_id: job.id, p_lease: job.lease, p_token: job.verification_token,
    })) throw fail('DOMAIN_ACTIVATION_STALE');
    let routed = false;
    try { routed = await route(config, job.hostname); } catch { /* Origin issuance/routing can still be pending. */ }
    await finish(routed ? 'active' : 'route_pending');
  } catch (error) {
    const safe = new Set(['INVALID_CUSTOM_DOMAIN','DOMAIN_PROVIDER_RATE_LIMITED','DOMAIN_HOSTNAME_LIMIT',
      'DOMAIN_PROVIDER_BINDING_MISMATCH','DOMAIN_PROVIDER_RECORD_REMOVED','DOMAIN_DNS_UNAVAILABLE','DOMAIN_ACTIVATION_STALE']);
    await finish('error', safe.has(error.code) ? error.code : 'DOMAIN_PROVISIONING_UNAVAILABLE');
  }
}

export { agencyCloudflareTarget };
