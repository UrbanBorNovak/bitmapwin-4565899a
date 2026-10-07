import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RECIPES, setVoxelBag, voxelBag } from "@/lib/voxel-world";
import { craftVoxelFn, forgeToolFn, forgeTradeFn, voxelToolsFn } from "@/lib/voxel-world.functions";
import { FORGE_TRADES, PICKAXES } from "@/lib/voxel-templates";

type Tab = "smelt" | "trade" | "tools";
const fmt = (c: Record<string, number>) => Object.entries(c).map(([k, n]) => `${n} ${k.toUpperCase()}`).join(" + ");

/** BLOCK FORGE — smelt materials, trade blocks at fixed rates, forge pickaxes. All server-checked. */
export function BlockForge({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const bag = voxelBag.items;
  const has = (c: Record<string, number>) => Object.entries(c).every(([k, n]) => (bag?.[k] ?? 0) >= n);

  useEffect(() => { void voxelToolsFn().then((r) => setTools(r.tools)).catch(() => setTools(null)); }, []);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; bag: Record<string, number> } | null>, ok: string) => {
    setBusy(true);
    const r = await fn().catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("SIGN IN TO USE THE FORGE");
    setVoxelBag(r.bag);
    if (r.ok) toast.success(ok, { duration: 1200 });
    else toast.error(r.error ?? "FAILED");
  };

  const row = "flex w-full items-center justify-between gap-2 border px-1.5 py-1 text-left disabled:opacity-50";
  return (
    <div data-no-translate className="hud-panel pointer-events-auto w-[21rem] p-2 font-mono text-[9px]">
      <div className="mb-1 flex items-center gap-1">
        <span className="mr-auto text-[10px] text-bitcoin">⚒ BLOCK FORGE</span>
        {(["tools", "smelt", "trade"] as Tab[]).map((t) => (
          <button key={t} type="button" onPointerDown={(e) => { e.preventDefault(); setTab(t); }}
            className={`border px-1.5 ${tab === t ? "border-bitcoin text-bitcoin" : "border-border text-signal"}`}>{t.toUpperCase()}</button>
        ))}
        <button type="button" aria-label="Close forge" onPointerDown={(e) => { e.preventDefault(); onClose(); }} className="px-1 text-muted-foreground">✕</button>
      </div>
      <div className="grid gap-1">
        {tab === "tools" && PICKAXES.map((p) => {
          const owned = tools?.includes(p.id);
          return (
            <button key={p.id} type="button" disabled={busy || owned || !has(p.cost)}
              onPointerDown={(e) => { e.preventDefault(); void run(async () => { const r = await forgeToolFn({ data: { tool: p.id } }); if (r.ok) setTools((t) => [...(t ?? []), p.id]); return r; }, `FORGED ${p.name}`); }}
              className={`${row} ${owned ? "border-signal" : has(p.cost) ? "border-bitcoin" : "border-border"}`}>
              <span><span className="text-foreground">⛏ {p.name}</span><br /><span className="text-muted-foreground">{p.perk}</span></span>
              <span className={owned ? "text-signal" : "text-foreground"}>{owned ? "OWNED" : fmt(p.cost)}</span>
            </button>
          );
        })}
        {tab === "smelt" && RECIPES.map((r) => (
          <button key={r.out} type="button" disabled={busy || !has(r.cost as Record<string, number>)}
            onPointerDown={(e) => { e.preventDefault(); void run(() => craftVoxelFn({ data: { out: r.out } }), `SMELTED ${r.out.toUpperCase()}`); }}
            className={`${row} ${has(r.cost as Record<string, number>) ? "border-bitcoin" : "border-border"}`}>
            <span className="text-foreground">{r.qty}× {r.out.toUpperCase()}</span><span>{fmt(r.cost as Record<string, number>)}</span>
          </button>
        ))}
        {tab === "trade" && FORGE_TRADES.map((t) => (
          <button key={t.id} type="button" disabled={busy || !has(t.give)}
            onPointerDown={(e) => { e.preventDefault(); void run(() => forgeTradeFn({ data: { offer: t.id } }), `TRADED FOR ${t.n} ${t.get.toUpperCase()}`); }}
            className={`${row} ${has(t.give) ? "border-bitcoin" : "border-border"}`}>
            <span>{fmt(t.give)}</span><span className="text-foreground">→ {t.n}× {t.get.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 text-muted-foreground">{bag ? "BETTER PICKAXES GATHER FASTER AND YIELD MORE" : "SIGN IN TO GET A BLOCK BAG"}</p>
    </div>
  );
}
