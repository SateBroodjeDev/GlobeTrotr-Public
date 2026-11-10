type Session = { user: { id: string } };
type Boundary<T> = {
 publish: (session: T | null, loading: boolean) => void;
 clearQueries: () => void;
 offline: (owner: string | null) => Promise<void>;
 push: (owner: string | null, previous: string | null) => Promise<void>;
 signOut: () => Promise<unknown>;
};
export function accountTransitions<T extends Session>(boundary: Boundary<T>) {
 let revision = 0, owner: string | null = null, active = true;
 const lock = () => { revision++; owner = null; boundary.publish(null, false); boundary.clearQueries(); };
 return {
  lock,
  dispose: () => { active = false; revision++; },
  async accept(next: T | null) {
   const version = ++revision, previous = owner, target = next?.user.id ?? null;
   const current = () => active && version === revision;
   if (target !== previous) { boundary.publish(null, true); boundary.clearQueries(); }
   try {
    // Invalidate old offline I/O before a potentially failing push operation.
    if (target !== previous) await boundary.offline(null);
    if (!current()) return;
    await boundary.push(target, previous);
    if (!current()) return;
    await boundary.offline(target);
    if (!current()) return;
    owner = target; boundary.publish(next, false);
   } catch {
    if (!current()) return;
    owner = null; boundary.publish(null, false); boundary.clearQueries();
    // Invalidates synchronously; never publish next after any cleanup rejection.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
     await Promise.race([
      Promise.allSettled([boundary.offline(null), boundary.push(null, previous)]),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 5000); }),
     ]);
    } finally {
     clearTimeout(timer);
     if (current() && target !== null) await boundary.signOut().catch(() => {});
    }
   }
  },
 };
}

/** Cleanup errors remain visible, but can never skip the actual session logout. */
export async function logoutAccount<T>(signOut: () => Promise<T>, cleanup: () => Promise<unknown>, lock: () => void) {
 let result: T;
 let lockError: unknown;
 try { lock(); } catch (error) { lockError = error; }
 try { await cleanup(); if (lockError) throw lockError; }
 finally { result = await signOut(); }
 return result;
}

/** A late profile refresh is not authority to switch authenticated accounts. */
export function refreshAccountSession<T extends { user: { id: string } }>(current: T | null, user: T["user"]): T | null {
 return current && current.user.id === user.id ? { ...current, user } : current;
}
