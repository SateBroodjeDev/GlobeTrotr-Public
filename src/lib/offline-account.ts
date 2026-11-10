/** Account boundary shared by trip packs, documents, journal snapshots and drafts. */
export const OFFLINE_OWNER_KEY = "globetrotr.offline-owner-v2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let boundOwner: string | null = null;
let initialized = false;
let transition: Promise<void> = Promise.resolve();
const pending = new Set<Promise<unknown>>();
function storage(): Storage { return typeof window !== "undefined" ? window.localStorage : localStorage; }
export function offlineOwner() {
  const owner = storage().getItem(OFFLINE_OWNER_KEY);
  if (!initialized || !owner || !UUID.test(owner) || owner !== boundOwner)
    throw new Error("OFFLINE_ACCOUNT_UNAVAILABLE");
  return owner;
}
export function offlineNamespace(base: string) { return `${base}:${offlineOwner()}`; }
export function scopedOffline<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
  return (...args: Args): Promise<Result> => {
    let owner: string;
    try { owner = offlineOwner(); } catch (error) { return Promise.reject(error); }
    const task = (async () => {
      const result = await operation(...args);
      if (offlineOwner() !== owner) throw new Error("OFFLINE_ACCOUNT_CHANGED");
      return result;
    })();
    pending.add(task);
    void task.finally(() => pending.delete(task)).catch(() => {});
    return task;
  };
}
function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = request.onblocked = () => reject(new Error("OFFLINE_STORAGE_CLEANUP_FAILED"));
  });
}
function removeKeys(prefixes: string[]) {
  const target = storage();
  for (let index = target.length - 1; index >= 0; index--) {
    const key = target.key(index);
    if (key && prefixes.some(prefix => key.startsWith(prefix))) target.removeItem(key);
  }
}
let revision = 0;
export function changeOfflineAccount(next: string | null): Promise<void> {
  if (next !== null && !UUID.test(next)) return Promise.reject(new Error("OFFLINE_ACCOUNT_INVALID"));
  let previous: string | null;
  try {
    previous = boundOwner ?? storage().getItem(OFFLINE_OWNER_KEY);
    if (initialized && previous === next && storage().getItem(OFFLINE_OWNER_KEY) === next) return transition;
    // Invalidate synchronously, including other tabs. No new storage I/O may start.
    initialized = false;
    storage().removeItem(OFFLINE_OWNER_KEY);
  } catch { initialized = false; return Promise.reject(new Error("OFFLINE_STORAGE_CLEANUP_FAILED")); }
  const currentRevision = ++revision;
  transition = transition.catch(() => {}).then(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled([...pending]),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("OFFLINE_STORAGE_CLEANUP_FAILED")), 5000); }),
      ]);
    } finally { clearTimeout(timer); }
    // Explicit owner approval: erase pre-account storage, never guess its owner.
    await Promise.all([deleteDatabase("globetrotr-offline-v1"), deleteDatabase("globetrotr-journal-v1")]);
    removeKeys(["globetrotr.offline-pack.", "globetrotr-journal-draft:"]);
    if (previous && previous !== next && UUID.test(previous)) {
      await Promise.all([deleteDatabase(`globetrotr-offline-v2:${previous}`), deleteDatabase(`globetrotr-journal-v2:${previous}`)]);
      removeKeys([`globetrotr.offline-pack-v2.${previous}.`, `globetrotr-journal-draft-v2:${previous}:`]);
    }
    if (currentRevision !== revision) return;
    boundOwner = next;
    initialized = true;
    if (next) storage().setItem(OFFLINE_OWNER_KEY, next);
  });
  return transition;
}
