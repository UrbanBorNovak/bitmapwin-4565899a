import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { allGuardiansQuery, guardianDnaQuery } from "@/lib/bitmon-queries";
import { onchainGenome } from "@/lib/onchain-guardian";
import { kennelMetadata, kennelPup, KENNEL_MIN_PRICE, KENNEL_SITE_FEE } from "@/lib/kennel";
import { openKennelFn, recordKennelMintFn } from "@/lib/kennel.functions";
import { petArtifactHtml } from "@/lib/pet-artifact";
import { DONATION_ADDRESS } from "@/lib/donations";
import { resolveWallet } from "@/components/BuyButton";
import { PetPortrait } from "@/components/bitmon/PetPortrait";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

export const Route = createFileRoute("/kennels")({
  head: () => ({
    meta: [
      { title: "Guardian Kennels — on-demand pups capped by block tx count | bitmapwin" },
      { name: "description", content: "BITMAP holders open a kennel of Guardian pups capped by their block's transaction count. Buyers mint on demand and pay the holder inside the Bitcoin reveal." },
      { property: "og:title", content: "Guardian Kennels — THE OTHERTHINGS" },
      { property: "og:description", content: "On-demand Guardian pups, supply capped by real block transactions, holder paid on-chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Kennels,
});

type Kennel = { block_height: number; name: string; price_sats: number; max_supply: number; minted_count: number; payout_address: string; is_open: boolean };

const kennelsQuery = { queryKey: ["kennels"], queryFn: async () => {
  const { data } = await supabase.from("bitmap_kennels").select("block_height,name,price_sats,max_supply,minted_count,payout_address,is_open").eq("is_open", true).order("updated_at", { ascending: false }).limit(100);
  return (data ?? []) as Kennel[];
} };

function Kennels() {
  const { data: kennels = [] } = useQuery(kennelsQuery);
  const [pick, setPick] = useState<Kennel | null>(null);
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-accent">THE OTHERTHINGS · KENNELS</p>
        <h1 className="font-display text-3xl font-bold">Guardian Kennels</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Each kennel holds at most as many pups as its block has transactions. Nothing is pre-inscribed: a pup is inscribed only when you pay, and the holder's price is an output of the same Bitcoin transaction.</p>
      </header>
      <OpenKennel />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kennels.length === 0 && <p className="text-sm text-muted-foreground">No kennels open yet.</p>}
        {kennels.map((k) => (
          <button key={k.block_height} onClick={() => setPick(k)} className="rounded-lg border border-border bg-card/60 p-4 text-left backdrop-blur hover:border-primary">
            <p className="font-mono text-xs text-accent">{k.block_height}.BITMAP</p>
            <p className="font-display text-lg font-semibold">{k.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{k.minted_count} / {k.max_supply} SUMMONED · {k.price_sats.toLocaleString()} SATS</p>
            <div className="mt-2 h-1 rounded bg-muted"><div className="h-1 rounded bg-primary" style={{ width: `${(k.minted_count / k.max_supply) * 100}%` }} /></div>
          </button>
        ))}
      </section>
      {pick && <MintPup kennel={pick} />}
    </main>
  );
}

function OpenKennel() {
  const open = useServerFn(openKennelFn);
  const qc = useQueryClient();
  const [height, setHeight] = useState(""); const [name, setName] = useState(""); const [price, setPrice] = useState(String(KENNEL_MIN_PRICE * 5));
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const w = await resolveWallet();
      const r = await open({ data: { height: Number(height), name, priceSats: Number(price), address: w.ordinalsAddress, payoutAddress: w.paymentAddress || w.ordinalsAddress, isOpen: true } });
      if (!r.ok) toast.error(r.error); else { toast.success(`Kennel open · ${r.supply} pups max`); qc.invalidateQueries({ queryKey: ["kennels"] }); }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4 backdrop-blur">
      <p className="font-mono text-xs tracking-widest text-primary">OPEN YOUR KENNEL</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="rounded border border-border bg-background px-3 py-2 text-sm" placeholder="BITMAP height" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} />
        <input className="rounded border border-border bg-background px-3 py-2 text-sm" placeholder="Kennel name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border border-border bg-background px-3 py-2 text-sm" placeholder="Price (sats)" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <button disabled={busy || !height || name.trim().length < 3} onClick={go} className="rounded bg-primary px-3 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50">{busy ? "VERIFYING…" : "OPEN KENNEL"}</button>
      </div>
      <p className="text-xs text-muted-foreground">Requires a verified wallet that holds the BITMAP and an awake Guardian. Supply = the block's transaction count. Payouts go to your connected payment address.</p>
    </section>
  );
}

function MintPup({ kennel }: { kennel: Kennel }) {
  const h = kennel.block_height;
  const dna = useQuery(guardianDnaQuery(h));
  const { data: guardians = [] } = useQuery(allGuardiansQuery());
  const { data: taken = [] } = useQuery({ queryKey: ["kennel-mints", h], queryFn: async () => {
    const { data } = await supabase.from("kennel_mints").select("child_index").eq("block_height", h);
    return (data ?? []).map((r) => r.child_index);
  } });
  const record = useServerFn(recordKennelMintFn);
  const qc = useQueryClient();
  const next = useMemo(() => { const s = new Set(taken); for (let i = 0; i < kennel.max_supply; i++) if (!s.has(i)) return i; return -1; }, [taken, kennel.max_supply]);
  const [index, setIndex] = useState<number | null>(null);
  const idx = index ?? next;
  const parentId = guardians.find((g) => g.height === h)?.inscriptionId ?? null;
  const pup = useMemo(() => (dna.data && idx >= 0 ? kennelPup(onchainGenome(dna.data), h, idx) : null), [dna.data, h, idx]);
  const [done, setDone] = useState<string | null>(null);
  if (next < 0) return <p className="font-mono text-sm text-muted-foreground">SOLD OUT — ALL {kennel.max_supply} PUPS SUMMONED.</p>;
  return (
    <section className="grid gap-6 rounded-lg border border-border bg-card/60 p-4 backdrop-blur md:grid-cols-2">
      <div className="space-y-3">
        <p className="font-mono text-xs text-accent">{h}.BITMAP · PUP #{idx}</p>
        {pup ? <PetPortrait genome={pup} size={280} /> : <p className="text-sm text-muted-foreground">Reading block DNA…</p>}
        <label className="block font-mono text-xs text-muted-foreground">PUP NUMBER (0–{kennel.max_supply - 1})
          <input className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm" value={idx} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); if (n < kennel.max_supply && !taken.includes(n)) setIndex(n); }} />
        </label>
        {pup && <p className="font-mono text-xs text-muted-foreground">{pup.sh.toUpperCase()} · {pup.ra}{pup.mutations.length ? ` · ${pup.mutations.join(", ")}` : ""}</p>}
        <p className="text-xs text-muted-foreground">You pay {kennel.price_sats.toLocaleString()} sats to the holder + {KENNEL_SITE_FEE} sats site fee + network fee.</p>
      </div>
      <div>
        {done ? (
          <div className="space-y-2">
            <p className="font-display text-xl font-semibold">Welcome, pup #{idx}!</p>
            <a className="font-mono text-xs text-accent underline" href={`https://ordinals.com/inscription/${done}`} target="_blank" rel="noreferrer">VIEW INSCRIPTION</a>
            <p className="text-xs text-muted-foreground">Confirms with the next Bitcoin block.</p>
          </div>
        ) : pup && (
          <ShadowInscriber
            key={`${h}-${idx}`}
            slug={`kennel-${h}-${idx}`}
            height={h}
            index={idx}
            digest={`kennel:${h}:${idx}`}
            artifactLabel={`PUP #${idx} · ${h}.BITMAP`}
            actionLabel="SUMMON PUP ON BITCOIN"
            allowUpload={false}
            description="A self-rendering pup whose metadata names its block and number, so anyone can re-derive it."
            onRevealed={async (txid) => {
              setDone(`${txid}i0`);
              const r = await record({ data: { height: h, index: idx, revealTxid: txid } });
              if (!r.ok) toast.error(r.error);
              qc.invalidateQueries({ queryKey: ["kennel-mints", h] }); qc.invalidateQueries({ queryKey: ["kennels"] });
            }}
            artifactVariants={[{
              key: "pup", label: "STANDALONE", contentType: "text/html;charset=utf-8",
              source: petArtifactHtml(pup, parentId ?? `${h}.bitmap`, `kennel:${idx}`),
              tributes: [{ address: kennel.payout_address, sats: kennel.price_sats }, { address: DONATION_ADDRESS, sats: KENNEL_SITE_FEE }],
              metadata: kennelMetadata(h, idx, parentId, pup),
              brotli: true,
            }]}
          />
        )}
        <Link to="/breed" className="mt-4 block font-mono text-xs text-muted-foreground underline">Or breed two Guardians →</Link>
      </div>
    </section>
  );
}
