/** Package the current canvas as a boxed community kit; publishing pays 1,000 sats to the site address. */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KitBox } from "@/components/forge/KitBox";
import { KitThumb } from "@/components/forge/KitThumb";
import { DONATION_ADDRESS } from "@/lib/donations";
import { sendBitcoinFromWallet, type ConnectedWallet } from "@/lib/browser-wallet";
import { publishCommunityKitFn } from "@/lib/community-kits.functions";
import { BEHAVIOR_CARDS } from "@/lib/forge-kits";
import { MAX_KIT_BEHAVIORS, tagToBehavior, type TaggedPart, KIT_MAX_BLOCKS, KIT_MIN_BLOCKS, KIT_PUBLISH_SATS, rowToKit, sliceIntoSteps, type CommunityKitRow } from "@/lib/kit-packager";
import type { Kit } from "@/lib/forge-kits";
import type { TplBlock } from "@/lib/voxel-templates";

export function useCommunityKits() {
  return useQuery({
    queryKey: ["community-kits"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("community_kits" as never).select("id, name, tagline, difficulty, maker_address, steps, bags, block_count, behaviors").order("created_at", { ascending: false }).limit(48);
      return ((data ?? []) as unknown as CommunityKitRow[]).map(rowToKit);
    },
  });
}

export function CommunityKitShelf({ kits, activeId, onPick }: { kits: (Kit & { maker: string })[]; activeId: string; onPick: (id: string) => void }) {
  if (!kits.length) return <div className="mt-1 text-[10px] text-muted-foreground">No player kits yet — package your build below to be first.</div>;
  return (
    <div className="mt-1 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      {kits.map((k) => (
        <button key={k.id} type="button" onClick={() => onPick(k.id)} className={`overflow-hidden rounded border text-left ${k.id === activeId ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-accent/60"}`}>
          <div className="relative bg-background/60"><KitThumb bp={k} /><span className="absolute left-1 top-1 rounded bg-background/80 px-1 font-mono text-[9px] text-accent">PLAYER KIT</span></div>
          <div className="px-2 py-1.5">
            <div className="truncate text-xs font-bold text-foreground sm:text-[10px]">{k.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground sm:text-[9px]">{k.steps.length} BAGS · BY {k.maker.slice(0, 6)}…{k.maker.slice(-4)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PackageKit({ blocks, wallet, onPublished }: { blocks: TplBlock[]; wallet: ConnectedWallet | null; onPublished: (id: string) => void }) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [difficulty, setDifficulty] = useState<Kit["difficulty"]>("BUILDER");
  const [bags, setBags] = useState(4);
  const [tags, setTags] = useState<TaggedPart[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const publish = useServerFn(publishCommunityKitFn);
  const qc = useQueryClient();
  const steps = useMemo(() => sliceIntoSteps(blocks, bags), [blocks, bags]);
  const liveTags = useMemo(() => tags.filter((t) => t.step < steps.length), [tags, steps.length]);
  const behaviors = useMemo(() => liveTags.map((t) => tagToBehavior(t, steps)).filter((b): b is NonNullable<typeof b> => !!b), [liveTags, steps]);
  const draft: Kit = useMemo(() => ({
    id: "draft-kit", name: name || "Your Kit", sphere: "community", kit: true, difficulty, story: tagline, tagline: tagline || "Packaged in Land Forge", ages: "ALL AGES",
    behaviors, bags: steps.map((_, i) => i + 1), steps: steps.map((s) => ({ ...s, parts: [] })),
  }), [name, tagline, difficulty, steps, behaviors]);
  const sizeOk = blocks.length >= KIT_MIN_BLOCKS && blocks.length <= KIT_MAX_BLOCKS;
  const ready = sizeOk && name.trim().length >= 3 && !!wallet && !busy;

  const go = async () => {
    if (!wallet) return;
    setBusy(true); setMsg(null);
    try {
      let id = txid;
      if (!id) {
        setMsg("CONFIRM THE 1,000-SAT PAYMENT IN YOUR WALLET…");
        id = await sendBitcoinFromWallet(wallet.provider, DONATION_ADDRESS, KIT_PUBLISH_SATS);
        setTxid(id);
      }
      setMsg("CHECKING YOUR PAYMENT ON BITCOIN…");
      const r = await publish({ data: {
        name: name.trim(), tagline: tagline.trim(), difficulty, address: wallet.ordinalsAddress,
        payers: [...new Set([wallet.paymentAddress, wallet.ordinalsAddress].filter(Boolean))],
        txid: id!, behaviors: liveTags, steps: steps.map((s) => ({ title: s.title, tip: s.tip, blocks: s.blocks.map(({ dx, dy, dz, k }) => ({ dx, dy, dz, k })) })),
      } });
      if (!r.ok) { setMsg(r.error); return; }
      setMsg("PUBLISHED — YOUR KIT IS ON THE PLAYER SHELF");
      setTxid(null);
      await qc.invalidateQueries({ queryKey: ["community-kits"] });
      onPublished(`ck-${r.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase().slice(0, 120) : "PAYMENT CANCELLED");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded border border-primary/50 bg-card/40 p-2 text-[11px]">
      <div className="flex items-center justify-between"><span className="text-primary">PACKAGE AS KIT</span><span className="font-mono text-[10px] text-muted-foreground">{blocks.length} BRICKS</span></div>
      <p className="mt-1 text-[10px] text-muted-foreground">Turn your build into a boxed set with numbered bags. Publishing costs {KIT_PUBLISH_SATS.toLocaleString()} sats, paid to the site.</p>
      <div className="mt-2 grid gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Kit name" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
        <input value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 90))} placeholder="Tagline on the box" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
        <div className="flex gap-1.5">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Kit["difficulty"])} className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs">
            <option>BEGINNER</option><option>BUILDER</option><option>MASTER</option>
          </select>
          <label className="flex flex-1 items-center gap-1 font-mono text-[10px]">BAGS
            <input type="range" min={2} max={8} value={bags} onChange={(e) => setBags(Number(e.target.value))} className="flex-1" /> {steps.length}
          </label>
        </div>
      </div>
      {sizeOk ? (
        <>
          <ol className="mt-2 space-y-0.5 font-mono text-[10px] text-muted-foreground">
            {steps.map((s, i) => <li key={i}><span className="text-primary">BAG {i + 1}</span> · {s.title} · {s.blocks.length} pcs</li>)}
          </ol>
          <div className="mt-2 rounded border border-accent/40 p-1.5">
            <div className="flex items-center justify-between font-mono text-[10px]"><span className="text-accent">MOVING PARTS</span><span className="text-muted-foreground">{liveTags.length}/{MAX_KIT_BEHAVIORS}</span></div>
            {liveTags.map((t, i) => (
              <div key={i} className="mt-1 flex gap-1">
                <select aria-label="Moving part type" value={t.card} onChange={(e) => setTags(liveTags.map((x, j) => j === i ? { ...x, card: e.target.value as TaggedPart["card"] } : x))} className="flex-1 rounded border border-border bg-background px-1 py-1 text-[10px]">
                  {BEHAVIOR_CARDS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select aria-label="Which bag moves" value={t.step} onChange={(e) => setTags(liveTags.map((x, j) => j === i ? { ...x, step: Number(e.target.value) } : x))} className="w-20 rounded border border-border bg-background px-1 py-1 text-[10px]">
                  {steps.map((_, s) => <option key={s} value={s}>BAG {s + 1}</option>)}
                </select>
                <button type="button" aria-label="Remove moving part" onClick={() => setTags(liveTags.filter((_, j) => j !== i))} className="rounded border border-border px-2 text-[10px]">✕</button>
              </div>
            ))}
            {liveTags.length < MAX_KIT_BEHAVIORS && (
              <button type="button" onClick={() => setTags([...liveTags, { card: "sentry_turret", step: steps.length - 1 }])} className="mt-1 w-full rounded border border-dashed border-accent/60 py-1 font-mono text-[10px] text-accent">+ TAG A MOVING PART</button>
            )}
            <p className="mt-1 text-[9px] text-muted-foreground">Shown on the back of the box; it moves once builders finish that bag and press test.</p>
          </div>
          <KitBox key={`${steps.length}-${blocks.length}-${behaviors.length}`} kit={draft} setNo={0} onOpened={() => {}} />
        </>
      ) : <div className="mt-2 text-[10px] text-muted-foreground">Kits need {KIT_MIN_BLOCKS}–{KIT_MAX_BLOCKS.toLocaleString()} bricks on the canvas.</div>}
      <button type="button" disabled={!ready} onClick={go} className="mt-2 w-full rounded bg-primary px-2 py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-40">
        {busy ? "WORKING…" : txid ? "RETRY PUBLISH (ALREADY PAID)" : !wallet ? "CONNECT WALLET TO PUBLISH" : `PAY ${KIT_PUBLISH_SATS.toLocaleString()} SATS & PUBLISH`}
      </button>
      {msg && <div className="mt-1 font-mono text-[10px] text-accent">{msg}</div>}
    </div>
  );
}
