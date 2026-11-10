import { agencyDomainFilter } from './agency-domain.mjs';

const fail = code => Object.assign(new Error(code), { code });
const safeErrors = new Set(['AGENCY_AUTH_API_DENIED', 'AGENCY_AUTH_API_RATE_LIMITED',
  'AGENCY_AUTH_CONFIG_INVALID', 'AGENCY_AUTH_RESPONSE_INVALID', 'AGENCY_AUTH_CONCURRENT_CHANGE',
  'AGENCY_AUTH_VERIFICATION_PENDING', 'AGENCY_AUTH_LEASE_EXPIRED']);

export function agencyAuthRedirectConfig(env) {
  const flag = env.AGENCY_AUTH_REDIRECT_AUTOMATION_ENABLED ?? 'false';
  if (!['true', 'false'].includes(flag)) throw fail('AGENCY_AUTH_CONFIG_INVALID');
  if (flag === 'false') return { enabled: false };
  const projectRef = env.SUPABASE_MANAGEMENT_PROJECT_REF;
  const token = env.SUPABASE_MANAGEMENT_TOKEN;
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || !/^[a-zA-Z0-9_.-]{20,512}$/.test(token ?? '')
    || /^(eyJ|sb_secret_|sb_publishable_)/.test(token)
    || env.SUPABASE_URL?.replace(/\/$/, '') !== `https://${projectRef}.supabase.co`) {
    throw fail('AGENCY_AUTH_CONFIG_INVALID');
  }
  return { enabled: true, projectRef, token };
}

export function agencyCallbackUrls(hostname) {
  if (!agencyDomainFilter(hostname) || !/\.[a-z]{2,63}$/.test(hostname)
    || /\.(local|internal|localhost|home|lan|test|invalid|example)$/.test(hostname)) {
    throw fail('AGENCY_AUTH_RESPONSE_INVALID');
  }
  const base = `https://${hostname}/oauth-callback`;
  // Escape the literal query delimiter: unescaped ? is a Supabase glob wildcard.
  return [base, `${base}\\?**`];
}

export function parseRedirectList(value) {
  if (typeof value !== 'string' || value.length > 200000) throw fail('AGENCY_AUTH_RESPONSE_INVALID');
  return [...new Set(value.split(',').map(url => url.trim()).filter(Boolean))];
}

export function planAgencyRedirects(current, owned, hosts) {
  if (!Array.isArray(owned) || !Array.isArray(hosts) || hosts.length > 1000 || owned.length > 4000
    || !owned.every(url => typeof url === 'string' && url.length < 350)) throw fail('AGENCY_AUTH_RESPONSE_INVALID');
  const wanted = [...new Set(hosts.flatMap(agencyCallbackUrls))];
  const existing = parseRedirectList(current);
  const wantedSet = new Set(wanted), ownedSet = new Set(owned);
  const removed = owned.filter(url => !wantedSet.has(url));
  const added = wanted.filter(url => !existing.includes(url));
  // Adopt only entries absent in the provider GET. Pre-existing entries remain owner-managed.
  const nextOwned = [...new Set([...owned.filter(url => wantedSet.has(url)), ...added])];
  const next = [...existing.filter(url => !ownedSet.has(url) || wantedSet.has(url)), ...added];
  return { next: next.join(','), changed: added.length > 0 || removed.some(url => existing.includes(url)),
    intent: [...new Set([...owned, ...added])], owned: nextOwned, hosts: [...new Set(hosts)].sort() };
}

export function createAuthConfigProvider(config, fetcher = fetch) {
  async function call(method, allowList) {
    try {
      const response = await fetcher(`https://api.supabase.com/v1/projects/${config.projectRef}/config/auth`, {
        method, headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json',
          ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'PATCH' ? { body: JSON.stringify({ uri_allow_list: allowList }) } : {}),
        signal: AbortSignal.timeout(8000), redirect: 'error',
      });
      if (!response.ok) throw fail([401, 403].includes(response.status) ? 'AGENCY_AUTH_API_DENIED'
        : response.status === 429 ? 'AGENCY_AUTH_API_RATE_LIMITED' : 'AGENCY_AUTH_API_UNAVAILABLE');
      if (method === 'PATCH') { await response.body?.cancel(); return; }
      // The full response includes SMTP/provider secrets. Only return the allowlist.
      const body = await response.json();
      parseRedirectList(body?.uri_allow_list);
      return body.uri_allow_list;
    } catch (error) {
      throw fail(safeErrors.has(error?.code) ? error.code : 'AGENCY_AUTH_API_UNAVAILABLE');
    }
  }
  return { read: () => call('GET'), write: value => call('PATCH', value) };
}

/** A DB lease serializes all worker instances. Durable intent survives a lost PATCH response. */
export async function syncAgencyAuthRedirects({ config, rpc, provider = createAuthConfigProvider(config) }) {
  if (!config.enabled) return;
  const job = await rpc('claim_agency_auth_redirect_sync', { p_project_ref: config.projectRef });
  if (!job) return;
  const finish = (owned, hosts, error) => rpc('finish_agency_auth_redirect_sync', {
    p_lease: job.lease, p_owned_urls: owned, p_hosts: hosts, p_error: error,
  });
  try {
    const current = await provider.read();
    const plan = planAgencyRedirects(current, job.owned_urls, job.hosts);
    // Detect dashboard edits before recording intent. Never claim ownership of
    // entries another writer added between these two reads.
    if (plan.changed && await provider.read() !== current) throw fail('AGENCY_AUTH_CONCURRENT_CHANGE');
    // Commit ownership before any external write, while rechecking the domain snapshot.
    const valid = await rpc('prepare_agency_auth_redirect_sync', {
      p_lease: job.lease, p_owned_urls: plan.intent, p_hosts: plan.hosts,
    });
    if (!valid) throw fail('AGENCY_AUTH_LEASE_EXPIRED');
    if (plan.changed) {
      await provider.write(plan.next);
    }
    const checked = parseRedirectList(await provider.read());
    const expected = parseRedirectList(plan.next);
    if (checked.length !== expected.length || expected.some(url => !checked.includes(url))) {
      throw fail('AGENCY_AUTH_VERIFICATION_PENDING');
    }
    await finish(plan.owned, plan.hosts, null);
  } catch (error) {
    // SQL keeps the durable intent on failure; never discard a possibly applied addition.
    await finish([], [], safeErrors.has(error?.code) ? error.code : 'AGENCY_AUTH_API_UNAVAILABLE');
  }
}
