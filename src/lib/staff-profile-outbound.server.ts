import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const STAFF_PROFILE_ISSUER = "https://sso.globetrotr.nl/application/o/globetrotr-staff/";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function avatarType(bytes: Buffer) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("STAFF_AVATAR_INVALID");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  throw new Error("STAFF_AVATAR_INVALID");
}
export function avatarSignature(userId: string, version: string, key: string) {
  if (!uuid.test(userId) || !/^[a-f0-9]{64}$/.test(version) || key.length < 32)
    throw new Error("STAFF_AVATAR_CONFIGURATION_REQUIRED");
  return createHmac("sha256", key)
    .update(`staff-avatar:v1:${userId}:${version}`)
    .digest("base64url");
}
export function validAvatarSignature(
  userId: string,
  version: string,
  signature: string,
  key: string,
) {
  try {
    if (signature.length > 100) return false;
    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(avatarSignature(userId, version, key), "base64url");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export function profileBinding(user: any) {
  const binding = user.app_metadata?.staff_profile_binding;
  if (
    !binding ||
    binding.issuer !== STAFF_PROFILE_ISSUER ||
    !Number.isSafeInteger(binding.userPk) ||
    binding.userPk <= 0 ||
    !user.identities?.some(
      (identity: any) =>
        identity.provider === "custom:globetrotr-staff" &&
        identity.identity_data?.sub === binding.subject,
    )
  )
    return null;
  return binding;
}
export async function localStaffAvatar(db: any, userId: string, path: string) {
  if (
    !uuid.test(userId) ||
    !path.startsWith(`${userId}/`) ||
    !/^[a-zA-Z0-9_.-]+$/.test(path.slice(userId.length + 1)) ||
    path.endsWith("/..")
  )
    throw new Error("STAFF_AVATAR_PATH_INVALID");
  const file = await db.storage.from("avatars").download(path);
  if (file.error || !file.data || file.data.size > 5 * 1024 * 1024)
    throw new Error("STAFF_AVATAR_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await file.data.arrayBuffer());
  return {
    bytes,
    contentType: avatarType(bytes),
    version: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function api(path: string, token: string, fetcher: typeof fetch, payload?: unknown) {
  const response = await fetcher(`https://sso.globetrotr.nl/api/v3/core/users/${path}/`, {
    method: payload ? "PATCH" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) throw new Error("STAFF_PROFILE_PROVIDER_FAILED");
  if (payload) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("STAFF_PROFILE_PROVIDER_FAILED");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 512 * 1024) throw new Error("STAFF_PROFILE_PROVIDER_FAILED");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

export async function pushProfileToAuthentik(
  db: any,
  user: any,
  config: { token?: string; signingKey?: string; managed?: boolean },
  fetcher = fetch,
) {
  if (user.app_metadata?.corporate_admin !== true) return { status: "not_staff" as const };
  const admin = await db
    .from("platform_admins")
    .select("active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (admin.error) return { status: "failed" as const };
  if (!admin.data?.active) return { status: "not_staff" as const };
  const binding = profileBinding(user);
  if (!binding) return { status: "needs_link" as const };
  if ((!config.token && !config.managed) || !config.signingKey || config.signingKey.length < 32)
    return { status: "not_configured" as const };
  try {
    const profile = await db
      .from("profiles")
      .select("display_name,avatar_path")
      .eq("id", user.id)
      .single();
    if (profile.error) throw new Error("STAFF_PROFILE_UNAVAILABLE");
    const name = String(profile.data.display_name || "").trim();
    if (name.length > 100) throw new Error("STAFF_PROFILE_NAME_INVALID");
    let avatar = "";
    if (profile.data.avatar_path) {
      const photo = await localStaffAvatar(db, user.id, profile.data.avatar_path);
      const signature = avatarSignature(user.id, photo.version, config.signingKey);
      avatar = `https://portal.globetrotr.nl/api/staff-avatar?user=${user.id}&version=${photo.version}&signature=${signature}`;
    }
    if (config.managed) {
      const queued = await db.rpc("request_staff_profile_sync", {
        p_user: user.id,
        p_pk: binding.userPk,
        p_name: name,
        p_avatar: avatar,
      });
      if (queued.error) throw new Error("STAFF_PROFILE_QUEUE_FAILED");
      return { status: "queued" as const };
    }
    const current = await api(String(binding.userPk), config.token!, fetcher);
    if (
      current.pk !== binding.userPk ||
      current.is_active !== true ||
      !current.attributes ||
      typeof current.attributes !== "object" ||
      Array.isArray(current.attributes)
    )
      throw new Error("STAFF_PROFILE_TARGET_INVALID");
    const existing = current.attributes.globetrotr_profile;
    if (
      (!name || name === current.name) &&
      existing?.avatar === avatar &&
      existing?.source === "globetrotr"
    )
      return { status: "unchanged" as const };
    const details = {
      provider: "custom:globetrotr-staff",
      nameUpdated: Boolean(name && name !== current.name),
      avatarUpdated: existing?.avatar !== avatar,
    };
    const requested = await db.from("platform_admin_audit_log").insert({
      actor_user_id: user.id,
      action: "staff_profile.sync_requested",
      target_type: "user",
      target_id: user.id,
      result: "success",
      details,
    });
    if (requested.error) throw new Error("STAFF_PROFILE_AUDIT_FAILED");
    // Explicit whitelist: never send e-mail, username, groups, roles or superuser.
    await api(String(binding.userPk), config.token!, fetcher, {
      ...(name ? { name } : {}),
      attributes: { ...current.attributes, globetrotr_profile: { source: "globetrotr", avatar } },
    });
    const completed = await db.from("platform_admin_audit_log").insert({
      actor_user_id: user.id,
      action: "staff_profile.synced",
      target_type: "user",
      target_id: user.id,
      result: "success",
      details,
    });
    if (completed.error) throw new Error("STAFF_PROFILE_AUDIT_FAILED");
    return { status: "synced" as const };
  } catch {
    return { status: "failed" as const };
  }
}

export async function staffAvatarResponse(request: Request, db: any, signingKey: string) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") || "",
    version = url.searchParams.get("version") || "";
  const unavailable = () =>
    new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!validAvatarSignature(userId, version, url.searchParams.get("signature") || "", signingKey))
    return unavailable();
  try {
    const [admin, user, profile] = await Promise.all([
      db.from("platform_admins").select("active").eq("user_id", userId).maybeSingle(),
      db.auth.admin.getUserById(userId),
      db.from("profiles").select("avatar_path").eq("id", userId).single(),
    ]);
    if (
      admin.error ||
      user.error ||
      profile.error ||
      !admin.data?.active ||
      user.data.user?.app_metadata?.corporate_admin !== true ||
      !profileBinding(user.data.user) ||
      !profile.data.avatar_path
    )
      return unavailable();
    const photo = await localStaffAvatar(db, userId, profile.data.avatar_path);
    if (photo.version !== version) return unavailable();
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return unavailable();
  }
}
