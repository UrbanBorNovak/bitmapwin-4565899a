import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { myGuardiansQuery } from "@/lib/bitmon-queries";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery, guardianDnaQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { onchainGenome } from "@/lib/onchain-guardian";
import { breedPet, breedOdds, petMetadata, PET_SERVICE_FEE, type PetParent } from "@/lib/guardian-genetics";
import { petArtifactHtml } from "@/lib/pet-artifact";
import { DONATION_ADDRESS } from "@/lib/donations";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { PetPortrait } from "@/components/bitmon/PetPortrait";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

export const Route = createFileRoute("/breed")({
  head: () => ({
    meta: [
      { title: "Guardian Breeding Lab — hatch an on-chain pet | bitmapwin" },
      { name: "description", content: "Pair any two inscribed BITMAP Guardians, preview the deterministic offspring and inscribe it as a companion pet for a 546-sat service fee." },
      { property: "og:title", content: "Guardian Breeding Lab — bitmapwin" },
      { property: "og:description", content: "Deterministic Guardian pedigree: two inscribed parents, one verifiable pet inscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { sire?: number | undefined; dam?: number | undefined } => {
    const n = (v: unknown) => (Number(v) > 0 ? Number(v) : undefined);
    return { sire: n(s["sire"]), dam: n(s["dam"]) };
  },
  component: BreedLab,
});

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

function useParent(g: AwakeGuardian | undefined): PetParent | null {
  const q = useQuery({ ...guardianDnaQuery(g?.height ?? 0), enabled: !!g });
  return useMemo(() => (g?.inscriptionId && q.data ? { inscriptionId: g.inscriptionId, height: g.height, genome: onchainGenome(q.data) } : null), [g, q.data]);
}

function Chamber({ title, list, value, onPick, other }: { title: string; list: AwakeGuardian[]; value: AwakeGuardian | undefined; onPick: (h: number) => void; other?: number }) {
  const [q, setQ] = useState("");
  const shown = list.filter((g) => g.height !== other && (!q || String(g.height).includes(q.trim()))).slice(0, 40);
  return (
    <section className="bg-card/60 backdrop-blur rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="label text-primary">{title}</h2>
        {value && <span className="font-mono text-xs text-signal">{value.height}.BITMAP</span>}
      </div>
      {value ? (
        <div className="flex items-center gap-3">
          <GuardianPortrait height={value.height} size={96} />
          <div className="space-y-1 text-xs">
            <p className="font-mono text-muted-foreground">{short(value.inscriptionId!)}</p>
            <p className="label">{value.rarity} · {value.species}</p>
            <button type="button" onClick={() => onPick(-1)} className="label text-muted-foreground hover:text-primary">CHANGE</button>
          </div>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search block height" className="w-full rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-sm" />
          <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
            {shown.map((g) => (
              <button key={g.height} type="button" onClick={() => onPick(g.height)} className="rounded-md border border-border p-1 hover:border-primary">
                <GuardianPortrait height={g.height} size={56} className="mx-auto" />
                <span className="block font-mono text-[10px] text-muted-foreground">{g.height}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="col-span-4 label text-muted-foreground">NO INSCRIBED GUARDIANS MATCH</p>}
          </div>
        </>
      )}
    </section>
  );
}

function tone(f: number, ms: number, type: OscillatorType = "square", vol = 0.04) {
  try {
    const W = window as unknown as { __bwAc?: AudioContext };
    const ac = (W.__bwAc ??= new AudioContext());
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + ms / 1000);
  } catch { /* audio unavailable */ }
}
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
const REEL = ["QUADRUPED", "HEXAPOD", "SERPENT", "BIPED", "AVIAN", "FLOATER", "ARACHNID", "CENTAUR", "MYTHIC", "CHIMERA", "EPIC", "RARE"];

function BreedLab() {
  const search = Route.useSearch();
  const all = useQuery(allGuardiansQuery());
  const roster = useMemo(() => (all.data ?? []).filter((g) => !!g.inscriptionId), [all.data]);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const mine = useQuery(myGuardiansQuery(userId));
  const stable = useMemo(() => (mine.data ?? []).filter((g) => !!g.inscriptionId), [mine.data]);
  const [sireH, setSireH] = useState<number>(search.sire ?? -1);
  const [damH, setDamH] = useState<number>(search.dam ?? -1);
  const [muted, setMuted] = useState(false);
  const [spin, setSpin] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const sireG = roster.find((g) => g.height === sireH), damG = roster.find((g) => g.height === damH);
  const sire = useParent(sireG), dam = useParent(damG);
  const pet = useMemo(() => (sire && dam ? breedPet(sire, dam) : null), [sire, dam]);
  const odds = useMemo(() => (sire && dam ? breedOdds(sire.genome, dam.genome) : null), [sire, dam]);
  const jackpotHit = !!pet && pet.chimera && pet.mutations.includes("RARITY ASCENT");
  const roll = () => {
    if (!pet || spin) return;
    let i = 0;
    const step = () => {
      setSpin(REEL[i % REEL.length]!); if (!muted) tone(300 + (i % 6) * 60, 60);
      i++;
      if (i < 22) timer.current = window.setTimeout(step, 40 + i * 9);
      else {
        setSpin(null);
        if (!muted) (jackpotHit || pet.ra === "MYTHIC" ? [523, 659, 784, 1047] : pet.mutations.length ? [440, 660] : [330]).forEach((f, k) => setTimeout(() => tone(f, 220, "triangle", 0.06), k * 120));
      }
    };
    step();
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const pickStable = (h: number) => { if (sireH < 0) setSireH(h); else if (h !== sireH) setDamH(h); if (!muted) tone(880, 50); };
  const html = useMemo(() => (pet && sire && dam ? petArtifactHtml(pet, sire.inscriptionId, dam.inscriptionId) : ""), [pet, sire, dam]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="label text-signal">GUARDIAN PEDIGREE · OPEN SIRE ROSTER</p>
        <h1 className="font-display text-3xl">Breeding Lab</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick any two inscribed Guardians. Their offspring is worked out from the two inscription ids, so the same pair always hatches the same pet — anyone can check it. Inscribing the pet costs a {PET_SERVICE_FEE}-sat service fee plus the Bitcoin network fee.
        </p>
        <p className="label text-muted-foreground">{roster.length} INSCRIBED GUARDIANS AVAILABLE AS PARENTS</p>
      </header>

      {stable.length > 0 && (
        <section className="bg-card/60 backdrop-blur rounded-lg border border-primary/40 p-3">
          <p className="label text-primary mb-2">YOUR STABLE · {stable.length} INSCRIBED · TAP TO LOAD AS SIRE, THEN DAM</p>
          <div className="flex gap-2 overflow-x-auto">
            {stable.map((g) => (
              <button key={g.height} type="button" onClick={() => pickStable(g.height)} className={`shrink-0 rounded-md border p-1 ${g.height === sireH || g.height === damH ? "border-primary" : "border-border hover:border-primary"}`}>
                <GuardianPortrait height={g.height} size={56} />
                <span className="block font-mono text-[10px] text-muted-foreground">{g.height}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
        <Chamber title="SIRE" list={roster} value={sireG} onPick={setSireH} other={damH} />
        <section className="bg-card/60 backdrop-blur flex flex-col items-center rounded-lg border border-border p-4">
          <h2 className="label self-start text-primary">INCUBATOR</h2>
          {pet ? (
            <>
              <div className="relative">
                <div className={spin ? "opacity-20 blur-sm transition" : "transition"}><PetPortrait genome={pet} size={260} /></div>
                {spin && <p className="absolute inset-0 flex items-center justify-center font-display text-3xl text-primary">{spin}</p>}
              </div>
              {!spin && jackpotHit && <p className="label text-primary animate-pulse">◆ JACKPOT HATCH · CHIMERA + RARITY ASCENT</p>}
              <div className="my-2 flex gap-2">
                <button type="button" onClick={roll} disabled={!!spin} className="rounded-md border border-primary bg-primary px-4 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50">{spin ? "ROLLING…" : "▶ ROLL THE HATCH"}</button>
                <button type="button" onClick={() => setMuted((m) => !m)} className="rounded-md border border-border px-3 py-2 font-mono text-xs text-muted-foreground">{muted ? "SOUND OFF" : "SOUND ON"}</button>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 font-mono text-xs">
                <span className="text-muted-foreground">GENERATION</span><span>GEN {pet.gen}</span>
                <span className="text-muted-foreground">RARITY</span><span>{pet.ra}</span>
                <span className="text-muted-foreground">BODY PLAN</span><span>{pet.sh.toUpperCase()}{pet.chimera ? " · CHIMERA" : ""}</span>
                <span className="text-muted-foreground">WINGS / SPINES</span><span>{pet.wing ? "YES" : "NO"} / {pet.spine ? "YES" : "NO"}</span>
                <span className="text-muted-foreground">PURITY</span><span className="text-signal">{pet.purity}%</span>
              </div>
              {pet.mutations.length > 0 && <p className="mt-2 label text-primary">MUTATIONS: {pet.mutations.join(" · ")}</p>}
            </>
          ) : (
            <p className="my-auto label text-muted-foreground">{all.isLoading ? "LOADING GUARDIANS…" : "CHOOSE A SIRE AND A DAM"}</p>
          )}
        </section>
        <Chamber title="DAM" list={roster} value={damG} onPick={setDamH} other={sireH} />
      </div>

      {odds && (
        <section className="bg-card/60 backdrop-blur rounded-lg border border-border p-4">
          <h2 className="label text-signal mb-2">ODDS BOARD · REAL RULES FOR THIS PAIR</h2>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
            {([["CHIMERA BODY", odds.chimera], ["WINGS", odds.wings], ["SPINES", odds.spines], ["MARKINGS", odds.markings], ["HORN SHIFT", odds.hornShift], ["RARITY ASCENT", odds.rarityAscent]] as const).map(([k, v]) => (
              <div key={k} className="rounded border border-border p-2"><p className="text-muted-foreground">{k}</p><p className="text-signal text-base">{pct(v)}</p></div>
            ))}
            <div className="col-span-2 rounded border border-primary p-2"><p className="text-primary">JACKPOT (CHIMERA + ASCENT)</p><p className="text-primary text-base">{odds.jackpot ? `1 IN ${Math.round(1 / odds.jackpot)}` : "NOT POSSIBLE · BOTH MYTHIC"}</p></div>
          </div>
          <p className="mt-2 label text-muted-foreground">Each pair always hatches the same pet — these odds show how lucky this pair was to get it. Try other pairs to hunt the jackpot.</p>
        </section>
      )}

      {pet && sire && dam && (
        <section className="bg-card/60 backdrop-blur space-y-3 rounded-lg border border-border p-4">
          <h2 className="label text-primary">PEDIGREE</h2>
          <p className="font-mono text-xs text-muted-foreground">
            SIRE {sire.height}.BITMAP ({short(sire.inscriptionId)}) × DAM {dam.height}.BITMAP ({short(dam.inscriptionId)}) → GEN {pet.gen} PET
          </p>
          <div className="font-mono text-xs">
            <p>POSTAGE (THE PET'S OWN SAT) · 546 SATS</p>
            <p>BREEDING SERVICE FEE · {PET_SERVICE_FEE} SATS</p>
            <p className="text-muted-foreground">+ BITCOIN NETWORK FEE (SHOWN BEFORE YOU PAY)</p>
          </div>
          <ShadowInscriber
            key={`${sire.inscriptionId}-${dam.inscriptionId}`}
            slug={`pet-${sire.height}-${dam.height}`}
            height={sire.height}
            index={dam.height}
            digest={`pet:${sire.inscriptionId}:${dam.inscriptionId}`}
            artifactLabel={`GEN ${pet.gen} PET · ${sire.height} × ${dam.height}`}
            actionLabel="INSCRIBE PET ON BITCOIN"
            description="A self-rendering pet inscription. Its metadata names both parents, so its pedigree can be traced on any explorer."
            allowUpload={false}
            artifactVariants={[{
              key: "pet", label: "PET", contentType: "text/html;charset=utf-8", source: html,
              tribute: { address: DONATION_ADDRESS, sats: PET_SERVICE_FEE },
              metadata: petMetadata(sire, dam, pet),
            }]}
          />
        </section>
      )}

      <p className="label text-muted-foreground">
        Parents stay with their holders — breeding only reads their public inscriptions. <Link to="/command" className="text-primary">GUARDIAN COMMAND →</Link>
      </p>
    </main>
  );
}
