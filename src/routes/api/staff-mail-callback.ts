import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import {
  MAIL_SETUP_COOKIE,
  MAIL_SETUP_CALLBACK,
  MAIL_SETUP_CLIENT,
  setupJson,
  verifyMailSetupToken,
  createMailImportCredential,
} from "@/lib/staff-mail-setup.server";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto.server";
import { STAFF_COOKIE, verifyStaffSession } from "@/lib/staff-session.server";
import { mailSetupDiagnostic, type MailSetupPhase } from "@/lib/staff-mail-setup-diagnostics";

export const Route = createFileRoute("/api/staff-mail-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
        let pending: any,
          phase: MailSetupPhase = "configuration",
          validated = false,
          credential: Awaited<ReturnType<typeof createMailImportCredential>> | undefined;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        try {
          if (
            process.env.STAFF_AUTOMATION_ENABLED !== "true" ||
            process.env.STAFF_MAIL_SETUP_ENABLED !== "true"
          )
            throw new Error("DISABLED");
          const url = new URL(request.url);
          if (
            (request.headers.get("host") || url.host) !== "portal.globetrotr.nl" ||
            (url.protocol !== "https:" && request.headers.get("x-forwarded-proto") !== "https")
          )
            throw new Error("INVALID_ORIGIN");
          phase = "state";
          const cookie = getCookie(MAIL_SETUP_COOKIE);
          if (!cookie || cookie.length > 5000) throw new Error("MISSING_STATE");
          pending = JSON.parse(decryptSecret(cookie));
          if (
            !Number.isFinite(pending.expires) ||
            pending.expires <= Date.now() ||
            pending.expires > Date.now() + 10 * 60_000 ||
            url.searchParams.get("state") !== pending.state ||
            !verifyStaffSession(
              getCookie(STAFF_COOKIE),
              pending.userId,
              pending.sessionId,
              process.env.STAFF_SESSION_SIGNING_KEY || "",
            )
          )
            throw new Error("INVALID_STATE");
          validated = true;
          deleteCookie(MAIL_SETUP_COOKIE, { path: "/", secure: true });
          const code = url.searchParams.get("code");
          if (url.searchParams.has("error") || !code || code.length > 2048)
            throw new Error("INVALID_CODE");
          phase = "challenge";
          const claim = await db.rpc("claim_staff_mail_setup", {
            p_user: pending.userId,
            p_session: pending.sessionId,
            p_token: pending.state,
          });
          if (claim.error || !claim.data) throw new Error("STALE_CHALLENGE");
          phase = "token";
          const tokens = await setupJson("https://sso.globetrotr.nl/application/o/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: MAIL_SETUP_CLIENT,
              redirect_uri: MAIL_SETUP_CALLBACK,
              code,
              code_verifier: pending.verifier,
            }).toString(),
          });
          phase = "identity";
          await verifyMailSetupToken(tokens.id_token, {
            nonce: pending.nonce,
            userId: pending.userId,
            userPk: claim.data.userPk,
            username: claim.data.username,
          });
          credential = await createMailImportCredential(tokens.access_token, {
            accountId: claim.data.accountId,
            address: claim.data.address,
          }, fetch, (current) => { phase = current; });
          phase = "save";
          const finish = await db.rpc("finish_staff_mail_setup", {
            p_user: pending.userId,
            p_session: pending.sessionId,
            p_token: pending.state,
            p_credential: credential.id,
            p_ciphertext: encryptSecret(credential.secret),
          });
          if (finish.error) throw new Error("SAVE_FAILED");
          return new Response(null, {
            status: 303,
            headers: { ...headers, Location: "/team-setup?mail=ready" },
          });
        } catch (error) {
          const diagnostic = mailSetupDiagnostic(phase, error);
          console.warn("staff.mail_setup_failed", JSON.stringify(diagnostic));
          if (credential) {
            try {
              await credential.revoke();
            } catch {
              /* Failed setup RPC requeues offboarding if necessary. */
            }
          }
          if (validated && pending?.userId && pending?.state) {
            try {
              await db.rpc("fail_staff_mail_setup", {
                p_user: pending.userId,
                p_token: pending.state,
              });
            } catch {
              /* Challenge expires; no secret or provider body is logged. */
            }
          }
          return new Response(null, {
            status: 303,
            headers: { ...headers, Location: `/team-setup?mail=failed&phase=${diagnostic.phase}` },
          });
        }
      },
    },
  },
});
