// Only background queues may wait longer when repeatedly empty. Delivery queues
// and scheduled maintenance retain their existing cadence in worker/index.mjs.
export const backgroundQueues = Object.freeze([
  "jobs", "mailboxProvisioning", "staffIdentities", "mailboxDeletions",
]);

export function createQueuePolling({ baseMs, maxIdleMs, now = () => performance.now() }) {
  if (!Number.isInteger(baseMs) || baseMs < 1 || !Number.isInteger(maxIdleMs) || maxIdleMs < baseMs)
    throw new Error("INVALID_QUEUE_POLLING_INTERVAL");
  const queues = new Map(backgroundQueues.map(name => [name, {
    emptyStreak: 0, nextAt: 0, delayMs: baseMs, running: false,
    emptyChecks: 0, nonemptyChecks: 0, claimedItems: 0, skippedCycles: 0, errors: 0,
  }]));
  const reset = state => { state.emptyStreak = 0; state.nextAt = 0; state.delayMs = baseMs; };
  return {
    async run(name, poll) {
      const state = queues.get(name);
      if (!state) throw new Error("UNKNOWN_BACKGROUND_QUEUE");
      if (state.running || now() < state.nextAt) {
        state.skippedCycles++;
        return false;
      }
      state.running = true;
      try {
        const count = await poll();
        if (count === 0) {
          state.emptyChecks++;
          state.emptyStreak++;
          // The first two empty checks keep the original interval. Subsequently
          // wait 2x, then at most 3x by default, without delaying other queues.
          state.delayMs = Math.min(maxIdleMs, baseMs * Math.max(1, state.emptyStreak - 1));
        } else {
          reset(state);
          if (Number.isInteger(count) && count > 0) {
            state.nonemptyChecks++;
            state.claimedItems += count;
            // A job may enqueue provisioning/deletion/identity work. Wake the
            // other background queues too; never claim their leases in advance.
            for (const other of queues.values()) if (other !== state) reset(other);
          }
          // Undefined (disabled) or invalid results are not evidence of emptiness.
        }
        state.nextAt = now() + state.delayMs;
        return true;
      } catch (error) {
        reset(state);
        state.errors++;
        state.nextAt = now() + baseMs;
        throw error;
      } finally {
        state.running = false;
      }
    },
    snapshot() {
      return { baseMs, maxIdleMs, queues: Object.fromEntries([...queues].map(([name, state]) => [name, {
        emptyChecks: state.emptyChecks, nonemptyChecks: state.nonemptyChecks,
        claimedItems: state.claimedItems, skippedCycles: state.skippedCycles,
        errors: state.errors, nextDelayMs: state.delayMs,
      }])) };
    },
  };
}
