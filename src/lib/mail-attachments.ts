export const MAIL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type MailAttachmentMetadata = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export function validMailAttachments(files: MailAttachmentMetadata[]) {
  return (
    files.length <= 5 &&
    files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0) <= 20 * 1024 * 1024 &&
    files.every(
      (file) =>
        file.fileName.trim().length >= 1 &&
        file.fileName.trim().length <= 255 &&
        MAIL_ATTACHMENT_TYPES.has(file.contentType) &&
        file.sizeBytes >= 1 &&
        file.sizeBytes <= 10 * 1024 * 1024 &&
        /^[0-9a-f]{64}$/.test(file.sha256),
    )
  );
}

export function inferMailAttachmentType(file: { name: string; type: string }) {
  if (MAIL_ATTACHMENT_TYPES.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  return (
    {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      txt: "text/plain",
      csv: "text/csv",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[extension || ""] || ""
  );
}
