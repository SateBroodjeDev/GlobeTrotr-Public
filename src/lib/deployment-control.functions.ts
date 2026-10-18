import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEPLOYMENT_NODES,
  deploymentEndpoint,
  deploymentAccess,
  deploymentAuditOutcome,
  validateDeploymentRequest,
  type DeploymentNode,
  type DeploymentRequest,
  type DeploymentAction,
} from "./deployment-control";

async function serverDatabase(userId: string, action?: DeploymentAction) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [user, admin] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from("platform_admins")
      .select("role,active,permissions")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (
    user.error ||
    admin.error ||
    !deploymentAccess(
      user.data?.user?.app_metadata?.corporate_admin,
      admin.data?.role,
      admin.data?.active,
      admin.data?.permissions,
      action,
    )
  )
    throw new Error("FORBIDDEN");
  return db;
}

async function agent(
  node: DeploymentNode,
  method: "GET" | "POST",
  value?: Record<string, unknown>,
) {
  const prefix = node === "node-01" ? "DEPLOY_NODE_01" : "DEPLOY_NODE_02";
  const url = deploymentEndpoint(node, process.env[`${prefix}_URL`]);
  const secret = process.env[`${prefix}_SECRET`];
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error("DEPLOYMENT_AGENT_NOT_CONFIGURED");
  const path = method === "GET" ? "/status" : "/actions";
  const body = value ? JSON.stringify(value) : "";
  const { createHash, createHmac, randomBytes } = await import("node:crypto");
  const stamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", secret)
    .update(
      [method, path, stamp, nonce, createHash("sha256").update(body).digest("hex")].join("\n"),
    )
    .digest("hex");
  const response = await fetch(url + path, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(25000),
    headers: {
      "Content-Type": "application/json",
      "X-Deploy-Time": stamp,
      "X-Deploy-Nonce": nonce,
      "X-Deploy-Signature": signature,
    },
    ...(method === "POST" ? { body } : {}),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409 ? "DEPLOYMENT_BUSY_OR_BLOCKED" : "DEPLOYMENT_AGENT_UNAVAILABLE",
    );
  return response.json();
}

export const getDeploymentControl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await serverDatabase(context.userId);
    return Promise.all(
      DEPLOYMENT_NODES.map(async (node) => {
        try {
          const status = await agent(node, "GET");
          // Record only outcomes observed from the signed agent, preserving the original request.
          const pending = await db
            .from("platform_admin_audit_log")
            .select("id,actor_user_id,details")
            .eq("target_type", "infrastructure")
            .contains("details", { node, phase: "queued" })
            .limit(100);
          for (const entry of pending.data ?? []) {
            const outcome = deploymentAuditOutcome(entry, status.jobs ?? []);
            if (!outcome) continue;
            await db.from("platform_admin_audit_log").update(outcome).eq("id", entry.id);
          }
          return { node, connected: true, status };
        } catch (error) {
          return {
            node,
            connected: false,
            status: null,
            error:
              error instanceof Error && error.message === "DEPLOYMENT_AGENT_NOT_CONFIGURED"
                ? "NOT_CONFIGURED"
                : "UNAVAILABLE",
          };
        }
      }),
    );
  });

export const requestDeploymentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateDeploymentRequest)
  .handler(async ({ data, context }: { data: DeploymentRequest; context: { userId: string } }) => {
    const db = await serverDatabase(context.userId, data.action);
    // Durable audit precedes privileged submission. Failed audit must prevent server actions.
    const audit = await db
      .from("platform_admin_audit_log")
      .insert({
        actor_user_id: context.userId,
        action: `platform.deployment.${data.action}.requested`,
        target_type: "infrastructure",
        target_id: null,
        result: "success",
        details: {
          node: data.node,
          commit: data.commit || null,
          confirmed: data.confirmed === true,
          service: data.service || null,
          phase: "requested",
        },
      })
      .select("id")
      .single();
    if (audit.error) throw new Error("DEPLOYMENT_AUDIT_FAILED");
    try {
      if (data.node === "node-01" && data.action === "booking-enable") {
        const importer = await agent("node-02", "GET");
        if (importer.bookingEnabledRuntime !== true) throw new Error("ENABLE_NODE_02_FIRST");
      }
      const job = await agent(data.node, "POST", {
        action: data.action,
        commit: data.commit,
        confirmed: data.confirmed,
        actor: context.userId,
        service: data.service,
      });
      await db
        .from("platform_admin_audit_log")
        .update({
          details: {
            node: data.node,
            commit: data.commit || null,
            service: data.service || null,
            confirmed: data.confirmed === true,
            phase: "queued",
            jobId: job.id,
          },
        })
        .eq("id", audit.data.id);
      return { ok: true, jobId: job.id };
    } catch {
      await db
        .from("platform_admin_audit_log")
        .update({
          result: "failure",
          details: {
            node: data.node,
            commit: data.commit || null,
            service: data.service || null,
            phase: "rejected",
          },
        })
        .eq("id", audit.data.id);
      throw new Error("DEPLOYMENT_REQUEST_FAILED");
    }
  });
