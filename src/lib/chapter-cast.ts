/** What a chapter may put on stage, from lookups that can succeed (found / confirmed absent) or fail (unavailable).
 * A failed lookup never casts an asset and never claims the asset is absent. */
export type Lookup<T> = { state: "checking" } | { state: "found"; value: T } | { state: "absent" } | { state: "unavailable" };

export type DirectoryRead<R> = () => PromiseLike<{ data: R | null; error: unknown }>;

/** Turn a directory read into a Lookup: error → unavailable, no row → absent. */
export async function lookup<R, T>(read: DirectoryRead<R>, pick: (row: R) => T | null): Promise<Lookup<T>> {
  try {
    const { data, error } = await read();
    if (error) return { state: "unavailable" };
    if (data == null) return { state: "absent" };
    const v = pick(data);
    return v == null ? { state: "unavailable" } : { state: "found", value: v };
  } catch { return { state: "unavailable" }; }
}

/** Map react-query state for one block into a Lookup (stale data from another block is never used). */
export function fromQuery<T>(q: { isPending: boolean; isError: boolean; data: Lookup<T> | undefined }, forHeight: number, dataHeight: number | undefined): Lookup<T> {
  if (q.isError) return { state: "unavailable" };
  if (q.isPending || !q.data || dataHeight !== forHeight) return { state: "checking" };
  return q.data;
}

export function statusLabel(l: Lookup<unknown>, found: string, absent: string): string {
  return l.state === "checking" ? "CHECKING…" : l.state === "found" ? found : l.state === "absent" ? absent : "UNAVAILABLE · LOOKUP FAILED";
}
