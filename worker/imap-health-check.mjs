// Read-only observation of the actual sync process. No IMAP login or DB query.
import { readImapSyncHealth } from "./imap-sync-health.mjs";
console.log(JSON.stringify(await readImapSyncHealth()));
