// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

/** Never serialize exception messages, stacks, causes or arbitrary objects to stdout. */
export function describeError(error: unknown): string {
  let status: unknown;
  if (error instanceof Error) {
    const descriptor = Object.getOwnPropertyDescriptor(error, "status") ??
      Object.getOwnPropertyDescriptor(error, "statusCode");
    status = descriptor?.value;
  }
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599
    ? `APP_UNHANDLED_ERROR (status ${status})` : "APP_UNHANDLED_ERROR";
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// Wrap console.error so errors logged by any layer — including h3's internal
// unhandled-error logging, which this file cannot hook directly — are both
// recorded for consumeLastCapturedError and reduced to a fixed event before logging.
function safeLogArgument(value: unknown): string {
  if (value instanceof Error) return describeError(value);
  if (typeof value === "string") {
    try {
      const event = JSON.parse(value) as { event?: unknown; code?: unknown };
      if (typeof event.event === "string" && /^[a-z0-9_.-]{1,100}$/.test(event.event)) {
        return JSON.stringify({ event: event.event, ...(typeof event.code === "string" && /^[A-Z0-9_]{1,80}$/.test(event.code) ? { code: event.code } : {}) });
      }
    } catch { /* Unstructured context is not a diagnostic allowlist. */ }
  }
  return "APP_LOG_CONTEXT_REDACTED";
}
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const expanded = args.map((arg) => {
    if (isErrorLike(arg)) record(arg);
    return safeLogArgument(arg);
  });
  originalConsoleError(...expanded);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
