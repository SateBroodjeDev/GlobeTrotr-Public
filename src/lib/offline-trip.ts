import { isRoutePlanningItem, type Expense, type ExpenseCategory, type Trip } from "./types.ts";
import { executeOfflineTransaction } from "./offline-storage.ts";

const DB_NAME = "globetrotr-offline-v1";
const STORE_NAME = "trip-packs";
const DB_VERSION = 2;
const DOCUMENT_STORE = "trip-documents";
const KEY_STORE = "encryption-keys";
const PACK_BACKUP_PREFIX = "globetrotr.offline-pack.";

function backupKey(tripId: string) { return `${PACK_BACKUP_PREFIX}${tripId}`; }
function readBackup(tripId: string): OfflineTripPack | undefined {
  if (typeof window === "undefined") return undefined;
  try { const value = window.localStorage.getItem(backupKey(tripId)); return value ? JSON.parse(value) as OfflineTripPack : undefined; } catch { return undefined; }
}

export type OfflineTripPack = {
  version: 1;
  tripId: string;
  name: string;
  start: string;
  end: string;
  locale: "nl" | "en";
  savedAt: string;
  payers: Array<{ id: string; name: string }>;
  queuedExpenses: OfflineExpense[];
  stops: Array<{ id: string; name: string; country: string; arrive?: string; nights?: number }>;
  itinerary: Array<{ id: string; day: string; title: string; notes?: string }>;
  travelItems: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    endDate?: string;
    provider?: string;
    flightNumber?: string;
    departure?: string;
    arrival?: string;
    location?: string;
    startTime?: string;
    endTime?: string;
  }>;
};

export type OfflineExpense = Pick<Expense, "id" | "date" | "title" | "amount" | "currency" | "paidBy"> & {
  category: ExpenseCategory;
  billable: false;
  queuedAt: string;
};

export type OfflineTripPackSummary = {
  bytes: number;
  stops: number;
  itineraryItems: number;
  bookings: number;
  queuedExpenses: number;
};

export type OfflineDocument = {
  id: string;
  tripId: string;
  fileName: string;
  mimeType: string;
  size: number;
  savedAt: string;
  iv: number[];
  ciphertext: ArrayBuffer;
};

export function summarizeOfflineTripPack(pack: OfflineTripPack): OfflineTripPackSummary {
  return {
    bytes: new TextEncoder().encode(JSON.stringify(pack)).byteLength,
    stops: pack.stops.length,
    itineraryItems: pack.itinerary.length,
    bookings: pack.travelItems.length,
    queuedExpenses: pack.queuedExpenses.length,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("OFFLINE_STORAGE_UNAVAILABLE"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "tripId" });
      }
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) {
        const documents = request.result.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
        documents.createIndex("tripId", "tripId", { unique: false });
      }
      if (!request.result.objectStoreNames.contains(KEY_STORE)) {
        request.result.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_STORAGE_FAILED"));
  });
}

function databaseRequest<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => executeOfflineTransaction(database, storeName, mode, run));
}

async function documentKey() {
  const stored = await databaseRequest<any>(KEY_STORE, "readonly", (store) => store.get("documents"));
  if (stored?.key) return stored.key as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await databaseRequest(KEY_STORE, "readwrite", (store) => store.put({ id: "documents", key }));
  return key;
}

export async function saveOfflineDocument(input: { id: string; tripId: string; fileName: string; mimeType: string; blob: Blob }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await documentKey(), await input.blob.arrayBuffer());
  const row: OfflineDocument = { id: input.id, tripId: input.tripId, fileName: input.fileName, mimeType: input.mimeType, size: input.blob.size, savedAt: new Date().toISOString(), iv: Array.from(iv), ciphertext };
  await databaseRequest(DOCUMENT_STORE, "readwrite", (store) => store.put(row));
  return row;
}

export async function listOfflineDocuments(tripId: string) {
  const rows = await databaseRequest<OfflineDocument[]>(DOCUMENT_STORE, "readonly", (store) => store.getAll());
  return rows.filter((row) => row.tripId === tripId);
}

export async function openOfflineDocument(id: string) {
  const row = await databaseRequest<OfflineDocument | undefined>(DOCUMENT_STORE, "readonly", (store) => store.get(id));
  if (!row) throw new Error("OFFLINE_DOCUMENT_NOT_FOUND");
  const content = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv) }, await documentKey(), row.ciphertext);
  return new Blob([content], { type: row.mimeType || "application/octet-stream" });
}

export async function deleteOfflineDocument(id: string) {
  await databaseRequest(DOCUMENT_STORE, "readwrite", (store) => store.delete(id));
}

export async function offlineStorageUsage() {
  const [documents, packs] = await Promise.all([
    databaseRequest<OfflineDocument[]>(DOCUMENT_STORE, "readonly", (store) => store.getAll()),
    databaseRequest<OfflineTripPack[]>(STORE_NAME, "readonly", (store) => store.getAll()),
  ]);
  return { documents: documents.reduce((sum, row) => sum + row.size, 0), trips: packs.reduce((sum, pack) => sum + summarizeOfflineTripPack(pack).bytes, 0) };
}

function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return databaseRequest(STORE_NAME, mode, run);
}

export function createOfflineTripPack(trip: Trip, locale: string, payers: Array<{ id: string; name: string }> = [], queuedExpenses: OfflineExpense[] = []): OfflineTripPack {
  return {
    version: 1,
    tripId: trip.id,
    name: trip.name,
    start: trip.start,
    end: trip.end,
    locale: locale.toLowerCase().startsWith("nl") ? "nl" : "en",
    savedAt: new Date().toISOString(),
    payers: payers.slice(0, 100).map(({ id, name }) => ({ id, name })),
    queuedExpenses: queuedExpenses.slice(0, 50),
    stops: trip.stops.map(({ id, name, country, arrive, nights }) => ({ id, name, country, arrive, nights })),
    itinerary: trip.itinerary.map(({ id, day, title, notes }) => ({ id, day, title, notes })),
    travelItems: (trip.travelItems ?? []).flatMap((item) => {
      if (isRoutePlanningItem(item)) return [];
      return [{
        id: item.id,
        type: item.type,
        title: item.title,
        date: item.date,
        endDate: item.endDate,
        provider: item.provider,
        flightNumber: item.flightNumber,
        departure: item.departure?.name,
        arrival: item.arrival?.name,
        location: item.location?.name,
        startTime: item.details?.startTime,
        endTime: item.details?.endTime,
      }];
    }),
  };
}

export async function saveOfflineTrip(pack: OfflineTripPack) {
  const serialized = JSON.stringify(pack);
  try {
    await transaction("readwrite", (store) => store.put(pack));
  } catch (error) {
    // The standalone offline view can also use this backup if IndexedDB is unavailable.
    try { window.localStorage.setItem(backupKey(pack.tripId), serialized); return; }
    catch { throw error; }
  }
  try { window.localStorage.setItem(backupKey(pack.tripId), serialized); }
  catch { /* A full/blocked localStorage must not invalidate a committed IndexedDB save. */ }
}

export async function getOfflineTrip(tripId: string) {
  try {
    return (await transaction<OfflineTripPack | undefined>("readonly", (store) => store.get(tripId))) ?? readBackup(tripId);
  } catch {
    return readBackup(tripId);
  }
}

export async function deleteOfflineTrip(tripId: string) {
  const cleanup: Promise<unknown>[] = [Promise.resolve().then(() => window.localStorage.removeItem(backupKey(tripId)))];
  if ("indexedDB" in window) {
    cleanup.push(transaction("readwrite", (store) => store.delete(tripId)));
    cleanup.push(listOfflineDocuments(tripId).then((documents) => Promise.all(documents.map((document) => deleteOfflineDocument(document.id)))));
  }
  // Always attempt every store, including a fallback-only pack. Do not claim all
  // copies were removed if browser storage prevents part of the cleanup.
  const results = await Promise.allSettled(cleanup);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}

export async function clearOfflineTrips() {
  if (typeof window === "undefined") return;
  const databaseCleanup = "indexedDB" in window ? Promise.allSettled([
    transaction("readwrite", (store) => store.clear()),
    databaseRequest(DOCUMENT_STORE, "readwrite", (store) => store.clear()),
    databaseRequest(KEY_STORE, "readwrite", (store) => store.clear()),
  ]) : Promise.resolve();
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(PACK_BACKUP_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch { /* Browser privacy settings may block localStorage; still finish IndexedDB cleanup. */ }
  await databaseCleanup;
}

export async function queueOfflineExpense(tripId: string, expense: OfflineExpense) {
  const pack = await getOfflineTrip(tripId);
  if (!pack) throw new Error("OFFLINE_TRIP_NOT_FOUND");
  if ((pack.queuedExpenses ?? []).length >= 50) throw new Error("OFFLINE_EXPENSE_LIMIT");
  pack.queuedExpenses = [...(pack.queuedExpenses ?? []).filter((item) => item.id !== expense.id), expense];
  await saveOfflineTrip(pack);
  return pack;
}

export async function removeQueuedOfflineExpenses(tripId: string, ids: string[]) {
  const pack = await getOfflineTrip(tripId);
  if (!pack) return;
  const completed = new Set(ids);
  pack.queuedExpenses = (pack.queuedExpenses ?? []).filter((item) => !completed.has(item.id));
  await saveOfflineTrip(pack);
}

export function mergeOfflineExpenses(current: Expense[], queued: Expense[]) {
  const ids = new Set(current.map((expense) => expense.id));
  return [...current, ...queued.filter((expense) => !ids.has(expense.id))];
}

export function findOfflineExpenseConflicts(current: Expense[], queued: OfflineExpense[]) {
  const existing = new Map(current.map((expense) => [expense.id, expense]));
  return queued.filter((expense) => {
    const server = existing.get(expense.id);
    return server !== undefined && JSON.stringify({ date: server.date, title: server.title, amount: server.amount, currency: server.currency, paidBy: server.paidBy }) !== JSON.stringify({ date: expense.date, title: expense.title, amount: expense.amount, currency: expense.currency, paidBy: expense.paidBy });
  }).map((expense) => expense.id);
}
