import { offlineOwner } from "./offline-account.ts";
export type OfflineJournalDraft = { tripId: string; date: string; title: string; body: string; location: string; savedAt: string };
const prefix = "globetrotr-journal-draft-v2:";
export function journalDraftBytes(draft: OfflineJournalDraft) { return new TextEncoder().encode(JSON.stringify(draft)).byteLength; }
export function saveJournalDraft(draft: OfflineJournalDraft) { if (draft.title.length > 160 || draft.body.length > 10_000 || draft.location.length > 160) throw new Error("JOURNAL_DRAFT_TOO_LARGE"); localStorage.setItem(`${prefix}${offlineOwner()}:${draft.tripId}`, JSON.stringify(draft)); }
export function loadJournalDraft(tripId: string): OfflineJournalDraft | null { try { const value = JSON.parse(localStorage.getItem(`${prefix}${offlineOwner()}:${tripId}`) ?? "null") as OfflineJournalDraft | null; return value?.tripId === tripId ? value : null; } catch { return null; } }
export function clearJournalDraft(tripId: string) { localStorage.removeItem(`${prefix}${offlineOwner()}:${tripId}`); }
export function clearAllJournalDrafts(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix) || key?.startsWith("globetrotr-journal-draft:")) storage.removeItem(key);
  }
}
