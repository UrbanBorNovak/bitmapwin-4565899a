import { useEffect, useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { GUARDIAN_MASTER_DELEGATE_ID, DELEGATE_CONTENT_TYPE, TRIBUTE_ADDRESS, TRIBUTE_SATS, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { ShadowInscriber, type ArtifactVariant } from "@/components/territory/ShadowInscriber";
import { ShieldedGuardianMint } from "@/components/bitmon/ShieldedGuardianMint";
import { RARITY_TONE, bip21, guardianArtifactSvg, guardianLevel, guardianShieldDigest, GUARDIAN_PRICE_SATS, type GuardianDna } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { guardianArtifactHtml, guardianHoloCardSvg } from "@/lib/guardian-artifact";

import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { checkSummonOrderFn, createSummonOrderFn, resumeSummonOrderFn } from "@/lib/bitmon.functions";
import type { SummonOrder } from "@/lib/bitmon.server";
import { playSfx } from "@/lib/world-audio";

export function GuardianTurntable({ dna, className = "h-56" }: { dna: Pick<GuardianDna, "species" | "rarity" | "body" | "accent"> & { height?: number }; className?: string }) {
  return (
    <div className={`${className} w-full border border-border bg-background`}>
      <ClientOnly fallback={<div className="grid size-full place-items-center font-mono text-[10px] text-muted-foreground">LOADING…</div>}>
        <SafeCanvas dpr={[1, 1.5]} camera={{ position: [2.4, 1.9, 2.8], fov: 38 }} gl={{ powerPreference: "low-power" }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 2]} intensity={1.4} />
          <pointLight position={[0, 1, 2]} intensity={0.6} color={dna.accent} />
          <group position={[0, -0.8, 0]}>
            <GuardianBody species={dna.species} rarity={dna.rarity} body={dna.body} accent={dna.accent} height={dna.height} />
            <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.2, 32]} /><meshStandardMaterial color="#111" /></mesh>
          </group>
          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.6} minDistance={2} maxDistance={6} />
        </SafeCanvas>
      </ClientOnly>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="border border-border px-2 py-1.5">
      <p className="font-mono text-[9px] text-muted-foreground">{k}</p>
      <p className="font-mono text-sm text-foreground">{v}</p>
    </div>
  );
}

export function SummonGuardianDialog({ height, open, onOpenChange }: { height: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const dna = useQuery({ ...guardianDnaQuery(height), enabled: open });
  const awake = useQuery({ ...guardianQuery(height), enabled: open });
  const createOrder = useServerFn(createSummonOrderFn);
  const checkOrder = useServerFn(checkSummonOrderFn);
  const resumeOrder = useServerFn(resumeSummonOrderFn);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [order, setOrder] = useState<SummonOrder | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [mintMode, setMintMode] = useState<"public" | "shielded">("shielded");

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, [open]);

  // If this player already has an open invoice (paid or unpaid), pick up where
  // they left off instead of offering a fresh summon.
  useEffect(() => {
    if (!open || signedIn !== true || order || awake.data) return;
    resumeOrder({ data: { height } })
      .then((existing) => {
        if (existing) setOrder(existing);
      })
      .catch(() => {
        /* no session or network hiccup — the summon button still works */
      });
  }, [open, signedIn, order, awake.data, resumeOrder, height]);

  useEffect(() => {
    if (!order) return setQr(null);
    // qrcode pulls in pngjs (Node streams) and crashes SSR at module load —
    // load it only in the browser, inside this effect.
    let alive = true;
    import("qrcode")
      .then((m) => m.default.toDataURL(bip21(order.payTo, order.amountSats, `GUARDIAN ${height}`), { margin: 1, width: 240 }))
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [order, height]);

  useEffect(() => {
    if (!open || !order || order.status === "settled" || order.status === "expired" || order.status === "taken") return;
    const tick = async () => {
      try {
        const res = await checkOrder({ data: { orderId: order.id } });
        if (res.order) setOrder(res.order);
        if (res.awakened) {
          setCelebrate(true);
          playSfx("levelup");
          qc.invalidateQueries({ queryKey: ["guardian", height] });
          qc.invalidateQueries({ queryKey: ["guardians", "all"] });
        }
      } catch {
        /* network hiccup — keep polling */
      }
    };
    const id = window.setInterval(tick, 15_000);
    void tick();
    return () => window.clearInterval(id);
  }, [open, order, checkOrder, qc, height]);

  const start = async () => {
    setBusy(true);
    setDenied(null);
    try {
      const res = await createOrder({ data: { height } });
      if (res.denied) setDenied(res.denied);
      else setOrder(res.order);
    } catch (e) {
      setDenied(e instanceof Error ? e.message : "COULD NOT START THE SUMMON");
    } finally {
      setBusy(false);
    }
  };

  const d = dna.data;
  const already = awake.data;
  const summonTxid = already?.txid ?? (celebrate ? order?.txid : null);
  const guardianArtifact = d && summonTxid ? guardianArtifactSvg(d, summonTxid) : null;
  const guardianDigest = d && summonTxid ? guardianShieldDigest(d, summonTxid) : null;
  const artifactVariants: ArtifactVariant[] | null =
    d && summonTxid
      ? [
          {
            key: "live",
            label: "◆ LIVE 3D ARTIFACT",
            contentType: "text/html;charset=utf-8",
            source: guardianArtifactHtml(d, summonTxid),
            note: "A LIVING VOXEL GUARDIAN YOU CAN SPIN, DRAWN BY ITS OWN CODE AND ON-CHAIN NOISE LIBRARY",
          },
          {
            key: "holo",
            label: "◇ HOLOGRAM CARD",
            contentType: "image/svg+xml",
            source: guardianHoloCardSvg(d, summonTxid),
            note: "A STILL HOLOGRAPHIC CARD THAT SHOWS UP EVERYWHERE, EVEN IN BASIC VIEWERS",
          },
          ...(GUARDIAN_MASTER_DELEGATE_ID
            ? [
                {
                  key: "delegate",
                  label: "◈ TINY DELEGATE MINT",
                  contentType: DELEGATE_CONTENT_TYPE,
                  source: guardianMasterGeneratorHtml(),
                  delegate: GUARDIAN_MASTER_DELEGATE_ID,
                  tribute: { address: TRIBUTE_ADDRESS, sats: TRIBUTE_SATS },
                  note: `ALMOST ZERO BYTES: DRAWN BY THE MASTER GENERATOR, WHICH CHECKS ITS BITMAP PARENT AND A ${TRIBUTE_SATS.toLocaleString()}-SAT TRIBUTE INSIDE THIS SAME TRANSACTION`,
                },
              ]
            : []),
        ]
      : null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-widest">
            {celebrate ? "GUARDIAN AWAKENED" : `BLOCK-DNA GUARDIAN · ${height}.BITMAP`}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            Read from this block's real hash, transactions, size and era. The same block always makes the same Guardian.
          </DialogDescription>
        </DialogHeader>

        {dna.isError ? <p className="font-mono text-xs text-destructive">COULD NOT READ THIS BLOCK FROM THE BITCOIN NETWORK.</p> : null}
        {!d ? <p className="font-mono text-xs text-signal">READING BLOCK DNA…</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={celebrate ? "animate-pulse" : ""}>
              <GuardianTurntable dna={d} />
            </div>
            <div className="space-y-3">
              <div>
                <p className={`font-mono text-[11px] ${RARITY_TONE[d.rarity]}`}>{d.rarity} · ERA {d.epoch}</p>
                <p className="font-display text-2xl text-foreground">{morphFromDna(d).name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{d.species} LINE · {morphFromDna(d).plan} · {morphFromDna(d).code}</p>
                <p className="font-mono text-[11px] text-signal">ABILITY · {d.ability}</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <Stat k="HP" v={d.hp} /><Stat k="BITE" v={d.bite} /><Stat k="SPEED" v={d.speed} /><Stat k="ARMOR" v={d.armor} />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">LEVEL {guardianLevel(d)} · DNA {d.dnaHash}</p>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-4">
          {already || celebrate ? (
            <div className="space-y-2">
              <p className="font-mono text-xs text-bitcoin">THIS GUARDIAN IS AWAKE AND PATROLS {height}.BITMAP IN THE OASIS.</p>
              {already ? <p className="font-mono text-[10px] text-muted-foreground">SUMMONED BY {already.owner.slice(0, 8)}…{already.owner.slice(-6)} · TX {already.txid.slice(0, 10)}…</p> : null}
              <Link to="/oasis" search={{ height }} className="inline-block border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background">SEE IT IN THE OASIS →</Link>
              {guardianArtifact && guardianDigest ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMintMode("public")}
                      className={`flex-1 border px-2 py-1.5 font-mono text-[10px] ${mintMode === "public" ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
                      ◆ TO MY WALLET
                    </button>
                    <button type="button" onClick={() => setMintMode("shielded")}
                      className={`flex-1 border px-2 py-1.5 font-mono text-[10px] ${mintMode === "shielded" ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>
                      ◈ STRAIGHT INTO THE SHIELDED POOL
                    </button>
                  </div>
                  {mintMode === "public" ? (
                    <ShadowInscriber
                      slug={`guardian-${height}`}
                      height={height}
                      index={0}
                      digest={guardianDigest}
                      artifactSvg={guardianArtifact}
                      {...(artifactVariants ? { artifactVariants } : {})}
                      artifactLabel="GUARDIAN ORDINAL"
                      actionLabel="◆ INSCRIBE THIS GUARDIAN"
                      description="THE GUARDIAN IS ALREADY SUMMONED. THIS OPTIONAL SECOND STEP PAYS THE LIVE BITCOIN MINER COST FOR A PUBLIC ORDINAL THAT CONTAINS NO WALLET OR ACCOUNT IDENTITY. THE INSCRIBED SAT LANDS IN YOUR OWN WALLET."
                      allowUpload={false}
                      claimParentsForHeight={height}

                    />
                  ) : (
                    <ShieldedGuardianMint height={height} digest={guardianDigest} artifactSvg={guardianArtifact} {...(artifactVariants ? { artifactVariants } : {})} />

                  )}
                </div>
              ) : null}
            </div>
          ) : order ? (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              {qr ? <img src={qr} alt="Bitcoin payment QR code" className="size-44 bg-foreground p-1" /> : <div className="size-44 border border-border" />}
              <div className="space-y-2 font-mono text-[11px]">
                <p className="text-muted-foreground">SEND EXACTLY</p>
                <p className="text-xl text-bitcoin">{order.amountSats.toLocaleString()} SATS</p>
                <p className="break-all text-foreground">{order.payTo}</p>
                <p className="text-muted-foreground">
                  {GUARDIAN_PRICE_SATS.toLocaleString()} SUMMON + {(order.amountSats - GUARDIAN_PRICE_SATS).toLocaleString()} ID SATS · 100% TO THE BITMAPWIN TREASURY · NETWORK FEE PAID BY YOUR WALLET
                </p>
                <button type="button" className="border border-border px-2 py-1 hover:border-signal" onClick={() => navigator.clipboard?.writeText(order.payTo)}>COPY ADDRESS</button>
                <p className={order.status === "seen" ? "text-signal" : "text-muted-foreground"}>
                  {order.status === "pending" && "WATCHING THE BLOCKCHAIN FOR YOUR PAYMENT…"}
                  {order.status === "seen" && "PAYMENT SEEN · AWAKENS AFTER 1 CONFIRMATION"}
                  {order.status === "expired" && "INVOICE EXPIRED — START AGAIN"}
                  {order.status === "taken" && "ANOTHER SUMMON LANDED FIRST FOR THIS BLOCK."}
                </p>
                {order.status === "pending" || order.status === "seen" ? (
                  <div aria-label="Progress to on-chain confirmation">
                    <div className="h-1.5 w-full overflow-hidden border border-border">
                      <div className={`h-full transition-all duration-700 ${order.status === "seen" ? "w-2/3 bg-signal animate-pulse" : "w-1/3 bg-bitcoin"}`} />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                      <span className="text-bitcoin">INVOICE</span>
                      <span className={order.status === "seen" ? "text-signal" : ""}>MEMPOOL</span>
                      <span>1 CONF · AWAKE</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : signedIn === false ? (
            <Link to="/auth" className="font-mono text-xs text-bitcoin">SIGN IN TO SUMMON →</Link>
          ) : (
            <div className="space-y-2">
              <button type="button" disabled={busy || !d} onClick={start} className="border border-bitcoin bg-bitcoin px-4 py-2 font-mono text-xs text-background disabled:opacity-50">
                {busy ? "CHECKING HOLDER…" : `SUMMON FOR ${GUARDIAN_PRICE_SATS.toLocaleString()} SATS`}
              </button>
              <p className="font-mono text-[10px] text-muted-foreground">ONLY THE VERIFIED HOLDER OF THIS BITMAP CAN SUMMON. ONE GUARDIAN PER BLOCK, EVER.</p>
              {denied ? <p className="font-mono text-[11px] text-destructive">{denied}</p> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SummonGuardianButton({ height, className = "" }: { height: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background ${className}`}>
        ◆ BLOCK-DNA GUARDIAN
      </button>
      {open ? <SummonGuardianDialog height={height} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
