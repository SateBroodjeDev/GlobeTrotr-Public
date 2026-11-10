// Shared origin storage, also read by push-sw.js. No network or credentials.
let revision = 0;
export function writePushAccountGate(owner: string | null): Promise<void> {
 const version = ++revision;
 return new Promise((resolve, reject) => {
  const request = indexedDB.open("globetrotr-push-account-v1", 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state"); };
  request.onerror = request.onblocked = () => reject(new Error("PUSH_ACCOUNT_FENCE_FAILED"));
  request.onsuccess = () => {
   const db = request.result; db.onversionchange = () => db.close();
   // A delayed open must not enqueue an old allow after a newer deny.
   if (version !== revision) { db.close(); resolve(); return; }
   try {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    if (owner) store.put(owner, "owner"); else store.delete("owner");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error("PUSH_ACCOUNT_FENCE_FAILED")); };
   } catch { db.close(); reject(new Error("PUSH_ACCOUNT_FENCE_FAILED")); }
  };
 });
}
