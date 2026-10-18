type StorageObject = { bucket_id: string; object_name: string };
export type AccountDeletionClient = {
  from: (table: string) => any;
  rpc: (name: string, args: { p_user_id: string; p_limit: number }) => PromiseLike<{ data: StorageObject[] | null; error: unknown }>;
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: unknown }> } };
  auth: { admin: { deleteUser: (id: string) => PromiseLike<{ error: unknown }> } };
};

export async function removeAccountMemberships(
  db: Pick<AccountDeletionClient, "from">,
  userId: string,
  email?: string | null,
) {
  const { error: membershipError } = await db.from("trip_members").delete().eq("user_id", userId);
  if (membershipError) throw membershipError;
  // Invitations are stored with a trimmed, lowercase address. LIKE would treat
  // valid local-part characters such as '_' and '%' as destructive wildcards.
  if (email?.trim()) {
    const { error: invitationError } = await db.from("trip_invitations").delete().eq("email", email.trim().toLowerCase());
    if (invitationError) throw invitationError;
  }
}

// Enumerate on the server and remove via Storage API, so both the blob and its
// metadata disappear. Re-query the first batch after deletion; offsets would
// skip objects when the preceding batch has just been removed.
export async function deleteUserWithStorage(
  db: AccountDeletionClient,
  userId: string,
  beforeDelete?: () => Promise<void>,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("ACCOUNT_DELETE_USER_INVALID");
  }
  // Auth's final DELETE trigger is too late to protect files removed first.
  // Fail before inventory, blob deletion or membership changes.
  const [role, identity, setup] = await Promise.all([
    db.from("platform_admins").select("active").eq("user_id", userId).maybeSingle(),
    db.from("staff_identity_provisioning").select("status").eq("user_id", userId).maybeSingle(),
    db.from("staff_mail_setup").select("status,expires_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (role.error || identity.error || setup.error) throw new Error("ACCOUNT_DELETE_PREFLIGHT_FAILED");
  if (role.data?.active || (identity.data && identity.data.status !== "disabled") ||
    (setup.data && ["pending", "processing"].includes(setup.data.status) &&
      !(Date.parse(setup.data.expires_at) <= Date.now()))) {
    throw new Error("STAFF_OFFBOARDING_PENDING");
  }
  let previousBatch = "";
  while (true) {
    const { data, error } = await db.rpc("list_account_deletion_files", { p_user_id: userId, p_limit: 100 });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("ACCOUNT_DELETE_STORAGE_INVENTORY_INVALID");
    if (!data.length) break;
    const currentBatch = JSON.stringify(data);
    if (currentBatch === previousBatch) throw new Error("ACCOUNT_DELETE_STORAGE_PROGRESS_FAILED");
    previousBatch = currentBatch;
    const buckets = new Map<string, string[]>();
    for (const object of data) {
      if (!object.bucket_id || !object.object_name) throw new Error("ACCOUNT_DELETE_FILE_INVALID");
      const paths = buckets.get(object.bucket_id) ?? [];
      paths.push(object.object_name);
      buckets.set(object.bucket_id, paths);
    }
    for (const [bucket, paths] of buckets) {
      const removed = await db.storage.from(bucket).remove(paths);
      if (removed.error) throw removed.error;
    }
  }
  await beforeDelete?.();
  const removed = await db.auth.admin.deleteUser(userId);
  if (removed.error) throw removed.error;
}
