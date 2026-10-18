import { lookup as dnsLookup } from "node:dns/promises";
import { Agent } from "node:https";
import { isIP } from "node:net";

function denied() {
  return Object.assign(new Error("OUTBOUND_TARGET_NOT_PUBLIC"), { code: "OUTBOUND_TARGET_NOT_PUBLIC" });
}

// User-configured endpoints must never reach loopback, private networks,
// cloud metadata, documentation, multicast or IPv4 transition addresses.
// Keep the trusted platform SMTP/IMAP configuration outside this policy.
export function isPublicAddress(address) {
  if (typeof address !== "string") return false;
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes("%")) return false;
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = normalized.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const parts = (right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end]).map((part) => parseInt(part, 16));
  const [a, b] = parts;
  // Global unicast 2000::/3; excludes mapped IPv4, NAT64, ULA and link-local.
  if (a < 0x2000 || a >= 0x4000) return false;
  return !(
    (a === 0x2001 && (b < 0x0200 || b === 0x0db8)) ||
    a === 0x2002 ||
    (a === 0x3fff && b < 0x1000)
  );
}

function normalizeHost(value) {
  const host = String(value || "").trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw denied();
    return host;
  }
  if (
    !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host) ||
    /\.(?:localhost|local|internal|home|lan)$/.test(host) ||
    /^[0-9.]+$/.test(host)
  ) throw denied();
  return host;
}

export function publicHttpsHostname(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw denied(); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) throw denied();
  return normalizeHost(url.hostname);
}

async function publicAddresses(host, resolve = dnsLookup) {
  const hostname = normalizeHost(host);
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  let timer;
  const records = await Promise.race([
    resolve(hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(denied()), 5000); }),
  ]).finally(() => clearTimeout(timer));
  if (!Array.isArray(records) || !records.length || records.some((record) => !isPublicAddress(record.address) || isIP(record.address) !== record.family)) throw denied();
  return records;
}

export async function publicSmtpConnection(host, resolve = dnsLookup) {
  const hostname = normalizeHost(host);
  const records = await publicAddresses(hostname, resolve);
  const selected = records.find((record) => record.family === 4) || records[0];
  // Nodemailer connects to the checked IP. TLS still verifies the original
  // provider hostname; a second DNS lookup cannot rebind to an internal IP.
  return { host: selected.address, tls: { servername: hostname } };
}

export async function publicHttpsAgent(endpoint, resolve = dnsLookup) {
  const hostname = publicHttpsHostname(endpoint);
  const records = await publicAddresses(hostname, resolve);
  return new Agent({
    keepAlive: false,
    lookup: (requested, options, callback) => {
      if (normalizeHost(requested) !== hostname) return callback(denied());
      const family = typeof options === "number" ? options : options?.family;
      const choices = family ? records.filter((record) => record.family === family) : records;
      if (!choices.length) return callback(denied());
      if (options?.all) return callback(null, choices.map((record) => ({ ...record })));
      callback(null, choices[0].address, choices[0].family);
    },
  });
}
