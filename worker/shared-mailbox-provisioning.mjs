import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { accountLocalPart, decryptMailboxPassword, isStalwartAppPassword, stalwartCall } from "./stalwart-provisioning.mjs";
import { MAIL_IMPORT_PERMISSIONS } from "./mail-import-permissions.mjs";

const fail = code => { throw Object.assign(new Error(code), { code }); };
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;

export function sharedMailboxMarker(config, mailbox) {
  const key = Buffer.from(config.credentialKey || "", "base64");
  if (key.length !== 32 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(mailbox.id || ""))
    fail("MAILBOX_CREDENTIAL_INVALID");
  return `[gbt-shared:${mailbox.id}:${createHmac("sha256", key).update(`shared-mailbox:v1:${mailbox.id}:${mailbox.address}`).digest("base64url")}]`;
}

export function encryptSharedMailboxPassword(secret, base64Key) {
  const key = Buffer.from(base64Key || "", "base64");
  if (key.length !== 32 || !isStalwartAppPassword(secret)) fail("MAILBOX_CREDENTIAL_INVALID");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Never install a primary password or modify staff/external/legacy mailbox accounts. */
export async function provisionSharedMailbox(config, mailbox, beforeWrite, call = stalwartCall) {
  if (!mailbox.provisioning_app_password || mailbox.mailbox_type !== "shared" || mailbox.provisioning_create_only
    || !mailbox.provisioning_token) fail("SHARED_MAIL_JOB_INVALID");
  const providerCall = call;
  call = async (...args) => {
    try { return await providerCall(...args); }
    catch (error) {
      if (["STALWART_FORBIDDEN", "STALWART_HTTP_403"].includes(error?.code)) fail("STALWART_SHARED_PERMISSIONS_REQUIRED");
      throw error;
    }
  };
  const marker = sharedMailboxMarker(config, mailbox);
  const localPart = accountLocalPart(mailbox.address);
  const query = await call(config, "x:Account/query", { filter: { name: localPart, domainId: config.domainId }, limit: 2 }, "query");
  if (!Array.isArray(query.ids) || query.ids.length > 1) fail("STALWART_DUPLICATE_ACCOUNT");
  let accountId = mailbox.mail_server_account_id || query.ids[0];
  if (mailbox.mail_server_account_id && query.ids[0] !== mailbox.mail_server_account_id) fail("STALWART_ACCOUNT_MISMATCH");
  if (!accountId && !mailbox.active) return { accountId: null };
  if (!accountId) {
    await beforeWrite();
    const result = await call(config, "x:Account/set", { create: { mailbox: {
      "@type": "User", name: localPart, domainId: config.domainId, credentials: {}, memberGroupIds: {},
      roles: { "@type": "User" }, permissions: { "@type": "Inherit" }, quotas: {}, aliases: {},
      description: `${String(mailbox.display_name || "").slice(0, 70)} ${marker}`, locale: "en-US",
      encryptionAtRest: { "@type": "Disabled" },
    } } }, "create-shared");
    if (result.notCreated?.mailbox) fail("STALWART_SHARED_ACCOUNT_REJECTED");
    accountId = result.created?.mailbox?.id;
  }
  if (!idPattern.test(accountId || "")) fail("STALWART_ACCOUNT_ID_MISSING");
  const snapshot = await call(config, "x:Account/get", { ids: [accountId],
    properties: ["id", "@type", "name", "domainId", "roles", "permissions", "memberGroupIds", "description", "credentials"] }, "verify-shared");
  const account = snapshot.list?.find(item => item.id === accountId);
  if (!account || account["@type"] !== "User" || account.name !== localPart || account.domainId !== config.domainId
    || account.roles?.["@type"] !== "User" || account.permissions?.["@type"] !== "Inherit"
    || !account.memberGroupIds || Object.keys(account.memberGroupIds).length
    || !account.description?.endsWith(` ${marker}`)) fail("STALWART_SHARED_ACCOUNT_MISMATCH");
  const credentials = account.credentials;
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) fail("STALWART_CREDENTIAL_LAYOUT_INVALID");
  if (!mailbox.active) {
    await beforeWrite();
    const result = await call(config, "x:Account/set", { update: { [accountId]: { credentials: {} } } }, "disable-shared");
    if (!Object.hasOwn(result.updated || {}, accountId) || result.notUpdated?.[accountId]) fail("STALWART_UPDATE_NOT_CONFIRMED");
    return { accountId };
  }
  const description = `GlobeTrotr shared IMAP ${marker}`;
  // Account.credentials uses list indices, not credential IDs. Fetch the
  // account-scoped AppPassword objects to obtain their actual stable IDs.
  const listing = await call(config, "x:AppPassword/get", { accountId, properties: ["id", "description", "permissions"] }, "list-shared-importers");
  if (listing.accountId !== accountId || !Array.isArray(listing.list) || listing.list.length > 100)
    fail("STALWART_CREDENTIAL_ACCOUNT_MISMATCH");
  const owned = listing.list.filter(value => value.description === description && idPattern.test(value.id || ""));
  const saved = owned.find(value => value.id === mailbox.managed_import_credential_id);
  if (saved && mailbox.imap_password_ciphertext) {
    const permissions = saved.permissions;
    if (permissions?.["@type"] !== "Replace" || !permissions.permissions
      || Object.keys(permissions.permissions).length !== MAIL_IMPORT_PERMISSIONS.length
      || MAIL_IMPORT_PERMISSIONS.some(permission => permissions.permissions[permission] !== true))
      fail("STALWART_CREDENTIAL_PERMISSIONS_MISMATCH");
    const secret = decryptMailboxPassword(mailbox.imap_password_ciphertext, config.credentialKey);
    if (!isStalwartAppPassword(secret)) fail("MAILBOX_CREDENTIAL_INVALID");
    return { accountId, credentialId: saved.id, ciphertext: mailbox.imap_password_ciphertext };
  }
  // An interrupted response can lose a newly generated secret. Revoke only
  // this mailbox's signed, importer-owned orphan keys before trying again.
  async function credentialCall(args, callId) {
    await beforeWrite();
    const result = await call(config, "x:AppPassword/set", { accountId, ...args }, callId);
    if (result.accountId !== accountId) fail("STALWART_CREDENTIAL_ACCOUNT_MISMATCH");
    return result;
  }
  if (owned.length) {
    const ids = owned.map(value => value.id);
    const result = await credentialCall({ destroy: ids }, "cleanup-shared-orphans");
    if (ids.some(id => !result.destroyed?.includes(id))) fail("STALWART_CREDENTIAL_CLEANUP_FAILED");
  }
  const result = await credentialCall({ create: { importer: { description, allowedIps: {},
    permissions: { "@type": "Replace", permissions: Object.fromEntries(MAIL_IMPORT_PERMISSIONS.map(permission => [permission, true])) },
  } } }, "create-shared-importer");
  const credential = result.created?.importer;
  if (result.notCreated?.importer || !idPattern.test(credential?.id || "") || !isStalwartAppPassword(credential?.secret))
    fail("STALWART_CREDENTIAL_CREATE_FAILED");
  return { accountId, credentialId: credential.id, ciphertext: encryptSharedMailboxPassword(credential.secret, config.credentialKey) };
}
