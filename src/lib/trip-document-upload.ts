import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_TYPES = ["ticket", "voucher", "insurance", "visa", "booking", "other"] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export type TripDocument = {
  id: string; trip_uuid?: string; travel_item_id: string | null; storage_path: string;
  file_name: string; mime_type: string | null; size_bytes: number | null;
  document_type: DocumentType; expires_on: string | null; created_at: string;
};
export type DocumentUpload = {
  id: string; tripId: string; bookingId?: string; type: DocumentType; expiresOn: string;
  file: File; stage: "new" | "uploaded" | "uncertain" | "complete";
};
type Client = Pick<SupabaseClient, "from" | "storage">;
function fail(code: string): never { throw Error(code); }
export function documentUploadPath(upload: DocumentUpload) {
  const name = upload.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "document";
  return `${upload.tripId}/${upload.id}/${name}`;
}
export function validateDocumentUpload(upload: DocumentUpload) {
  if (!DOCUMENT_TYPES.includes(upload.type) || !DOCUMENT_MIME_TYPES.includes(upload.file.type)
    || upload.file.size <= 0 || upload.file.size > DOCUMENT_MAX_BYTES) fail("DOCUMENT_FILE_INVALID");
  if (upload.expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(upload.expiresOn)
    || !Number.isFinite(Date.parse(upload.expiresOn + "T00:00:00Z"))
    || new Date(upload.expiresOn + "T00:00:00Z").toISOString().slice(0, 10) !== upload.expiresOn)) fail("DOCUMENT_DATE_INVALID");
}

/** Existing private bucket/rows/RLS. A retry retains its ID and reconciles an uncertain ACK. */
export async function uploadTripDocument(client: Client, upload: DocumentUpload): Promise<string> {
  validateDocumentUpload(upload);
  const path = documentUploadPath(upload), bucket = client.storage.from("trip-documents");
  const find = async () => {
    const result = await client.from("trip_documents").select("id,storage_path,travel_item_id,document_type,file_name,size_bytes,mime_type,expires_on")
      .eq("trip_uuid", upload.tripId).eq("id", upload.id).maybeSingle();
    if (result.error) fail("DOCUMENT_SAVE_UNCONFIRMED");
    if (result.data && (result.data.storage_path !== path || result.data.travel_item_id !== (upload.bookingId || null)
      || result.data.document_type !== upload.type || result.data.file_name !== upload.file.name
      || result.data.size_bytes !== upload.file.size || result.data.mime_type !== upload.file.type
      || result.data.expires_on !== (upload.expiresOn || null))) fail("DOCUMENT_SAVE_UNCONFIRMED");
    return Boolean(result.data);
  };
  if (upload.stage !== "new") {
    if (await find()) { upload.stage = "complete"; return upload.id; }
    const split = path.lastIndexOf("/");
    const existing = await bucket.list(path.slice(0, split), { search: path.slice(split + 1), limit: 2 });
    if (existing.error) fail("DOCUMENT_SAVE_UNCONFIRMED");
    upload.stage = existing.data?.some(item => item.name === path.slice(split + 1)) ? "uploaded" : "new";
  }
  const { data: trip, error: tripError } = await client.from("trips").select("workspace_user_id,id").eq("trip_uuid", upload.tripId).single();
  if (tripError || !trip) fail("DOCUMENT_TRIP_UNAVAILABLE");
  if (upload.bookingId) {
    const booking = await client.from("trip_travel_items").select("id").eq("trip_uuid", upload.tripId).eq("id", upload.bookingId).maybeSingle();
    if (booking.error || !booking.data) fail("DOCUMENT_BOOKING_UNAVAILABLE");
  }
  if (upload.stage === "new") {
    upload.stage = "uncertain";
    const stored = await bucket.upload(path, upload.file, { contentType: upload.file.type, upsert: false });
    if (stored.error) fail("DOCUMENT_UPLOAD_FAILED");
    upload.stage = "uploaded";
  }
  const metadata = { workspace_user_id: trip.workspace_user_id, trip_id: trip.id, trip_uuid: upload.tripId,
    id: upload.id, travel_item_id: upload.bookingId || null, storage_path: path, file_name: upload.file.name,
    mime_type: upload.file.type, size_bytes: upload.file.size, document_type: upload.type, expires_on: upload.expiresOn || null };
  upload.stage = "uncertain";
  try {
    const saved = await client.from("trip_documents").insert(metadata).select("id").single();
    if (!saved.error && saved.data?.id === upload.id) { upload.stage = "complete"; return upload.id; }
  } catch { /* A lost response may follow a committed insert. Reconcile before deleting bytes. */ }
  if (await find()) { upload.stage = "complete"; return upload.id; }
  const cleanup = await bucket.remove([path]);
  if (cleanup.error) fail("DOCUMENT_SAVE_UNCONFIRMED");
  upload.stage = "new";
  return fail("DOCUMENT_UPLOAD_FAILED");
}

/** Do not render arbitrary HTML/SVG or unbounded files in an application-origin frame. */
export function documentPreviewMime(blob: Blob): string {
  const mime = blob.type.split(";")[0].trim().toLowerCase();
  if (!DOCUMENT_MIME_TYPES.includes(mime) || blob.size <= 0 || blob.size > DOCUMENT_MAX_BYTES) fail("DOCUMENT_PREVIEW_UNSUPPORTED");
  return mime;
}
