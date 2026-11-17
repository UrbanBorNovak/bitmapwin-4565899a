import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TxStatusLink } from "@/components/bounty/TxStatusLink";

const STX_KEY = "bitmap.stake-pilot.stx";
const client = () => import("@/lib/bounty-client");
const fmt = (n: number) => n.toLocaleString("en-US");
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export type BuildRef = { label: string; id: string };

/**
 * Land Forge drawer: open Builder Bounties (BW-BOUNTY-1, Stacks testnet), read
 * live from the contract. A builder answers with an inscription id: the
 * BITMAP's verified on-chain build, one inscribed this session, or a pasted id.
 */
export function BountiesDrawer({ height, refs, onOpenBitmap }: { height: number | null; refs: BuildRef[]; onOpenBitmap: (h: number) => void }) {
  const [open, setOpen] = useState(false);
  const [stx, setStx] = useState("");
  const [onlyHere, setOnlyHere] = useState(false);
  useEffect(() => { setStx(localStorage.getItem(STX_KEY) ?? ""); }, [open]);
  const q = useQuery({ queryKey: ["bounties"], queryFn: async () => (await client()).readBounties(), enabled: open, refetchInterval: open ? 30_000 : false });
  const [list, setList] = useState<import("@/lib/bounty-client").Bounty[]>([]);
  useEffect(() => {
    if (!q.data) return;
    void client().then((c) => setList(c.answerableBounties(q.data.bounties, q.data.burnHeight, height, stx)));
  }, [q.data, height, stx]);
  const shown = useMemo(() => (onlyHere && height !== null ? list.filter((b) => b.height === height) : list), [list, onlyHere, height]);
  const hereCount = height === null ? 0 : list.filter((b) => b.height === height).length;

  const connect = async () => {
    try { const { connectStacksTestnet } = await import("@/lib/stacks-pilot-client"); const a = await connectStacksTestnet(); setStx(a); localStorage.setItem(STX_KEY, a); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" data-testid="forge-bounties" className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">◎ BOUNTIES</button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto font-mono sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display">ACTIVE BOUNTIES</SheetTitle></SheetHeader>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Build requests with test sBTC locked in an open escrow on Stacks testnet. No real value. You answer with an inscription id; only the poster can pay you, and the contract does not judge the work.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
          {stx ? <span className="text-muted-foreground">WALLET {short(stx)}</span> : <button type="button" onClick={connect} className="rounded bg-primary px-2 py-1 text-primary-foreground">CONNECT STACKS TESTNET WALLET</button>}
          {height !== null && (
            <label className="flex items-center gap-1 text-muted-foreground">
              <input type="checkbox" checked={onlyHere} onChange={(e) => setOnlyHere(e.target.checked)} /> ONLY {height}.BITMAP ({hereCount})
            </label>
          )}
          <button type="button" onClick={() => q.refetch()} className="ml-auto text-muted-foreground hover:text-foreground">{q.isFetching ? "READING…" : "REFRESH"}</button>
        </div>

        <div className="mt-3 space-y-3">
          {q.isError && <p className="text-[11px] text-destructive">Could not read the testnet contract. <button type="button" className="underline" onClick={() => q.refetch()}>Try again</button></p>}
          {q.isLoading && <p className="text-[11px] text-muted-foreground">Reading the contract…</p>}
          {q.data && stx && (() => { const own = q.data.bounties.filter((b) => b.poster === stx && b.status === "open").length; return own > 0 ? <p className="text-[10px] text-muted-foreground">{own} OF YOUR OWN BOUNTIES {own === 1 ? "IS" : "ARE"} HIDDEN · THE CONTRACT ONLY ACCEPTS BUILDS FROM A DIFFERENT STACKS ACCOUNT</p> : null; })()}
          {q.data && shown.length === 0 && <p className="text-[11px] text-muted-foreground">No open bounties{onlyHere ? " on this BITMAP" : ""} right now.</p>}
          {q.data && shown.map((b) => (
            <BountyRow key={b.id} b={b} tip={q.data.burnHeight} here={b.height === height} stx={stx} refs={refs} onConfirmed={() => void q.refetch()}
              onOpen={() => { onOpenBitmap(b.height); toast.success(`OPENED ${b.height}.BITMAP · BUILD FOR BOUNTY #${b.id}`); }} />
          ))}
        </div>
        <Link to="/bounties" className="mt-4 block text-[10px] text-signal hover:underline">ALL BOUNTIES · POST YOUR OWN →</Link>
      </SheetContent>
    </Sheet>
  );
}

function BountyRow({ b, tip, here, stx, refs, onOpen, onConfirmed }: { b: import("@/lib/bounty-client").Bounty; tip: number; here: boolean; stx: string; refs: BuildRef[]; onOpen: () => void; onConfirmed: () => void }) {
  const [ref, setRef] = useState("");
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  useEffect(() => { void client().then((c) => setValid(c.isInscriptionRef(ref))); }, [ref]);
  const mine = b.submissions.find((s) => s.builder === stx);

  const submit = async () => {
    setBusy(true);
    try { const t = await (await client()).submitWork(b.id, ref); setTxid(t); toast.success(`SIGNED · SUBMISSION TO BOUNTY #${b.id} CONFIRMS IN THE NEXT TESTNET BLOCK`); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <article className={`rounded border p-3 text-[11px] ${here ? "border-primary/70" : "border-border"} bg-card/40`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">#{b.id} · {b.height}.BITMAP{here ? " · OPEN NOW" : ""}</span>
        <span className="text-primary">{fmt(b.amount)} TEST SATS</span>
      </div>
      <p className="mt-1 font-sans text-sm text-foreground">{b.title}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">~{fmt(Math.max(b.deadline - tip, 0))} blocks left · {b.submissions.length} submitted · by {short(b.poster)}</p>
      {mine && <p className="mt-1 text-[10px] text-signal">YOU SUBMITTED {mine.ref.slice(0, 10)}… · SUBMITTING AGAIN REPLACES IT</p>}
      {!here && <button type="button" onClick={onOpen} className="mt-2 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted">OPEN {b.height}.BITMAP IN FORGE</button>}
      {stx && (
        <div className="mt-2 space-y-1.5">
          {refs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {refs.map((r) => (
                <button key={r.id} type="button" onClick={() => setRef(r.id)} className={`rounded border px-2 py-0.5 text-[10px] ${ref === r.id ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>USE {r.label}</button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <input value={ref} onChange={(e) => setRef(e.target.value.trim())} placeholder="Inscription id of your build (…i0)" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[10px]" />
            <button type="button" disabled={!valid || busy} onClick={submit} className="rounded border border-signal/60 px-2 py-1 text-[10px] text-signal disabled:opacity-50">{busy ? "…" : "SUBMIT"}</button>
          </div>
          {refs.length === 0 && <p className="text-[10px] text-muted-foreground">Inscribe your build first (INSCRIBE panel), or paste the id of a build you already inscribed.</p>}
          {txid && <TxStatusLink txid={txid} label="SUBMISSION" className="text-[10px]" onSettled={(o) => { if (o.state === "success") { toast.success(`BUILD SUBMITTED TO BOUNTY #${b.id}`); onConfirmed(); } else toast.error(o.reason ?? "SUBMISSION FAILED"); }} />}
        </div>
      )}
    </article>
  );
}
