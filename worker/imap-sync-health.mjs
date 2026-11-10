import { open, readFile, rename, writeFile } from "node:fs/promises";

export const imapHealthPath = "/tmp/globetrotr-imap-sync-health.json";
const validIdentity = value => value && Number.isInteger(value.pid) && value.pid > 0 && value.pid <= 4_194_304 &&
  typeof value.startTicks === "string" && /^\d{1,20}$/.test(value.startTicks);

export function parseImapProcessIdentity(pid, stat) {
  if (!Number.isInteger(pid) || pid < 1 || pid > 4_194_304 || typeof stat !== "string" ||
      !stat.startsWith(`${pid} (`) || stat.lastIndexOf(")") < 3) return null;
  const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
  const value = { pid, startTicks: fields[19] };
  return validIdentity(value) ? value : null;
}

/** Linux process start ticks distinguish a restarted container reusing PID 1. */
export async function imapProcessIdentity(pid = process.pid) {
  if (!Number.isInteger(pid) || pid < 1 || pid > 4_194_304) return null;
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return parseImapProcessIdentity(pid, stat);
  } catch { return null; }
}

export function createImapSyncHealth({ intervalMs, identity, now = Date.now }) {
  if (!Number.isInteger(intervalMs) || intervalMs < 15_000 || intervalMs > 900_000)
    throw new Error("INVALID_IMAP_HEALTH_INTERVAL");
  let value = { schemaVersion: 1, intervalMs, identity, startedAt: null, completedAt: null,
    lastSuccessAt: null, running: false, outcome: "unknown", succeeded: 0, failed: 0 };
  return {
    start() { value = { ...value, running: true, startedAt: new Date(now()).toISOString() }; },
    complete({ succeeded, failed }) {
      if (![succeeded, failed].every(count => Number.isSafeInteger(count) && count >= 0))
        throw new Error("INVALID_IMAP_HEALTH_COUNTS");
      const at = new Date(now()).toISOString();
      const outcome = failed > 0 ? "failed" : succeeded > 0 ? "success" : "empty";
      value = { ...value, running: false, completedAt: at, outcome, succeeded, failed,
        lastSuccessAt: outcome === "success" ? at : value.lastSuccessAt };
    },
    fail() { value = { ...value, running: false, completedAt: new Date(now()).toISOString(), outcome: "failed", succeeded: 0, failed: 0 }; },
    snapshot() { return { ...value, identity: value.identity && { ...value.identity } }; },
  };
}

export function imapSyncHealthStatus(value, identity, now = Date.now()) {
  const result = (status, reason, checkedAt = null) => ({ schemaVersion: 1, status, reason, checkedAt });
  if (!value || value.schemaVersion !== 1 || !validIdentity(identity) || !validIdentity(value.identity) ||
      identity.pid !== value.identity.pid || identity.startTicks !== value.identity.startTicks ||
      !Number.isInteger(value.intervalMs) || value.intervalMs < 15_000 || value.intervalMs > 900_000 ||
      typeof value.running !== "boolean" || !["unknown", "empty", "success", "failed"].includes(value.outcome) ||
      ![value.succeeded, value.failed].every(count => Number.isSafeInteger(count) && count >= 0))
    return result("unknown", "unconfirmed");
  const timestamp = input => typeof input === "string" ? Date.parse(input) : NaN;
  const started = timestamp(value.startedAt), completed = timestamp(value.completedAt);
  if (!Number.isFinite(started) || started > now + 60_000 ||
      (value.completedAt !== null && (!Number.isFinite(completed) || completed > now + 60_000)) ||
      (!value.running && (!Number.isFinite(completed) || completed < started)))
    return result("unknown", "unconfirmed");
  const maxAgeMs = Math.max(300_000, value.intervalMs * 3);
  const checkedAt = Number.isFinite(completed) ? value.completedAt : value.startedAt;
  // A later attempt must not hide an earlier failure or refresh old success.
  if (value.outcome === "failed") return result("degraded", "sync_failed", checkedAt);
  if ((value.running && now - started > maxAgeMs) ||
      (value.outcome !== "empty" && Number.isFinite(completed) && now - completed > maxAgeMs))
    return result("degraded", "sync_overdue", checkedAt);
  if (value.outcome === "success" && value.succeeded > 0 && value.failed === 0 &&
      value.lastSuccessAt === value.completedAt && Number.isFinite(completed) && now - completed <= maxAgeMs)
    return result("operational", "recent_sync", checkedAt);
  return result("unknown", value.outcome === "empty" ? "no_mailboxes" : "waiting_for_sync", checkedAt);
}

export async function writeImapSyncHealth(value, path = imapHealthPath) {
  const temporary = path + ".tmp";
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}

/** Log transitions only; never emit mailbox metadata or one record per poll. */
export function createImapHealthReporter({ write = writeImapSyncHealth, log, now = Date.now }) {
  let writeFailed = false, previous = null;
  return async value => {
    try { await write(value); }
    catch {
      if (!writeFailed) log("error", "imap.health_state_unavailable", { errorCode: "IMAP_HEALTH_STATE_WRITE_FAILED" });
      writeFailed = true;
      return false;
    }
    if (writeFailed) log("info", "imap.health_state_recovered", {});
    writeFailed = false;
    const { status, reason, checkedAt } = imapSyncHealthStatus(value, value?.identity, now());
    const key = `${status}:${reason}`;
    if (key !== previous) {
      log(status === "degraded" ? "error" : "info", "imap.health_changed", { status, reason, checkedAt });
      previous = key;
    }
    return true;
  };
}

export async function readImapSyncHealth({ path = imapHealthPath, now = Date.now(), getIdentity = imapProcessIdentity } = {}) {
  let file;
  try {
    file = await open(path, "r");
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 4096) throw new Error("INVALID_HEALTH_FILE");
    const value = JSON.parse(await file.readFile("utf8"));
    const identity = validIdentity(value?.identity) ? await getIdentity(value.identity.pid) : null;
    return imapSyncHealthStatus(value, identity, now);
  } catch { return { schemaVersion: 1, status: "unknown", reason: "unconfirmed", checkedAt: null }; }
  finally { await file?.close(); }
}
