import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/auth";
import {
  DEFAULT_WATCH_FLAGS,
  WATCH_FLAG_LABEL,
  myWatchesQuery,
  unwatchBitmap,
  watchBitmap,
  type WatchFlags,
} from "@/lib/watches";

/** Lets a signed-in holder tell the Bitmap Manager to watch this bitmap. */
export function WatchBitmapButton({ height }: { height: number }) {
  const { session } = useAuthSession();
  const enabled = Boolean(session);
  const client = useQueryClient();
  const watches = useQuery(myWatchesQuery(enabled));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watch = useMemo(
    () => (watches.data ?? []).find((w) => w.height === height) ?? null,
    [watches.data, height],
  );
  const flags: WatchFlags = watch?.flags ?? DEFAULT_WATCH_FLAGS;

  const save = useMutation({
    mutationFn: async (next: Partial<WatchFlags> | null) => {
      if (next === null) await unwatchBitmap(height);
      else await watchBitmap(height, next);
    },

    onSuccess: () => {
      setError(null);
      void client.invalidateQueries({ queryKey: ["bitmap-watches"] });
      void client.invalidateQueries({ queryKey: ["portfolio-activity"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!enabled) return null;

  return (
    <div className="border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="label">{watch ? "WATCHING" : "BITMAP MANAGER"}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {watch
              ? `${height}.BITMAP IS IN YOUR PORTFOLIO STREAM`
              : "GET THIS BITMAP'S ACTIVITY IN YOUR DASHBOARD"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-term"
            disabled={save.isPending}
            onClick={() => save.mutate(watch ? null : DEFAULT_WATCH_FLAGS)}
          >
            {save.isPending ? "[ … ]" : watch ? "[ UNWATCH ]" : "[ WATCH ]"}
          </button>
          {watch ? (
            <button type="button" className="btn-term" onClick={() => setOpen((v) => !v)}>
              [ SIGNALS ]
            </button>
          ) : null}
        </div>
      </div>
      {watch && open ? (
        <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(WATCH_FLAG_LABEL) as (keyof WatchFlags)[]).map((k) => (
            <label key={k} className="flex items-center gap-2 font-mono text-[11px]">
              <input
                type="checkbox"
                checked={flags[k]}
                disabled={save.isPending}
                onChange={(e) => save.mutate({ ...flags, [k]: e.target.checked })}
              />
              {WATCH_FLAG_LABEL[k]}
            </label>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="border-t border-border px-4 py-2 font-mono text-[11px] text-destructive">
          &gt; {error.toUpperCase()}
        </p>
      ) : null}
    </div>
  );
}
