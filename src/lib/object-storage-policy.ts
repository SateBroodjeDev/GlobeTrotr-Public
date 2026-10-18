export type StoredObjectPurpose = "journal_photo" | "trip_document" | "receipt" | "mail_attachment";

const uploadRules: Record<StoredObjectPurpose, { maxBytes: number; mimeTypes: ReadonlySet<string> }> = {
  journal_photo: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
  },
  trip_document: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  },
  receipt: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  },
  mail_attachment: {
    maxBytes: 15 * 1024 * 1024,
    mimeTypes: new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "text/csv",
    ]),
  },
};

const extensionByMime: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/csv": "csv",
};

export function validateObjectUpload(purpose: StoredObjectPurpose, mimeType: string, sizeBytes: number) {
  const rule = uploadRules[purpose];
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!rule.mimeTypes.has(normalizedMime)) throw new Error("OBJECT_STORAGE_FILE_TYPE_NOT_ALLOWED");
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > rule.maxBytes) {
    throw new Error("OBJECT_STORAGE_FILE_SIZE_INVALID");
  }
  return { mimeType: normalizedMime, sizeBytes, maxBytes: rule.maxBytes };
}

export function createStoredObjectKey(input: {
  purpose: StoredObjectPurpose;
  workspaceId: string;
  tripId?: string;
  mimeType: string;
  id?: string;
}) {
  const extension = extensionByMime[input.mimeType.trim().toLowerCase()];
  if (!extension) throw new Error("OBJECT_STORAGE_FILE_TYPE_NOT_ALLOWED");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(input.workspaceId) || (input.tripId && !uuid.test(input.tripId))) {
    throw new Error("OBJECT_STORAGE_SCOPE_INVALID");
  }
  const id = input.id ?? globalThis.crypto.randomUUID();
  if (!uuid.test(id)) throw new Error("OBJECT_STORAGE_ID_INVALID");
  return [input.purpose, input.workspaceId, input.tripId, `${id}.${extension}`].filter(Boolean).join("/");
}
