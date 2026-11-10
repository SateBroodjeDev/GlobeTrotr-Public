/** Public state only. Match freshness to the shell's existing ten-second poll.
 * A newly mounted login view can reuse that response instead of repeating it.
 * Explicit invalidation and refresh still fetch immediately. No shared HTTP cache.
 */
export function maintenanceQueryOptions<T>(load: () => Promise<T>) {
  return {
    queryKey: ["public-maintenance"] as const,
    queryFn: load,
    staleTime: 10_000,
  };
}
