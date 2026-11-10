/** Deliberately excludes messages, stack traces, URLs, account and trip data. */
export const DIAGNOSTIC_CODES = {
  "friendship.change": ["FRIEND_LOOKUP_FAILED", "FRIEND_REQUEST_FAILED", "FRIEND_ACCEPT_FAILED", "FRIEND_REMOVE_FAILED", "FRIEND_ACTION_UNAVAILABLE"],
  "trip.save": ["TRIP_LOOKUP_FAILED", "TRIP_SAVE_FAILED", "TRIP_SAVE_SCHEMA_MISSING", "TRIP_SAVE_UNCONFIRMED", "TRIP_SAVE_UNAVAILABLE"],
} as const;
export type DiagnosticOperation = keyof typeof DIAGNOSTIC_CODES;
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[DiagnosticOperation][number];
export type DiagnosticReport = { operation: DiagnosticOperation; code: DiagnosticCode; release: string };

export function diagnosticRelease(value: unknown): string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value) ? value : "unknown";
}

export function tripSaveDiagnosticCode(databaseCode: unknown): DiagnosticCode | undefined {
  if (typeof databaseCode === "string" && ["PT409", "PT403", "42501", "PT400", "22023"].includes(databaseCode)) return undefined;
  return databaseCode === "PGRST202" ? "TRIP_SAVE_SCHEMA_MISSING" : "TRIP_SAVE_FAILED";
}

export function diagnosticFailure(operation: DiagnosticOperation, error: unknown): DiagnosticCode | null {
  if (!(error instanceof Error)) return null;
  const known = DIAGNOSTIC_CODES[operation].find(code => code === error.message || code === error.cause);
  if (known) return known;
  // Network/runtime failures have no useful safe message. Never copy their contents.
  if (error instanceof TypeError) return operation === "trip.save" ? "TRIP_SAVE_UNAVAILABLE" : "FRIEND_ACTION_UNAVAILABLE";
  return null; // Validation, permission denials and revision conflicts are not outages.
}

/** One sample per code per 30 seconds/process; fixed keys keep memory bounded. */
export function createDiagnosticSampler(now: () => number = Date.now) {
  const last = new Map<string, number>();
  return (operation: DiagnosticOperation, code: DiagnosticCode) => {
    if (!(DIAGNOSTIC_CODES[operation] as readonly string[]).includes(code)) return false;
    const key = `${operation}:${code}`, time = now(), previous = last.get(key);
    if (previous !== undefined && time - previous < 30_000) return false;
    last.set(key, time);
    return true;
  };
}

/** Reporting must never replace a result, error identity or original stack. */
export async function diagnoseAction<T>(operation: DiagnosticOperation, action: () => Promise<T>, report: (code: DiagnosticCode) => Promise<void>): Promise<T> {
  try { return await action(); }
  catch (error) {
    const code = diagnosticFailure(operation, error);
    if (code) { try { await report(code); } catch { /* Best effort only. */ } }
    throw error;
  }
}
