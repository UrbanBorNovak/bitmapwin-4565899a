import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { categoryGlyph, categoryLabel, extendersQuery, type DeployedExtender } from "@/lib/extenders";
import { hostExtenderFn } from "@/lib/extenders.functions";
import { getLandBoostsFn } from "@/lib/land-epoch.functions";
import { HOST_SPLIT } from "@/lib/coins";

/**
 * HOST & EARN — a holder picks one of their BITMAPs and hosts a published
 * community experience on it. The BITMAP never leaves the wallet; ownership
 * is re-checked on the server. Visitor BIT is split holder/creator daily.
 */
export function HostEarnPanel({ heights, deployments }: { heights: number[]; deployments: DeployedExtender[] }) {
  const qc = useQueryClient();
  const [height, setHeight] = useState<number | null>(heights[0] ?? null);
  const catalog = useQuery(extendersQuery({ sort: "trending" }));
  const boostFn = useServerFn(getLandBoostsFn);
  const boosts = useQuery({
    queryKey: ["host-earn-boosts", heights.slice(0, 200)],
    queryFn: () => boostFn({ data: { heights: heights.slice(0, 200) } }),
    enabled: heights.length > 0,
    staleTime: 300_000,
  });
  const boostBy = useMemo(() => new Map((boosts.data?.boosts ?? []).map((b) => [b.height, b])), [boosts.data]);
  const host = useServerFn(hostExtenderFn);
  const hostIt = useMutation({
    mutationFn: (extenderId: string) => host({ data: { extenderId, height: height! } }),
    onSuccess: () => {
      toast.success(`HOSTED ON ${height}.BITMAP — VISITORS NOW EARN YOU BIT`);
      qc.invalidateQueries({ queryKey: ["my-deployments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hostedHere = deployments.filter((d) => d.bitmapHeight === height && d.status === "active");
  const boost = height != null ? boostBy.get(height) : undefined;
  const items = catalog.data ?? [];

  return (
    <section className="mt-10 border border-border">
      <header className="border-b border-border p-5">
        <div className="label text-bitcoin">HOST &amp; EARN</div>
        <h2 className="display mt-2 text-xl md:text-2xl">HOST A COMMUNITY EXPERIENCE ON YOUR LAND</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          No coding and no payment. Pick one of your BITMAPs, pick a published game, arena or gallery, and host it in
          one click. Your BITMAP never leaves your wallet. Every day, visitor BIT from that land is split{" "}
          <span className="text-foreground">{HOST_SPLIT.holderPercent}% to you</span> and {HOST_SPLIT.creatorPercent}% to
          the creator — multiplied by your land's holding boost.
        </p>
      </header>

      <div className="grid gap-px bg-border md:grid-cols-[280px_1fr]">
        <div className="bg-background p-4">
          <div className="label mb-3">1 · PICK YOUR BITMAP</div>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto">
            {heights.map((h) => {
              const b = boostBy.get(h);
              const busy = deployments.some((d) => d.bitmapHeight === h && d.status === "active");
              return (
                <li key={h}>
                  <button
                    type="button"
                    onClick={() => setHeight(h)}
                    className={`flex w-full items-center justify-between border px-3 py-2 text-left font-mono text-[11px] ${
                      h === height ? "border-bitcoin text-bitcoin" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span>{h}.BITMAP</span>
                    <span className="text-muted-foreground">
                      {b ? `${b.label} ×${b.dividend}` : "…"}
                      {busy ? " · HOSTING" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-background p-4">
          {height != null && (
            <div className="mb-4 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
              <Stat k="SELECTED" v={`${height}.BITMAP`} />
              <Stat k="HOLDING TIER" v={boost?.label ?? "…"} />
              <Stat k="VISITOR MULTIPLIER" v={boost ? `×${boost.dividend}` : "…"} />
              <Stat k="NOW HOSTING" v={hostedHere.length ? hostedHere.map((d) => d.name).join(", ") : "NOTHING"} />
            </div>
          )}
          <div className="label mb-3">2 · PICK AN EXPERIENCE TO HOST</div>
          {catalog.isLoading ? (
            <p className="font-mono text-[11px] text-muted-foreground">LOADING PUBLISHED EXPERIENCES…</p>
          ) : items.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">NO PUBLISHED EXPERIENCES YET.</p>
          ) : (
            <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
              {items.map((x) => {
                const already = hostedHere.some((d) => d.extenderId === x.id);
                return (
                  <li key={x.id} className="flex flex-col justify-between gap-3 bg-background p-4">
                    <div>
                      <div className="label">
                        {categoryGlyph(x.category)} {categoryLabel(x.category)}
                      </div>
                      <div className="display mt-1 text-base">{x.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{x.summary}</p>
                    </div>
                    <button
                      type="button"
                      className={already ? "btn-term-ghost" : "btn-term"}
                      disabled={already || height == null || hostIt.isPending}
                      onClick={() => hostIt.mutate(x.id)}
                    >
                      {already ? "[ HOSTED HERE ]" : hostIt.isPending && hostIt.variables === x.id ? "[ HOSTING… ]" : "[ HOST ON THIS LAND ]"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-background p-3">
      <div className="label text-[0.55rem]">{k}</div>
      <div className="mt-1 truncate font-mono text-xs">{v}</div>
    </div>
  );
}
