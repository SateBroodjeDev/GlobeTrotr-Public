/** A successful request is not durable until its IndexedDB transaction commits. */
export function executeOfflineTransaction<T>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      const failed = () => {
        database.close();
        reject(transaction.error ?? request.error ?? new Error("OFFLINE_STORAGE_FAILED"));
      };
      request.onerror = failed;
      transaction.onerror = failed;
      transaction.onabort = failed;
    } catch (error) {
      database.close();
      reject(error);
    }
  });
}
