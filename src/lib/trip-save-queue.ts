export const TRIP_RELOAD_MESSAGE =
  "Deze reis kon niet veilig worden opgeslagen. Kopieer je nog niet opgeslagen invoer en herlaad de pagina voordat je verdergaat.";

/** Serializes snapshots from this tab; never retries an uncertain or rejected write. */
export class TripSaveQueue {
  private tails = new Map<string, Promise<unknown>>();
  private revisions = new Map<string, string>();
  private blocked = new Set<string>();

  isBlocked(id: string) {
    return this.blocked.has(id);
  }

  block(id: string) {
    this.blocked.add(id);
  }

  enqueue<T extends { id: string; revision?: string }, R extends { revision: string }>(
    trip: T,
    save: (snapshot: T) => Promise<R>,
  ): Promise<R> {
    const previous = this.tails.get(trip.id) ?? Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(async () => {
        if (this.blocked.has(trip.id)) throw new Error(TRIP_RELOAD_MESSAGE);
        const revision = this.revisions.get(trip.id) ?? trip.revision;
        try {
          const result = await save({ ...trip, ...(revision ? { revision } : {}) });
          this.revisions.set(trip.id, result.revision);
          return result;
        } catch (error) {
          this.blocked.add(trip.id);
          throw error;
        }
      });
    this.tails.set(trip.id, operation);
    return operation;
  }
}
