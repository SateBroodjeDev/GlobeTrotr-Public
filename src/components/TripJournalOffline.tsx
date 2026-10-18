import { useEffect, useState } from "react";
import { CloudDownload, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  clearJournalOfflineTrip,
  journalOfflineUsage,
  journalQueue,
  loadJournalSnapshot,
  loadOfflinePhoto,
  pruneOfflinePhotos,
  removeJournalQueueItem,
  saveJournalSnapshot,
  saveOfflinePhoto,
  type JournalQueueItem,
  type OfflineJournalEntry,
} from "@/lib/journal-offline-store";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Entry = OfflineJournalEntry & { photoItems: { path: string; url: string }[] };
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateQueuedFiles(files: File[]) {
  if (files.length > 8) throw new Error("JOURNAL_FILE_INVALID");
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("JOURNAL_FILE_INVALID");
    }
  }
}

export function TripJournalOffline({ tripId, entries, refetch }: { tripId: string; entries: Entry[]; refetch: () => Promise<unknown> }) {
  const { text } = useLocale();
  const [selected, setSelected] = useState<string[]>([]);
  const [queue, setQueue] = useState<JournalQueueItem[]>([]);
  const [bytes, setBytes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [offlineEntries, setOfflineEntries] = useState<Array<OfflineJournalEntry & { urls: string[] }>>([]);

  async function refresh() {
    setQueue(await journalQueue(tripId));
    setBytes(await journalOfflineUsage(tripId));
    const snapshot = await loadJournalSnapshot(tripId);
    const cachedPaths: string[] = [];
    const loaded = await Promise.all((snapshot?.entries ?? []).map(async (entry) => {
      const photos = await Promise.all(entry.photo_paths.map(async (path) => ({ path, blob: await loadOfflinePhoto(tripId, path) })));
      const urls = photos.flatMap(({ path, blob }) => {
        if (!blob) return [];
        cachedPaths.push(path);
        return [URL.createObjectURL(blob)];
      });
      return { ...entry, urls };
    }));
    setSelected(cachedPaths);
    setOfflineEntries(loaded);
  }

  // refresh deliberately reloads the trip-scoped IndexedDB stores when the trip changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [tripId]);
  useEffect(() => () => {
    offlineEntries.forEach((entry) => entry.urls.forEach((url) => URL.revokeObjectURL(url)));
  }, [offlineEntries]);

  async function cache() {
    setBusy(true);
    try {
      await saveJournalSnapshot(tripId, entries.map(({ photoItems: _photoItems, ...entry }) => entry));
      await pruneOfflinePhotos(tripId, selected);
      for (const entry of entries) {
        for (const photo of entry.photoItems) {
          if (selected.includes(photo.path) && !await loadOfflinePhoto(tripId, photo.path)) {
            await saveOfflinePhoto(tripId, photo.path, photo.url);
          }
        }
      }
      await refresh();
      toast.success(text("Dagboek offline bijgewerkt.", "Journal updated for offline use."));
    } catch {
      toast.error(text("Offline dagboek kon niet worden opgeslagen.", "Offline journal could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function clearLocal() {
    if (!confirm(text(
      "Offline herinneringen, foto's en niet-gesynchroniseerde wijzigingen van deze reis verwijderen?",
      "Remove offline memories, photos and unsynchronised changes for this trip?",
    ))) return;
    setBusy(true);
    try {
      await clearJournalOfflineTrip(tripId);
      setSelected([]);
      await refresh();
      toast.success(text("Offline dagboek van dit apparaat verwijderd.", "Offline journal removed from this device."));
    } finally {
      setBusy(false);
    }
  }

  async function syncDelete(item: JournalQueueItem) {
    let request = (supabase as any).from("trip_journal_entries").delete()
      .eq("id", item.entry.id).eq("trip_uuid", tripId);
    if (item.entry.updated_at) request = request.eq("updated_at", item.entry.updated_at);
    const { data, error } = await request.select("id");
    if (error) throw error;
    if (!data?.length) {
      const current = await (supabase as any).from("trip_journal_entries").select("id")
        .eq("id", item.entry.id).eq("trip_uuid", tripId).maybeSingle();
      if (current.error) throw current.error;
      if (current.data) throw new Error("JOURNAL_SYNC_CONFLICT");
    }
  }

  async function syncUpdate(item: JournalQueueItem) {
    const { id: _id, author_id: _authorId, photo_paths: _paths, photo_sizes: _sizes, updated_at: _updatedAt, ...payload } = item.entry;
    let request = (supabase as any).from("trip_journal_entries")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", item.entry.id).eq("trip_uuid", tripId);
    if (item.entry.updated_at) request = request.eq("updated_at", item.entry.updated_at);
    const { data, error } = await request.select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("JOURNAL_SYNC_CONFLICT");
  }

  async function syncCreate(item: JournalQueueItem) {
    const files = item.files ?? [];
    validateQueuedFiles(files);
    const db = (supabase as any).from("trip_journal_entries");
    const existing = await db.select("id").eq("id", item.entry.id).eq("trip_uuid", tripId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const { updated_at: _updatedAt, photo_sizes: _sizes, ...entry } = item.entry;
      const inserted = await db.insert({ ...entry, trip_uuid: tripId, photo_paths: [], photo_captions: {} });
      if (inserted.error) throw inserted.error;
    }

    const paths: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${tripId}/${item.entry.id}/${index + 1}-${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from("trip-journal").upload(path, file, { contentType: file.type });
        if (upload.error) throw upload.error;
        paths.push(path);
      }
      if (paths.length) {
        const photo_captions = Object.fromEntries(paths.map((path, index) => [path, item.entry.photo_captions[`offline:${index}`] ?? ""]));
        const photo_sizes = Object.fromEntries(paths.map((path, index) => [path, files[index]?.size ?? 0]));
        const update = await db.update({ photo_paths: paths, photo_captions, photo_sizes, updated_at: new Date().toISOString() })
          .eq("id", item.entry.id).eq("trip_uuid", tripId);
        if (update.error) throw update.error;
      }
    } catch (error) {
      if (paths.length) await supabase.storage.from("trip-journal").remove(paths);
      throw error;
    }
  }

  async function sync() {
    setBusy(true);
    try {
      for (const item of queue) {
        if (item.kind === "delete") await syncDelete(item);
        else if (item.kind === "update") await syncUpdate(item);
        else await syncCreate(item);
        await removeJournalQueueItem(item.id);
      }
      await refresh();
      await refetch();
      toast.success(text("Offline wijzigingen gesynchroniseerd.", "Offline changes synced."));
    } catch (error) {
      toast.error(error instanceof Error && error.message === "JOURNAL_SYNC_CONFLICT"
        ? text("De online herinnering is intussen gewijzigd. De offline wijziging blijft in de wachtrij totdat je het conflict controleert.", "The online memory changed in the meantime. The offline change stays queued until you review the conflict.")
        : text("Synchronisatie gestopt. De resterende wijzigingen blijven veilig in de wachtrij.", "Sync stopped. Remaining changes stay safely queued."));
    } finally {
      setBusy(false);
    }
  }

  const online = typeof navigator === "undefined" || navigator.onLine;
  return <Card className="surface"><CardContent className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{text("Offline dagboek", "Offline journal")}</strong><p className="text-xs text-muted-foreground">{text("Herinneringen worden lokaal bewaard. Kies alleen de foto's die je echt offline nodig hebt.", "Memories are stored locally. Select only the photos you actually need offline.")}</p></div><span className="text-xs">{(bytes / 1024 / 1024).toFixed(1)} MB · {queue.length} {text("in wachtrij", "queued")}</span></div>
    <div className="max-h-44 space-y-1 overflow-y-auto">{entries.flatMap((entry) => entry.photoItems.map((photo) => <label key={photo.path} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.includes(photo.path)} onChange={(event) => setSelected(event.target.checked ? [...selected, photo.path] : selected.filter((path) => path !== photo.path))}/><span className="truncate">{entry.title} · {entry.photo_captions[photo.path] || text("foto zonder bijschrift", "photo without caption")}</span></label>))}</div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void cache()}><CloudDownload className="size-4"/>{text("Offline bewaren", "Save offline")}</Button>{queue.length > 0 && <Button disabled={busy || !online} onClick={() => void sync()}><RefreshCw className="size-4"/>{text("Wachtrij synchroniseren", "Sync queue")}</Button>}{(bytes > 0 || queue.length > 0) && <Button variant="ghost" disabled={busy} onClick={() => void clearLocal()}><Trash2 className="size-4"/>{text("Offline verwijderen", "Remove offline")}</Button>}</div>
    {!online && offlineEntries.length > 0 && <div className="space-y-3 border-t pt-3">{offlineEntries.map((entry) => <article key={entry.id} className="rounded-xl bg-muted/30 p-3"><small>{entry.entry_date}{entry.location_name ? ` · ${entry.location_name}` : ""}</small><strong className="block">{entry.title}</strong><p className="whitespace-pre-wrap text-sm">{entry.body}</p>{entry.urls.length > 0 && <div className="mt-2 flex gap-2">{entry.urls.map((url) => <img key={url} src={url} alt="" className="size-20 rounded-lg object-cover"/>)}</div>}</article>)}</div>}
  </CardContent></Card>;
}
