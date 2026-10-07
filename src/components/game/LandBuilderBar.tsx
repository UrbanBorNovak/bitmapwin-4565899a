import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Hammer, Link2, MapPin } from "lucide-react";
import { setSpawnPoint } from "@/lib/land-spawn.functions";

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
      <button type="button" className={btn} onClick={setSpawn} disabled={busy}>
        <MapPin className="size-3" /> SET SPAWN
      </button>
      <button type="button" className={btn} onClick={share}>
        <Link2 className="size-3" /> SHARE
      </button>
    </div>
  );
}
