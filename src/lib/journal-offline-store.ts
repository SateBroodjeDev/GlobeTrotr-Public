import { offlineNamespace, offlineOwner, scopedOffline } from "./offline-account.ts";
import { executeOfflineTransaction } from "./offline-storage.ts";

export type OfflineJournalEntry={id:string;author_id:string;entry_date:string;title:string;body:string;location_name:string|null;rating:number|null;visibility:"private"|"members"|"public";photo_paths:string[];photo_captions:Record<string,string>;photo_sizes?:Record<string,number>;updated_at?:string};
export type JournalQueueItem={id:string;tripId:string;kind:"create"|"update"|"delete";entry:OfflineJournalEntry;files?:File[];createdAt:string};
const dbName="globetrotr-journal-v2";
function openDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(offlineNamespace(dbName),1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots",{keyPath:"tripId"});if(!db.objectStoreNames.contains("photos"))db.createObjectStore("photos",{keyPath:"key"});if(!db.objectStoreNames.contains("queue"))db.createObjectStore("queue",{keyPath:"id"})};request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};request.onerror=()=>reject(request.error)})}
async function transaction<T>(name:string,mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>){return executeOfflineTransaction(await openDb(),name,mode,run)}
async function saveJournalSnapshotOperation(tripId:string,entries:OfflineJournalEntry[]){await transaction("snapshots","readwrite",store=>store.put({tripId,entries,savedAt:new Date().toISOString()}))}
async function loadJournalSnapshotOperation(tripId:string){return transaction<any>("snapshots","readonly",store=>store.get(tripId)) as Promise<{tripId:string;entries:OfflineJournalEntry[];savedAt:string}|undefined>}
async function saveOfflinePhotoOperation(tripId:string,path:string,url:string){const response=await fetch(url);if(!response.ok)throw new Error("PHOTO_DOWNLOAD_FAILED");const blob=await response.blob();await transaction("photos","readwrite",store=>store.put({key:tripId+":"+path,tripId,path,blob,size:blob.size}));return blob.size}
async function loadOfflinePhotoOperation(tripId:string,path:string){const row=await transaction<any>("photos","readonly",store=>store.get(tripId+":"+path));return row?.blob as Blob|undefined}
async function pruneOfflinePhotosOperation(tripId:string,keepPaths:string[]){const rows=await transaction<any[]>("photos","readonly",store=>store.getAll());const keep=new Set(keepPaths);for(const row of rows)if(row.tripId===tripId&&!keep.has(row.path))await transaction("photos","readwrite",store=>store.delete(row.key))}
async function queueJournalChangeOperation(item:Omit<JournalQueueItem,"id"|"createdAt">){const row={...item,id:crypto.randomUUID(),createdAt:new Date().toISOString()};await transaction("queue","readwrite",store=>store.put(row));return row}
async function journalQueueOperation(tripId:string){const rows=await transaction<any[]>("queue","readonly",store=>store.getAll());return rows.filter(row=>row.tripId===tripId) as JournalQueueItem[]}
async function removeJournalQueueItemOperation(id:string){await transaction("queue","readwrite",store=>store.delete(id))}
async function journalOfflineUsageOperation(tripId:string){const photos=await transaction<any[]>("photos","readonly",store=>store.getAll());const snapshot=await loadJournalSnapshot(tripId);return photos.filter(row=>row.tripId===tripId).reduce((sum,row)=>sum+(row.size||0),0)+new TextEncoder().encode(JSON.stringify(snapshot??{})).byteLength}
async function clearJournalOfflineTripOperation(tripId:string){const photos=await transaction<any[]>("photos","readonly",store=>store.getAll());const queued=await transaction<any[]>("queue","readonly",store=>store.getAll());for(const row of photos)if(row.tripId===tripId)await transaction("photos","readwrite",store=>store.delete(row.key));for(const row of queued)if(row.tripId===tripId)await transaction("queue","readwrite",store=>store.delete(row.id));await transaction("snapshots","readwrite",store=>store.delete(tripId))}
async function clearOfflineJournalOperation(){
  if(typeof indexedDB==="undefined")return;
  // Clearing records also works with an older tab's open database connection.
  // Deleting the database would be blocked by it; blocked is not completion.
  await Promise.all(["snapshots","photos","queue"].map(name=>transaction(name,"readwrite",store=>store.clear())));
}

export const saveJournalSnapshot = scopedOffline(saveJournalSnapshotOperation);
export const loadJournalSnapshot = scopedOffline(loadJournalSnapshotOperation);
export const saveOfflinePhoto = scopedOffline(saveOfflinePhotoOperation);
export const loadOfflinePhoto = scopedOffline(loadOfflinePhotoOperation);
export const pruneOfflinePhotos = scopedOffline(pruneOfflinePhotosOperation);
export const queueJournalChange = scopedOffline(queueJournalChangeOperation);
export const journalQueue = scopedOffline(journalQueueOperation);
export const removeJournalQueueItem = scopedOffline(removeJournalQueueItemOperation);
export const journalOfflineUsage = scopedOffline(journalOfflineUsageOperation);
export const clearJournalOfflineTrip = scopedOffline(clearJournalOfflineTripOperation);
export const clearOfflineJournal = scopedOffline(clearOfflineJournalOperation);
