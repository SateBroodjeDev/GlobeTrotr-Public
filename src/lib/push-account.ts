import { writePushAccountGate } from "./push-account-gate.ts";
import { logoutAccount } from "./account-transition.ts";
import { offlineOwner, changeOfflineAccount } from "./offline-account.ts";
const OWNER = "globetrotr.push-owner-v1";
async function within<T>(work: Promise<T>): Promise<T> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try { return await Promise.race([work, new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error("PUSH_ACCOUNT_CLEANUP_TIMEOUT")), 5000);
 })]); } finally { clearTimeout(timer); }
}
type Runtime = {
 owner: () => string | null; storeOwner: (owner: string | null) => void;
 currentAccount: () => string; gate: (owner: string | null) => Promise<void>;
 registration: () => Promise<ServiceWorkerRegistration | undefined>;
 signal: (registration: ServiceWorkerRegistration, owner: string | null) => Promise<void>;
 revoke: (endpoint: string) => Promise<unknown>;
};
/** One serialized boundary, shared by auth transitions and explicit registration. */
export function createPushAccountBoundary(runtime: Runtime) {
 let revision = 0, serial: Promise<void> = Promise.resolve();
 const enqueue = (operation: () => Promise<void>) => {
  const task = serial.catch(() => {}).then(operation); serial = task; return task;
 };
 return {
  bind(owner: string) {
   const version = revision;
   return enqueue(async () => {
    if (version !== revision || runtime.currentAccount() !== owner) throw new Error("PUSH_ACCOUNT_CHANGED");
    const registration = await within(runtime.registration());
    if (!registration) throw new Error("PUSH_ACCOUNT_UNAVAILABLE");
    try {
     await within(runtime.gate(owner));
     if (version !== revision || runtime.currentAccount() !== owner) throw new Error("PUSH_ACCOUNT_CHANGED");
     await within(runtime.signal(registration, owner));
     if (version !== revision || runtime.currentAccount() !== owner) throw new Error("PUSH_ACCOUNT_CHANGED");
     runtime.storeOwner(owner);
    } catch (error) { await within(runtime.gate(null)); throw error; }
   });
  },
  change(next: string | null, previous?: string | null) {
   const version = ++revision;
   return enqueue(async () => {
    let bound: string | null = null;
    try { bound = runtime.owner(); } catch { /* Treat unreadable ownership as unknown. */ }
    if (version !== revision) return;
    if (next && bound === next && (!previous || previous === next)) {
     let registration: ServiceWorkerRegistration | undefined;
     try {
      registration = await within(runtime.registration());
      await within(runtime.gate(next));
      if (version !== revision) { await within(runtime.gate(null)); return; }
      if (registration) await within(runtime.signal(registration, next));
      return;
     } catch {
      // Unknown/old service workers must not retain a previous display grant.
      await within(runtime.gate(null));
      if (registration) await within(registration.unregister());
      runtime.storeOwner(null); throw new Error("PUSH_ACCOUNT_FENCE_FAILED");
     }
    }
    // Persist deny before reading browser registrations or endpoint metadata:
    // failures of either API must never leave the former allow record behind.
    let durable = false;
    try { await within(runtime.gate(null)); durable = true; } catch { /* Use unregister fallback below. */ }
    try { runtime.storeOwner(null); } catch { /* Durable display grant is independently denied. */ }
    const registration = await within(runtime.registration());
    let subscription: PushSubscription | null = null, subscriptionReadFailed = false;
    try { subscription = await within(registration?.pushManager.getSubscription() ?? Promise.resolve(null)); }
    catch { subscriptionReadFailed = true; }
    // Start revocation while old session credentials are still available.
    const revoked = next === null && subscription ? within(runtime.revoke(subscription.endpoint)).catch(() => false) : Promise.resolve(false);
    let workerFenced = !registration;
    if (registration) {
     try { await within(runtime.signal(registration, null)); workerFenced = true; }
     catch { try { workerFenced = await within(registration.unregister()); } catch { workerFenced = false; } }
     if (!durable) { try { workerFenced = await within(registration.unregister()); } catch { workerFenced = false; } }
     try { for (const notification of await within(registration.getNotifications())) notification.close(); } catch { /* Grant is already fenced; continue endpoint cleanup. */ }
    }
    let unsubscribed = !subscription;
    try { if (subscription) unsubscribed = await within(subscription.unsubscribe()); }
    finally { await revoked; }
    if (!workerFenced) throw new Error("PUSH_ACCOUNT_FENCE_FAILED");
    if (subscriptionReadFailed) throw new Error("PUSH_ACCOUNT_SUBSCRIPTION_UNCONFIRMED");
    if (!unsubscribed) throw new Error("PUSH_ACCOUNT_UNSUBSCRIBE_FAILED");
   });
  },
 };
}
const browser = createPushAccountBoundary({
 owner: () => window.localStorage.getItem(OWNER),
 storeOwner: owner => owner ? window.localStorage.setItem(OWNER, owner) : window.localStorage.removeItem(OWNER),
 currentAccount: offlineOwner,
 gate: writePushAccountGate,
 registration: () => navigator.serviceWorker.getRegistration('/'),
 async signal(registration, owner) {
  if (!registration.active) throw new Error("PUSH_ACCOUNT_FENCE_FAILED");
  const channel = new MessageChannel();
  try {
   await within(new Promise<void>((resolve, reject) => {
    channel.port1.onmessage = event => event.data === "GLOBETROTR_PUSH_FENCE_V1" ? resolve() : reject(new Error("PUSH_ACCOUNT_FENCE_FAILED"));
    registration.active!.postMessage({ type: "GLOBETROTR_PUSH_FENCE", owner }, [channel.port2]);
   }));
  } finally { channel.port1.close(); channel.port2.close(); }
 },
 async revoke(endpoint) {
  const { revokePushSubscription } = await import("./push.functions");
  return revokePushSubscription({ data: { endpoint } });
 },
});
export const bindBrowserPushAccount = (owner: string) => browser.bind(owner);
export function changeBrowserPushAccount(next: string | null, previous?: string | null) {
 if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve();
 return browser.change(next, previous);
}
export async function signOutWithPushCleanup<T>(signOut: () => Promise<T>) {
 return logoutAccount(signOut, async () => {
  const outcomes = await within(Promise.allSettled([changeOfflineAccount(null),
   typeof navigator !== "undefined" && "serviceWorker" in navigator ? writePushAccountGate(null) : Promise.resolve(),
   changeBrowserPushAccount(null)]));
  if (outcomes.some(outcome => outcome.status === "rejected")) throw new Error("ACCOUNT_CLEANUP_UNCONFIRMED");
 }, () => window.dispatchEvent?.(new Event("globetrotr:account-lock")));
}
