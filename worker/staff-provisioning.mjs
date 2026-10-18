// Fixed Authentik endpoints and group allowlist. No provider IDs from browsers.
export const STAFF_GROUP = "a52fb715-a38e-482c-8c12-b194f195419c";
export const MAIL_GROUP = "a0064c00-500e-462d-8a15-dba76f1e3910";
export const EMAIL_STAGE = "2ed2b6a7-7524-4875-8424-f49a50901be5";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const origin = "https://sso.globetrotr.nl/api/v3/";
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};

export function staffUsername(userId, mailboxAddress) {
  if (!UUID.test(userId)) fail("STAFF_USER_ID_INVALID");
  if (!mailboxAddress) return `gbt-${userId.replaceAll("-", "")}`;
  const match = mailboxAddress.match(/^([a-z0-9][a-z0-9._-]*)@globetrotr\.nl$/);
  if (!match) fail("STAFF_MAILBOX_INVALID");
  return match[1];
}

export function validateManagedIdentity(user, job) {
  if (
    !user ||
    !Number.isSafeInteger(user.pk) ||
    user.pk < 1 ||
    !UUID.test(user.uuid || "") ||
    user.username !== job.username ||
    user.type !== "internal" ||
    user.attributes?.globetrotr_managed_user_id !== job.user_id ||
    !UUID.test(job.creation_nonce || "") ||
    user.attributes?.globetrotr_creation_nonce !== job.creation_nonce ||
    (job.authentik_user_pk && user.pk !== job.authentik_user_pk) ||
    (job.authentik_user_uuid && user.uuid !== job.authentik_user_uuid)
  )
    fail("STAFF_IDENTITY_MISMATCH");
  if (
    user.is_superuser !== false ||
    !Array.isArray(user.roles) ||
    user.roles.length ||
    !Array.isArray(user.groups) ||
    user.groups.some((id) => ![STAFF_GROUP, MAIL_GROUP].includes(id))
  )
    fail("STAFF_PRIVILEGED_IDENTITY");
  return user;
}

export function createStaffProvisioner(token, fetcher = fetch, options = {}) {
  if (typeof token !== "string" || !token.trim()) fail("STAFF_PROVIDER_CONFIGURATION_REQUIRED");
  async function api(method, path, body) {
    const response = await fetcher(origin + path, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      fail(`STAFF_PROVIDER_HTTP_${response.status}`);
    }
    if (response.status === 204) return null;
    const reader = response.body?.getReader();
    if (!reader) fail("STAFF_PROVIDER_RESPONSE_INVALID");
    const chunks = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 512 * 1024) fail("STAFF_PROVIDER_RESPONSE_TOO_LARGE");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      return JSON.parse(raw);
    } catch {
      fail("STAFF_PROVIDER_RESPONSE_INVALID");
    }
  }
  return {
    async verifyApplications() {
      if (!options.checkApplications) return;
      for (const [slug, launch] of [
        ["globetrotr-staff", "https://portal.globetrotr.nl/team-login?redirect=/team-setup"],
        ["globetrotr-mail", "https://portal.globetrotr.nl/corporate-admin/mail"],
      ]) {
        const app = await api("GET", `core/applications/${slug}/`);
        if (
          app.slug !== slug ||
          app.policy_engine_mode !== "all" ||
          app.meta_launch_url !== launch ||
          !app.provider || app.meta_hide===true
        )
          fail("STAFF_APPLICATION_CONFIGURATION_REQUIRED");
      }
    },
    async verifyService() {
      const identity = await api("GET", "core/users/me/");
      const user = identity?.user || identity;
      if (
        user?.username !== "globetrotr-team-provisioning." ||
        user?.type !== "service_account" ||
        user.is_superuser !== false
      )
        fail("STAFF_WRONG_SERVICE_ACCOUNT");
    },
    async verifyGroups() {
      for (const [id, name] of [
        [STAFF_GROUP, "globetrotr-staff"],
        [MAIL_GROUP, "globetrotr-mail-users"],
      ]) {
        const group = await api("GET", `core/groups/${id}/?include_users=false`);
        if (
          group?.name !== name ||
          group.is_superuser !== false ||
          !Array.isArray(group.parents) ||
          group.parents.length ||
          !Array.isArray(group.roles) ||
          group.roles.length
        )
          fail("STAFF_GROUP_CONFIGURATION_CHANGED");
      }
    },
    async ensureIdentity(job, beforeWrite) {
      if (
        !UUID.test(job.user_id) ||
        (job.active && staffUsername(job.user_id, job.mailbox_address) !== job.username)
      )
        fail("STAFF_USERNAME_CHANGED");
      if (job.authentik_user_pk) {
        if (!Number.isSafeInteger(job.authentik_user_pk) || job.authentik_user_pk < 1)
          fail("STAFF_IDENTITY_MISMATCH");
        return validateManagedIdentity(
          await api("GET", `core/users/${job.authentik_user_pk}/`),
          job,
        );
      }
      // Only retrieve the immutable username; never adopt on email or display name.
      let found;
      try {
        found = await api("GET", `core/users/?username=${encodeURIComponent(job.username)}`);
      } catch (error) {
        // Authentik 2026.8.3 ObjectFilter returns 403 for an empty visible
        // queryset. With object-only user rights this is also a new username.
        // Treat only this lookup as empty: POST still requires add_user, unique
        // usernames prevent replacing a hidden account, and a lost create can
        // be recovered only through the granted per-object view permission.
        if (error?.code !== "STAFF_PROVIDER_HTTP_403" || job.removal_requested_at) throw error;
        found = { results: [] };
      }
      if (!Array.isArray(found?.results) || found.pagination?.next)
        fail("STAFF_IDENTITY_QUERY_INVALID");
      if (found.results.length > 1) fail("STAFF_DUPLICATE_IDENTITY");
      if (found.results.length) return validateManagedIdentity(found.results[0], job);
      if (job.has_staff_identity) fail("STAFF_EXISTING_IDENTITY_REQUIRES_MANUAL_LINK");
      if (!job.active) return null;
      if (
        !job.contact_email ||
        job.contact_email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.contact_email)
      )
        fail("STAFF_CONTACT_EMAIL_REQUIRED");
      await beforeWrite();
      return validateManagedIdentity(
        await api("POST", "core/users/", {
          username: job.username,
          name: job.display_name,
          email: job.contact_email,
          path: "globetrotr/managed-staff",
          type: "internal",
          is_active: false,
          groups: [],
          roles: [],
          attributes: {
            globetrotr_managed_user_id: job.user_id,
            globetrotr_creation_nonce: job.creation_nonce,
          },
        }),
        job,
      );
    },
    async reconcile(job, beforeWrite) {
      const user = validateManagedIdentity(
        await api("GET", `core/users/${job.authentik_user_pk}/`),
        job,
      );
      const profile = job.active && job.profile_requested ? job.profile_payload : null;
      if (
        profile &&
        (typeof profile.name !== "string" ||
          profile.name.length > 100 ||
          typeof profile.avatar !== "string" ||
          (profile.avatar &&
            !profile.avatar.startsWith(
              `https://portal.globetrotr.nl/api/staff-avatar?user=${job.user_id}&version=`,
            )))
      )
        fail("STAFF_PROFILE_INVALID");
      await beforeWrite();
      await api("PATCH", `core/users/${user.pk}/`, {
        is_active: job.active,
        groups: job.active ? [STAFF_GROUP, ...(job.mailbox_ready ? [MAIL_GROUP] : [])] : [],
        ...(profile
          ? {
              ...(profile.name ? { name: profile.name } : {}),
              attributes: {
                ...user.attributes,
                globetrotr_profile: { source: "globetrotr", avatar: profile.avatar },
              },
            }
          : {}),
      });
      const after = validateManagedIdentity(await api("GET", `core/users/${user.pk}/`), job);
      const expected = job.active ? [STAFF_GROUP, ...(job.mailbox_ready ? [MAIL_GROUP] : [])] : [];
      if (
        after.is_active !== job.active ||
        after.groups.length !== expected.length ||
        expected.some((id) => !after.groups.includes(id)) ||
        (profile &&
          ((profile.name && after.name !== profile.name) ||
            after.attributes?.globetrotr_profile?.avatar !== profile.avatar ||
            after.attributes?.globetrotr_profile?.source !== "globetrotr"))
      )
        fail("STAFF_IDENTITY_UPDATE_NOT_CONFIRMED");
    },
    async removeIdentity(job, beforeWrite) {
      if (job.active || !job.removal_requested_at || !Number.isSafeInteger(job.authentik_user_pk) ||
        job.authentik_user_pk < 1 || !UUID.test(job.authentik_user_uuid || ""))
        fail("STAFF_REMOVAL_INVALID");
      const path = `core/users/${job.authentik_user_pk}/`;
      let user;
      try {
        user = await api("GET", path);
      } catch (error) {
        // An immutable bound identity may already be gone after a lost DELETE
        // response. Never treat a 403, outage or username lookup as deletion.
        if (error?.code === "STAFF_PROVIDER_HTTP_404") return;
        throw error;
      }
      validateManagedIdentity(user, job);
      if (user.is_active !== false || user.groups.length) fail("STAFF_REMOVAL_NOT_DISABLED");
      await beforeWrite();
      await api("DELETE", path);
      try {
        await api("GET", path);
      } catch (error) {
        if (error?.code === "STAFF_PROVIDER_HTTP_404") return;
        throw error;
      }
      fail("STAFF_REMOVAL_NOT_CONFIRMED");
    },
    async invite(job, beforeWrite) {
      const user = validateManagedIdentity(
        await api("GET", `core/users/${job.authentik_user_pk}/`),
        job,
      );
      if (!job.active || user.is_active !== true || user.email !== job.contact_email)
        fail("STAFF_INVITATION_TARGET_CHANGED");
      const stage = await api("GET", `stages/email/${EMAIL_STAGE}/`);
      if (stage?.name !== "globetrotr-recovery-email" || stage.activate_user_on_success !== false)
        fail("STAFF_EMAIL_STAGE_CONFIGURATION_CHANGED");
      // Caller records 'sending' before this non-idempotent request. An ambiguous
      // result needs an owner retry, never an automatic second email.
      await beforeWrite();
      await api("POST", `core/users/${job.authentik_user_pk}/recovery_email/`, {
        email_stage: EMAIL_STAGE,
        token_duration: "minutes=30",
      });
    },
  };
}

export async function processStaffIdentity(job, provider, rpc) {
  const common = { p_user: job.user_id, p_token: job.token, p_revision: job.claimed_revision };
  const guard = async () => {
    if ((await rpc("guard_staff_identity", common)) !== true) fail("STAFF_JOB_STALE");
  };
  let sending = false;
  try {
    await guard();
    await provider.verifyService();
    await provider.verifyGroups();
    if (job.removal_requested_at) {
      if (job.active) fail("STAFF_REMOVAL_INVALID");
      const removalGuard = async () => {
        await guard();
        if ((await rpc("guard_staff_removal", common)) !== true)
          fail("STAFF_REMOVAL_WAITING_FOR_MAILBOX");
      };
      await removalGuard();
      if (!job.authentik_user_pk) {
        const existing = await provider.ensureIdentity(job, guard);
        if (existing) {
          await rpc("bind_staff_identity", { p_user: job.user_id, p_token: job.token, p_pk: existing.pk, p_uuid: existing.uuid });
          job = { ...job, authentik_user_pk: existing.pk, authentik_user_uuid: existing.uuid };
        }
      }
      if (job.authentik_user_pk) await provider.removeIdentity(job, removalGuard);
      await removalGuard();
      await rpc("finish_staff_removal", common);
      return { ok: true, removed: true };
    }
    if (job.active && provider.verifyApplications) await provider.verifyApplications();
    const user = await provider.ensureIdentity(job, guard);
    if (user) {
      // Persist the immutable identity even if the desired state changed during
      // creation. It was created inactive and the next job will reconcile it.
      await rpc("bind_staff_identity", {
        p_user: job.user_id,
        p_token: job.token,
        p_pk: user.pk,
        p_uuid: user.uuid,
      });
      job = { ...job, authentik_user_pk: user.pk, authentik_user_uuid: user.uuid };
      await provider.reconcile(job, guard);
      if (job.active && job.invitation_status === "pending") {
        await guard();
        await rpc("mark_staff_invitation", { ...common, p_state: "sending" });
        sending = true;
        await provider.invite(job, guard);
        await rpc("mark_staff_invitation", { ...common, p_state: "accepted" });
        sending = false;
      } else if (job.active && ["sending", "uncertain"].includes(job.invitation_status)) {
        fail("STAFF_INVITATION_UNCERTAIN");
      }
    }
    await rpc("finish_staff_identity", { ...common, p_error: null });
    return { ok: true };
  } catch (error) {
    if (sending) {
      try {
        await rpc("mark_staff_invitation", { ...common, p_state: "uncertain" });
      } catch {
        /* Lease may have expired; reclaim also marks uncertainty. */
      }
    }
    const code = /^STAFF_[A-Z0-9_]+$/.test(error?.code || "")
      ? error.code
      : "STAFF_PROVISIONING_FAILED";
    await rpc("finish_staff_identity", { ...common, p_error: code });
    return { ok: false, code };
  }
}
