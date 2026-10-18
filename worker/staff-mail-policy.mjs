export function importMailboxReady(box) {
  return !box.provisioning_create_only ||
    Boolean(box.managed_import_credential_id && box.provisioning_status === "ready");
}

export function corporateJunkFolders(folders, inbox) {
  return folders.filter((folder) => folder.path !== inbox && !folder.flags?.has("\\Noselect") &&
    (folder.specialUse === "\\Junk" || folder.flags?.has("\\Junk") ||
      /(?:^|[/.])(junk|spam|ongewenst)$/i.test(folder.path)))
    .slice(0, 4).map((folder) => folder.path);
}

export async function corporateFoldersSupported(rest) {
  try {
    await rest("corporate_mail_messages?select=mail_folder&limit=0");
    return true;
  } catch (error) {
    if (error?.code === "REST_400") return false; // Previous schema: retain inbox-only import.
    throw error;
  }
}

export async function pendingCorporateFolderImports(boxes, providerId, folder, existing, rest, enabled) {
  const pending = [];
  for (const box of boxes) {
    const key = `${box.id}:${providerId}`;
    if (!enabled || !existing.has(key)) { pending.push(box); continue; }
    if (existing.get(key) !== folder) {
      // Preserve read state, archive/retention state, bodies and attachments.
      await rest(`corporate_mail_messages?mailbox_id=eq.${box.id}&provider_message_id=eq.${encodeURIComponent(providerId)}`, {
        method: "PATCH", body: JSON.stringify({ mail_folder: folder }),
      });
      existing.set(key, folder);
    }
  }
  return pending;
}
