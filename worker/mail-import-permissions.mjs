// IMAP import and audited cleanup only; no SMTP or administrative privileges.
export const MAIL_IMPORT_PERMISSIONS = [
  "authenticate", "imapAuthenticate", "imapList", "imapLsub", "imapStatus",
  "imapSelect", "imapExamine", "imapSearch", "imapFetch", "imapStore",
  "imapExpunge", "imapIdle", "imapNamespace", "imapId", "imapCapability", "imapEnable",
];
