import { createDiagnosticSampler, diagnoseAction, diagnosticRelease, type DiagnosticCode, type DiagnosticOperation } from "./application-diagnostics";

const sample = createDiagnosticSampler();
let nextUnavailableLog = 0;
async function record(operation: DiagnosticOperation, code: DiagnosticCode) {
  if (!sample(operation, code)) return;
  // No preview build may import this module or inherit its production credentials.
  if (process.env.PREVIEW_DATA_MODE || process.env.PREVIEW_COMMIT) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("record_application_diagnostic", {
      p_operation: operation, p_code: code,
      p_release: diagnosticRelease(process.env.GLOBETROTR_RELEASE_COMMIT),
    }).abortSignal(AbortSignal.timeout(800));
    if (error) throw new Error("DIAGNOSTICS_WRITE_UNAVAILABLE");
  } catch {
    if (Date.now() >= nextUnavailableLog) {
      nextUnavailableLog = Date.now() + 300_000;
      console.warn(JSON.stringify({ event: "application.diagnostics_unavailable", code: "DIAGNOSTICS_WRITE_UNAVAILABLE" }));
    }
  }
}

export function withApplicationDiagnostics<T>(operation: DiagnosticOperation, action: () => Promise<T>) {
  return diagnoseAction(operation, action, code => record(operation, code));
}
