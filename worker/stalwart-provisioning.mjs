import { createDecipheriv, createHmac } from "node:crypto";

const using = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"];

// v0.16.25: app_ + custom base32 encoding of a 4-byte ID and 18-byte secret.
// This recognizes the issued format, not validity or ownership of the secret.
export function isStalwartAppPassword(value) {
  return /^app_[a-zA-Z792013]{36}$/.test(String(value || ""));
}

export function accountLocalPart(address) {
  const match = String(address || "")
    .toLowerCase()
    .match(/^([a-z0-9][a-z0-9._-]*)@globetrotr\.nl$/);
  if (!match)
    throw Object.assign(new Error("MAIL_ADDRESS_INVALID"), { code: "MAIL_ADDRESS_INVALID" });
  return match[1];
}

export function accountProperties(mailbox, domainId, password) {
  return {
    "@type": "User",
    name: accountLocalPart(mailbox.address),
    domainId,
    credentials: mailbox.active && !mailbox.provisioning_create_only
      ? { 0: { "@type": "Password", secret: password } } : {},
    memberGroupIds: {},
    roles: { "@type": "User" },
    permissions: { "@type": "Inherit" },
    quotas: {},
    aliases: {},
    description: `${mailbox.display_name} · GlobeTrotr ${mailbox.mailbox_type}`.slice(0, 200),
    locale: "en-US",
    encryptionAtRest: { "@type": "Disabled" },
  };
}

export function decryptMailboxPassword(ciphertext, base64Key) {
  const key = Buffer.from(String(base64Key || ""), "base64");
  const [version, iv, tag, encrypted] = String(ciphertext || "").split(".");
  if (key.length !== 32 || version !== "v1" || !iv || !tag || !encrypted)
    throw Object.assign(new Error("MAILBOX_CREDENTIAL_INVALID"), {
      code: "MAILBOX_CREDENTIAL_INVALID",
    });
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function call(config, method, arguments_, callId) {
  const response = await fetch(stalwartJmapUrl(config.url), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ using, methodCalls: [[method, arguments_, callId]] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw Object.assign(new Error("STALWART_HTTP_ERROR"), {
      code: `STALWART_HTTP_${response.status}`,
    });
  const body = await response.json();
  const [name, result] = body.methodResponses?.[0] || [];
  if (name === "error" || !result)
    throw Object.assign(new Error("STALWART_API_ERROR"), {
      code: `STALWART_${String(result?.type || "INVALID_RESPONSE")
        .replace(/[^A-Z0-9_]/gi, "_")
        .toUpperCase()}`,
    });
  return result;
}

export function stalwartJmapUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/jmap`;
}

export async function provisionMailbox(config, mailbox, password, beforeWrite = async () => {}) {
  const appPassword = isStalwartAppPassword(password);
  if (String(password || "").startsWith("app_") && !appPassword)
    throw Object.assign(new Error("STALWART_APP_PASSWORD_INVALID"), {
      code: "STALWART_APP_PASSWORD_INVALID",
    });
  const localPart = accountLocalPart(mailbox.address);
  const query = await call(
    config,
    "x:Account/query",
    { filter: { name: localPart, domainId: config.domainId }, limit: 2 },
    "query",
  );
  if ((query.ids || []).length > 1)
    throw Object.assign(new Error("STALWART_DUPLICATE_ACCOUNT"), {
      code: "STALWART_DUPLICATE_ACCOUNT",
    });
  const properties = accountProperties(mailbox, config.domainId, password);
  const existingId = mailbox.mail_server_account_id || query.ids?.[0];
  if(!mailbox.active && !existingId) return null;
  let marker = "";
  if (mailbox.provisioning_create_only && (mailbox.active || !mailbox.mail_server_account_id)) {
    const key = Buffer.from(String(config.credentialKey || ""), "base64");
    if (
      key.length !== 32 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        mailbox.id || "",
      )
    )
      throw Object.assign(new Error("MAILBOX_CREDENTIAL_INVALID"), {
        code: "MAILBOX_CREDENTIAL_INVALID",
      });
    marker = `[gbt:${mailbox.id}:${createHmac("sha256", key).update(`mailbox:v1:${mailbox.id}:${mailbox.address}`).digest("base64url")}]`;
    properties.description = `${properties.description.slice(0, 100)} ${marker}`;
  }
  if (appPassword && !existingId)
    throw Object.assign(new Error("STALWART_APP_PASSWORD_EXISTING_ACCOUNT_REQUIRED"), {
      code: "STALWART_APP_PASSWORD_EXISTING_ACCOUNT_REQUIRED",
    });
  let change = { create: { mailbox: properties } };
  if (existingId) {
    const snapshot = await call(
      config,
      "x:Account/get",
      {
        ids: [existingId],
        properties: [
          "id",
          "@type",
          "name",
          "domainId",
          "roles",
          "credentials",
          "description",
          "permissions",
          "memberGroupIds",
        ],
      },
      "verify-update",
    );
    const account = snapshot.list?.find((item) => item.id === existingId);
    if (
      !account ||
      account["@type"] !== "User" ||
      account.name !== localPart ||
      account.domainId !== config.domainId
    )
      throw Object.assign(new Error("STALWART_ACCOUNT_MISMATCH"), {
        code: "STALWART_ACCOUNT_MISMATCH",
      });
    if (
      mailbox.provisioning_create_only &&
      (account.roles?.["@type"] !== "User" ||
        account.permissions?.["@type"] !== "Inherit" ||
        !account.memberGroupIds ||
        Object.keys(account.memberGroupIds).length)
    )
      throw Object.assign(new Error("STALWART_PRIVILEGED_ACCOUNT"), {
        code: "STALWART_PRIVILEGED_ACCOUNT",
      });
    if (
      mailbox.provisioning_create_only &&
      !mailbox.mail_server_account_id &&
      (account.roles?.["@type"] !== "User" ||
        account.permissions?.["@type"] !== "Inherit" ||
        !account.description?.endsWith(` ${marker}`) ||
        !account.memberGroupIds ||
        Object.keys(account.memberGroupIds).length ||
        !account.credentials ||
        Object.values(account.credentials).some((value) => value?.["@type"] !== "Password"))
    )
      throw Object.assign(new Error("STALWART_EXISTING_ACCOUNT_REQUIRES_MANUAL_LINK"), {
        code: "STALWART_EXISTING_ACCOUNT_REQUIRES_MANUAL_LINK",
      });
    // Preserve roles, groups, aliases, quotas, locale, encryption and all unrelated
    // credentials. A routine save must not reset an externally changed password.
    const patch = { description: properties.description };
    if (!mailbox.active) {
      if (account.roles?.["@type"] !== "User")
        throw Object.assign(new Error("STALWART_PRIVILEGED_ACCOUNT"), {
          code: "STALWART_PRIVILEGED_ACCOUNT",
        });
      // Explicit deactivation revokes credentials; preserving their access would
      // defeat offboarding. This is distinct from a normal mailbox update.
      patch.credentials = {};
    } else if (mailbox.provisioning_create_only) {
      // Managed staff authenticate through OIDC. External directories forbid
      // primary password creation, and reactivation must not restore one.
      // The employee creates the import app password in their own SSO setup.
    } else if (appPassword) {
      // The secret is for IMAP only. Never install it as a primary password or
      // recreate a revoked credential during reactivation. IMAP verifies it.
      if (
        !account.credentials ||
        typeof account.credentials !== "object" ||
        Array.isArray(account.credentials) ||
        !Object.values(account.credentials).some((value) => value?.["@type"] === "AppPassword")
      )
        throw Object.assign(new Error("STALWART_APP_PASSWORD_NOT_CONFIGURED"), {
          code: "STALWART_APP_PASSWORD_NOT_CONFIGURED",
        });
    } else {
      const credentials = account.credentials;
      if (!credentials || typeof credentials !== "object" || Array.isArray(credentials))
        throw Object.assign(new Error("STALWART_CREDENTIAL_LAYOUT_INVALID"), {
          code: "STALWART_CREDENTIAL_LAYOUT_INVALID",
        });
      const passwords = Object.entries(credentials).filter(
        ([, value]) => value?.["@type"] === "Password",
      );
      const requested = Date.parse(mailbox.credentials_updated_at || "");
      const applied = Date.parse(mailbox.provisioned_at || "");
      const rotate =
        Number.isFinite(requested) && (!Number.isFinite(applied) || requested > applied);
      if ((rotate || !Object.keys(credentials).length) && account.roles?.["@type"] !== "User")
        throw Object.assign(new Error("STALWART_PRIVILEGED_ACCOUNT"), {
          code: "STALWART_PRIVILEGED_ACCOUNT",
        });
      if (rotate && passwords.length > 1)
        throw Object.assign(new Error("STALWART_PASSWORD_AMBIGUOUS"), {
          code: "STALWART_PASSWORD_AMBIGUOUS",
        });
      if (rotate && passwords.length === 1) {
        const index = passwords[0][0];
        if (!/^\d+$/.test(index))
          throw Object.assign(new Error("STALWART_CREDENTIAL_LAYOUT_INVALID"), {
            code: "STALWART_CREDENTIAL_LAYOUT_INVALID",
          });
        patch[`credentials/${index}/secret`] = password;
      } else if (!Object.keys(credentials).length) {
        // Reactivating a previously disabled account restores only the app's
        // saved password, not previously revoked app passwords or API keys.
        patch["credentials/0"] = properties.credentials["0"];
      } else if (rotate) {
        throw Object.assign(new Error("STALWART_PASSWORD_NOT_MANAGED"), {
          code: "STALWART_PASSWORD_NOT_MANAGED",
        });
      }
    }
    // Stalwart 0.16.25 registry GET has no state, and registry SET does not
    // implement ifInState. Send narrow patches, not a stale account snapshot.
    // This API provides no client-side read-to-write concurrency guarantee.
    change = { update: { [existingId]: patch } };
  }
  await beforeWrite();
  const result = await call(config, "x:Account/set", change, "set");
  const failure = existingId ? result.notUpdated?.[existingId] : result.notCreated?.mailbox;
  if (failure)
    throw Object.assign(new Error("STALWART_ACCOUNT_REJECTED"), {
      code: `STALWART_${String(failure.type || "REJECTED")
        .replace(/[^A-Z0-9_]/gi, "_")
        .toUpperCase()}`,
    });
  if (existingId && !Object.hasOwn(result.updated || {}, existingId))
    throw Object.assign(new Error("STALWART_UPDATE_NOT_CONFIRMED"), {
      code: "STALWART_UPDATE_NOT_CONFIRMED",
    });
  const accountId = existingId || result.created?.mailbox?.id;
  if (!accountId)
    throw Object.assign(new Error("STALWART_ACCOUNT_ID_MISSING"), {
      code: "STALWART_ACCOUNT_ID_MISSING",
    });
  return accountId;
}

export async function checkStalwart(config) {
  const result = await call(
    config,
    "x:Account/query",
    { filter: { domainId: config.domainId }, limit: 1 },
    "health",
  );
  return Array.isArray(result.ids);
}

// Never rediscover a replacement account by address when retrying a deletion.
export async function destroyMailbox(config, mailbox) {
  const id = mailbox.mail_server_account_id;
  if (!id) throw new Error("MAILBOX_ACCOUNT_ID_REQUIRED");
  const result = await call(
    config,
    "x:Account/get",
    {
      ids: [id],
      properties: ["id", "@type", "name", "domainId", "roles"],
    },
    "verify-delete",
  );
  const account = result.list?.find((item) => item.id === id);
  if (!account && result.notFound?.includes(id)) return;
  if (
    !account ||
    account["@type"] !== "User" ||
    account.name !== accountLocalPart(mailbox.address) ||
    account.domainId !== config.domainId ||
    account.roles?.["@type"] !== "User"
  )
    throw new Error("STALWART_DELETE_ACCOUNT_MISMATCH");
  const removed = await call(config, "x:Account/set", { destroy: [id] }, "destroy");
  if (!removed.destroyed?.includes(id) && removed.notDestroyed?.[id]?.type !== "notFound")
    throw new Error("STALWART_DELETE_REJECTED");
}
