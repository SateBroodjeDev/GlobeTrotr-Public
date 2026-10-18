// Viewing edition: documentation-only node addresses.
export const DEPLOYMENT_NODES = ["node-01", "node-02"] as const;
export const DEPLOYMENT_ACTIONS = [
  "refresh",
  "deploy",
  "rollback",
  "restart",
  "confirm-sql",
  "approve-infrastructure",
  "booking-check",
  "booking-enable",
  "service-check",
  "service-start",
  "service-restart",
  "reboot",
  "pause-auto",
  "resume-auto",
  "backup-now",
] as const;
export type DeploymentAction = (typeof DEPLOYMENT_ACTIONS)[number];
export type DeploymentNode = (typeof DEPLOYMENT_NODES)[number];
export const NODE_SERVICES = {
  "node-01": ["web", "caddy"],
  "node-02": ["worker", "mail-relay", "imap-sync", "translation", "stalwart", "clamav"],
} as const;
export type DeploymentRequest = {
  node: DeploymentNode;
  action: DeploymentAction;
  commit?: string;
  confirmed?: boolean;
  service?: string;
};

export function deploymentSqlReview(release: {
  requiresSql?: unknown;
  sqlConfirmed?: unknown;
  sqlFiles?: unknown;
  releaseReady?: unknown;
  ci?: unknown;
  ciRequired?: unknown;
  tip?: unknown;
}) {
  const inventoryKnown = Array.isArray(release.sqlFiles) &&
    release.sqlFiles.every((file) => typeof file === "string" && file.trim().length > 0);
  const files: string[] = inventoryKnown ? release.sqlFiles as string[] : [];
  const mode = release.requiresSql === false ? "none" :
    release.requiresSql !== true || !inventoryKnown ? "unknown" :
      files.length ? "changed" : "existing";
  // Review intermediate commits, but acknowledge only the final, checked hash.
  const canConfirm = mode !== "none" && mode !== "unknown" &&
    release.sqlConfirmed !== true && release.releaseReady === true && (release.ciRequired === false || release.ci === true) &&
    typeof release.tip === "string" && /^[a-f0-9]{40}$/.test(release.tip);
  return { mode, files, canConfirm };
}

export function validateDeploymentRequest(value: DeploymentRequest): DeploymentRequest {
  if (
    !value ||
    !DEPLOYMENT_NODES.includes(value.node) ||
    !DEPLOYMENT_ACTIONS.includes(value.action)
  )
    throw new Error("INVALID_DEPLOYMENT_ACTION");
  if (
    ["deploy", "confirm-sql", "approve-infrastructure"].includes(value.action) &&
    !/^[a-f0-9]{40}$/.test(value.commit || "")
  )
    throw new Error("INVALID_RELEASE_COMMIT");
  if (
    [
      "confirm-sql",
      "approve-infrastructure",
      "booking-enable",
      "reboot",
      "service-start",
      "service-restart",
      "resume-auto",
    ].includes(value.action) &&
    value.confirmed !== true
  )
    throw new Error("CONFIRMATION_REQUIRED");
  if (
    value.action.startsWith("service-") &&
    !(NODE_SERVICES[value.node] as readonly string[]).includes(value.service || "")
  )
    throw new Error("INVALID_NODE_SERVICE");
  if (value.action === "backup-now" && value.node !== "node-02")
    throw new Error("INVALID_NODE_ACTION");
  return {
    node: value.node,
    action: value.action,
    commit: value.commit,
    confirmed: value.confirmed,
    service: value.action.startsWith("service-") ? value.service : undefined,
  };
}
export function deploymentEndpoint(node: DeploymentNode, configured: string | undefined) {
  const expected = node === "node-01" ? "http://192.0.2.2:9093" : "http://192.0.2.3:9093";
  if (configured !== expected) throw new Error("DEPLOYMENT_AGENT_NOT_CONFIGURED");
  return expected;
}
export const deploymentOwner = (metadata: unknown, role: unknown, active: unknown) =>
  metadata === true && role === "owner" && active === true;
export function deploymentAccess(
  metadata: unknown,
  role: unknown,
  active: unknown,
  _permissions: unknown,
  _action?: DeploymentAction,
) {
  return deploymentOwner(metadata, role, active);
}

export function deploymentAuditOutcome(
  entry: { actor_user_id: string; details: Record<string, unknown> },
  jobs: Array<{ id: string; actor: string; status: string; result?: unknown; finishedAt?: string }>,
): { result: "success" | "failure"; details: Record<string, unknown> } | null {
  const job = jobs.find(
    (item) => item.id === entry.details.jobId && item.actor === entry.actor_user_id,
  );
  if (!job || !["completed", "failed", "interrupted"].includes(job.status)) return null;
  return {
    result: job.status === "completed" ? "success" : "failure",
    details: {
      ...entry.details,
      phase: job.status,
      outcome: typeof job.result === "string" ? job.result : null,
      finishedAt: job.finishedAt ?? null,
    },
  };
}
