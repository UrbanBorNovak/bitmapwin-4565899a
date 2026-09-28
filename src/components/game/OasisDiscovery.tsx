import { useEffect, useState, type MutableRefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { atlasPlace } from "@/lib/atlas-places";
import { claimExploreMilestoneFn } from "@/lib/coins.functions";
import { SHRINE_LAYOUT_NAMES, shrineSitesNear } from "@/components/game/ClayShrines";
import {
  markMilestoneClaimed,
  onDiscovery,
  recordDistrict,
  recordRuin,
  useDiscovery,
  type DiscoveryEvent,
} from "@/lib/oasis-discovery";
import { useWalletSession } from "@/lib/wallet-session";
import { playSfx } from "@/lib/world-audio";

type Pose = { height: number; x: number; z: number };

const RARITY_CLASS: Record<string, string> = {
  COMMON: "text-foreground",
  RARE: "text-signal",
  EPIC: "text-bitcoin",
  LEGENDARY: "text-bitcoin",
};

/** Watches where you walk, pays instant finds, and shows the exploration tracker. */
export function OasisDiscovery({ pose, unit, showTracker }: { pose: MutableRefObject<Pose>; unit: number; showTracker: boolean }) {
  const [toasts, setToasts] = useState<DiscoveryEvent[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = pose.current;
      const district = atlasPlace(p.height);
      recordDistrict(district.slug, district.name);
      const reach = unit * 18;
      for (const site of shrineSitesNear(unit, [p.x, p.z], unit * 40, 3)) {
        if ((site.x - p.x) ** 2 + (site.z - p.z) ** 2 <= reach * reach) {
          recordRuin(site.key, site.variant, SHRINE_LAYOUT_NAMES[site.variant] ?? "RUIN");
        }
      }
    }, 800);
    return () => window.clearInterval(id);
  }, [pose, unit]);

  useEffect(
    () =>
      onDiscovery((e) => {
        playSfx(e.kind === "milestone" || (e.kind === "ruin" && e.rarity !== "COMMON") ? "levelup" : "nugget");
        setToasts((t) => [e, ...t].slice(0, 3));
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== e.id)), 3800);
      }),
    [],
  );

  return (
    <>
      <div data-no-translate className="pointer-events-none absolute left-1/2 top-24 z-40 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="hud-panel animate-scale-in px-4 py-2 text-center font-mono">
            <p className="label text-[9px] text-signal">
              {t.kind === "district" ? "DISTRICT UNLOCKED · FAST TRAVEL OPEN" : t.kind === "ruin" ? `${t.rarity} RUIN COLLECTED` : "MILESTONE REACHED"}
            </p>
            <p className={`display text-base ${t.kind === "ruin" ? RARITY_CLASS[t.rarity] : "text-foreground"}`}>{t.name}</p>
            <p className="text-xs text-bitcoin">{t.kind === "milestone" ? `+${t.bit} BIT READY TO CLAIM` : `+${t.xp} EXPLORER XP`}</p>
          </div>
        ))}
      </div>
      {showTracker ? <ExploreTracker /> : null}
    </>
  );
}

function ExploreTracker() {
  const d = useDiscovery();
  const wallet = useWalletSession();
  const claim = useServerFn(claimExploreMilestoneFn);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const ready = d.ready[0];
  const nextDistrict = d.next.find((m) => m.kind === "districts");
  const nextRuin = d.next.find((m) => m.kind === "ruins");

  async function pay() {
    if (!ready) return;
    if (!address) return setNote("CONNECT A VERIFIED WALLET TO CLAIM BIT");
    setBusy(true);
    setNote(null);
    try {
      const r = await claim({ data: { address, milestone: ready.id } });
      if (!r.ok) return setNote(r.error);
      markMilestoneClaimed(ready.id);
      playSfx("levelup");
      setNote(r.already ? "ALREADY PAID" : `+${ready.bit} BIT PAID`);
      void qc.invalidateQueries();
    } catch {
      setNote("SIGN IN AND VERIFY YOUR WALLET TO CLAIM");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-no-translate className="hud-panel absolute left-3 bottom-24 z-30 w-[min(13rem,calc(100%-1.5rem))] px-2.5 py-2 font-mono text-[10px]" aria-label="Exploration">
      <span className="hud-telemetry-title">EXPLORER · {d.xp.toLocaleString("en-US")} XP</span>
      <p className="text-foreground">DISTRICTS {d.districts}{nextDistrict ? ` / ${nextDistrict.goal}` : ""}</p>
      <p className="text-foreground">RUINS {d.ruins}{nextRuin ? ` / ${nextRuin.goal}` : ""}</p>
      <p className="text-muted-foreground">
        <span className="text-signal">{d.byRarity.RARE}R</span> · <span className="text-bitcoin">{d.byRarity.EPIC}E</span> · <span className="text-bitcoin">{d.byRarity.LEGENDARY}L</span>
      </p>
      {ready ? (
        <button type="button" onClick={pay} disabled={busy} className="btn-term mt-2 w-full px-2 py-1 text-[10px]">
          {busy ? "PAYING…" : `CLAIM ${ready.bit} BIT`}
        </button>
      ) : null}
      {note ? <p className="mt-1 text-muted-foreground">{note}</p> : null}
    </div>
  );
}
