import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { MailSetupPhase } from "./staff-mail-setup-diagnostics";

export const MAIL_SETUP_CALLBACK = "https://portal.globetrotr.nl/api/staff-mail-callback";
export const MAIL_SETUP_ISSUER = "https://sso.globetrotr.nl/application/o/globetrotr-mail/";
export const MAIL_SETUP_CLIENT = "stalwart-webui";
export const MAIL_SETUP_COOKIE = "__Host-gbt-mail-setup";
const fail = (code: string): never => {
  throw new Error(code);
};

// The token belongs to the employee, not an administrator or impersonation key.
export function mailSetupAuthorization(state: string) {
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const url = new URL("https://sso.globetrotr.nl/application/o/authorize/");
  url.search = new URLSearchParams({
    client_id: MAIL_SETUP_CLIENT,
    redirect_uri: MAIL_SETUP_CALLBACK,
    response_type: "code",
    scope: "openid email profile globetrotr_mail_setup",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), verifier, nonce };
}

export async function setupJson(url: string, init: RequestInit, fetcher = fetch) {
  const response = await fetcher(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Object.assign(new Error("STAFF_MAIL_PROVIDER_FAILED"), { providerStatus: response.status });
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("STAFF_MAIL_RESPONSE_INVALID");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 512 * 1024) fail("STAFF_MAIL_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return fail("STAFF_MAIL_RESPONSE_INVALID");
  }
}

// Session discovery redirects in Stalwart 0.16. Keep the employee bearer token
// on this exact HTTPS origin and never follow redirects for credential writes.
function sessionFetcher(fetcher: typeof fetch): typeof fetch {
  return async (url, init) => {
    let current = new URL(String(url));
    const visited = new Set([current.href]);
    for (let hop = 0; ; hop++) {
      const response = await fetcher(current.href, { ...init, redirect: "manual" });
      if (![307, 308].includes(response.status)) return response;
      const location = response.headers.get("location");
      await response.body?.cancel();
      let next: URL;
      try {
        if (!location) return fail("STAFF_MAIL_SESSION_REDIRECT_REJECTED");
        next = new URL(location, current);
      } catch {
        return fail("STAFF_MAIL_SESSION_REDIRECT_REJECTED");
      }
      if (hop >= 2 || next.origin !== "https://mail.globetrotr.nl" ||
        next.username || next.password || next.search || next.hash ||
        !["/jmap/session", "/jmap/session/"].includes(next.pathname) || visited.has(next.href)) {
        return fail("STAFF_MAIL_SESSION_REDIRECT_REJECTED");
      }
      visited.add(next.href);
      current = next;
    }
  };
}

export async function verifyMailSetupToken(
  token: string,
  expected: { nonce: string; userId: string; userPk: number; username: string },
  fetcher = fetch,
  now = Date.now(),
) {
  if (typeof token !== "string" || token.length > 16000) fail("STAFF_MAIL_IDENTITY_INVALID");
  const parts = token.split(".");
  if (parts.length !== 3) fail("STAFF_MAIL_IDENTITY_INVALID");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return fail("STAFF_MAIL_IDENTITY_INVALID");
  }
  if (
    !header || typeof header!=="object" || !claims || typeof claims!=="object" ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    claims.iss !== MAIL_SETUP_ISSUER ||
    !(
      claims.aud === MAIL_SETUP_CLIENT ||
      (Array.isArray(claims.aud) && claims.aud.includes(MAIL_SETUP_CLIENT))
    ) ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.nonce !== expected.nonce ||
    claims.globetrotr_user_pk !== expected.userPk ||
    claims.globetrotr_managed_user_id !== expected.userId ||
    claims.preferred_username !== expected.username ||
    !Number.isFinite(claims.exp) ||
    claims.exp * 1000 <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat * 1000 > now + 30000 ||
    now - claims.iat * 1000 > 5 * 60_000 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf * 1000 > now + 30000))
  )
    fail("STAFF_MAIL_IDENTITY_INVALID");
  const jwks = await setupJson(`${MAIL_SETUP_ISSUER}jwks/`, {}, fetcher);
  const keys = Array.isArray(jwks.keys)
    ? jwks.keys.filter(
        (key: any) =>
          key.kid === header.kid &&
          key.kty === "RSA" &&
          (!key.use || key.use === "sig") &&
          (!key.alg || key.alg === "RS256"),
      )
    : [];
  if (
    keys.length !== 1 ||
    !verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: keys[0], format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    fail("STAFF_MAIL_IDENTITY_INVALID");
  return claims;
}

// Limited to the IMAP importer and existing audited mail-cleanup jobs for this
// own mailbox. No SMTP, account administration or inherited future privileges.
export const MAIL_IMPORT_PERMISSIONS = [
  "authenticate",
  "imapAuthenticate",
  "imapList",
  "imapLsub",
  "imapStatus",
  "imapSelect",
  "imapExamine",
  "imapSearch",
  "imapFetch",
  "imapStore",
  "imapExpunge",
  "imapIdle",
  "imapNamespace",
  "imapId",
  "imapCapability",
  "imapEnable",
];

export async function createMailImportCredential(
  accessToken: string,
  expected: { accountId: string; address: string },
  fetcher = fetch,
  onPhase: (phase: MailSetupPhase) => void = () => {},
) {
  if (typeof accessToken !== "string" || !accessToken || accessToken.length > 16000)
    fail("STAFF_MAIL_IDENTITY_INVALID");
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  onPhase("mail_session");
  const session = await setupJson(
    "https://mail.globetrotr.nl/.well-known/jmap",
    { headers },
    sessionFetcher(fetcher),
  );
  const apiUrl = new URL(String(session.apiUrl || ""));
  if (
    apiUrl.origin !== "https://mail.globetrotr.nl" ||
    !["/jmap", "/jmap/", "/api"].includes(apiUrl.pathname) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    session.primaryAccounts?.["urn:ietf:params:jmap:mail"] !== expected.accountId ||
    !session.accounts?.[expected.accountId] ||
    session.accounts[expected.accountId].isReadOnly === true ||
    ![expected.address, expected.address.split("@")[0]].includes(session.username)
  )
    fail("STAFF_MAIL_ACCOUNT_MISMATCH");
  async function call(arguments_: unknown) {
    const result = await setupJson(
      apiUrl.toString(),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
          methodCalls: [
            [
              "x:AppPassword/set",
              { accountId: expected.accountId, ...(arguments_ as object) },
              "setup",
            ],
          ],
        }),
      },
      fetcher,
    );
    const [name, body, id] = result.methodResponses?.[0] || [];
    if (name !== "x:AppPassword/set" || id !== "setup" || body.accountId !== expected.accountId)
      fail("STAFF_MAIL_CREDENTIAL_FAILED");
    return body;
  }
  onPhase("mail_credential");
  const body = await call({
    create: {
      gbt: {
        description: "GlobeTrotr mailbox import and cleanup",
        allowedIps: {},
        permissions: {
          "@type": "Replace",
          permissions: Object.fromEntries(
            MAIL_IMPORT_PERMISSIONS.map((permission) => [permission, true]),
          ),
        },
      },
    },
  });
  const credential = body.created?.gbt;
  if (
    body.notCreated?.gbt ||
    !credential ||
    typeof credential.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(credential.id) ||
    !/^app_[a-zA-Z792013]{36}$/.test(credential.secret || "")
  )
    fail("STAFF_MAIL_CREDENTIAL_FAILED");
  return {
    secret: credential.secret as string,
    id: credential.id as string,
    revoke: async () => {
      const destroyed = await call({ destroy: [credential.id] });
      if (!destroyed.destroyed?.includes(credential.id))
        fail("STAFF_MAIL_CREDENTIAL_REVOKE_FAILED");
    },
  };
}
