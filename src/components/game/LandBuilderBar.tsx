import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Hammer, LayoutTemplate, Link2, MapPin } from "lucide-react";
import { setSpawnPoint } from "@/lib/land-spawn.functions";
import { stampTemplateFn } from "@/lib/voxel-world.functions";
import { TEMPLATES, templateCost } from "@/lib/voxel-templates";
import { applyEdit, setVoxelBag, terrainTop, toCell, voxelBag } from "@/lib/voxel-world";

/**
 * LAND BUILDER — shown while a holder stands on their own BITMAP.
 * Opens the build palette, saves the current spot as the land's spawn
 * (server re-checks live ownership) and copies a shareable link.
 */
export function LandBuilderBar({
  height,
  getPose,
  buildOpen,
  onToggleBuild,
  signedIn,
}: {
  height: number;
  getPose: () => { x: number; z: number; yaw: number };
  buildOpen: boolean;
  onToggleBuild: () => void;
  signedIn: boolean;
}) {
  const save = useServerFn(setSpawnPoint);
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/oasis?height=${height}`;

  const setSpawn = async () => {
    if (!signedIn) {
      toast("SIGN IN AND LINK YOUR WALLET TO SET A SPAWN");
      return;
    }
    setBusy(true);
    try {
      const pose = getPose();
      const result = await save({ data: { height, ...pose } });
      if (result.ok) toast(`SPAWN SET ON ${height}.BITMAP`, { description: "VISITORS FROM YOUR LINK ARRIVE HERE" });
      else toast(result.reason ?? "COULD NOT SET SPAWN");
    } catch {
      toast("COULD NOT SET SPAWN");
    } finally {
      setBusy(false);
    }
  };

  const [tplOpen, setTplOpen] = useState(false);
  const stamp = async (id: string) => {
    if (!signedIn) return void toast("SIGN IN AND LINK YOUR WALLET TO BUILD");
    const p = getPose();
    // 3 blocks ahead of you, sitting on the ground
    const x = toCell(p.x) + Math.round(-Math.sin(p.yaw) * 4) - 2;
    const z = toCell(p.z) + Math.round(-Math.cos(p.yaw) * 4) - 2;
    const y = terrainTop(x, z) + 1;
    setBusy(true);
    const r = await stampTemplateFn({ data: { template: id, height, x, y, z } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("COULD NOT BUILD");
    if (r.bag && Object.keys(r.bag).length) setVoxelBag(r.bag);
    if (!r.ok) return void toast.error(r.error);
    for (const b of r.blocks) applyEdit(b.x, b.y, b.z, b.k);
    setTplOpen(false);
    toast.success(`${TEMPLATES.find((t) => t.id === id)?.name} BUILT ON ${height}.BITMAP`);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("LAND LINK COPIED", { description: link });
    } catch {
      toast(link);
    }
  };

  const btn = "flex items-center gap-1 px-2 py-1 hover:text-bitcoin disabled:opacity-50";
  return (
    <div
      data-no-translate
      className="hud-panel absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 px-2 py-1 font-mono text-[10px] text-signal"
      aria-label="Land builder"
    >
      <span className="px-1 text-bitcoin">{height}.BITMAP · YOUR LAND</span>
      <button type="button" className={`${btn} ${buildOpen ? "text-bitcoin" : ""}`} onClick={onToggleBuild}>
        <Hammer className="size-3" /> BUILD
      </button>
      <button type="button" className={`${btn} ${tplOpen ? "text-bitcoin" : ""}`} onClick={() => setTplOpen((v) => !v)}>
        <LayoutTemplate className="size-3" /> TEMPLATES
      </button>
      <button type="button" className={btn} onClick={setSpawn} disabled={busy}>
        <MapPin className="size-3" /> SET SPAWN
      </button>
      <button type="button" className={btn} onClick={share}>
        <Link2 className="size-3" /> SHARE
      </button>
      {tplOpen ? (
        <div className="hud-panel absolute left-1/2 top-full mt-1 grid w-[22rem] -translate-x-1/2 gap-1 p-2">
          {TEMPLATES.map((t) => {
            const cost = templateCost(t);
            const bag = voxelBag.items;
            const can = !bag || Object.entries(cost).every(([k, n]) => (bag[k] ?? 0) >= n);
            return (
              <button key={t.id} type="button" disabled={busy} onClick={() => void stamp(t.id)}
                className={`border p-1.5 text-left ${can ? "border-bitcoin" : "border-border opacity-60"}`}>
                <div className="text-bitcoin">{t.name}</div>
                <div className="text-muted-foreground">{t.blurb}</div>
                <div className="text-[9px] text-foreground">{Object.entries(cost).map(([k, n]) => `${n} ${k.toUpperCase()}${bag ? ` (${bag[k] ?? 0})` : ""}`).join(" · ")}</div>
              </button>
            );
          })}
          <p className="text-[9px] text-muted-foreground">BUILT 4 BLOCKS IN FRONT OF YOU · COST PAID FROM YOUR BLOCK BAG (F9)</p>
        </div>
      ) : null}
    </div>
  );
}
