import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWalletSession } from "@/lib/wallet-session";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import type { ShordKeys } from "@/lib/shord/keys";
import { decodeShordAddress } from "@/lib/shord/keys";
import { assetIdFromInscription, exitIntent, poolNote, randomField } from "@/lib/shord/pool";
import { proveSpend } from "@/lib/shord/prover";
import {
  decodeNoteGift,
  depositMessage,
  encodeNoteGift,
  loadPoolNotes,
  savePoolNotes,
  type PoolNoteRecord,
} from "@/lib/shord/deposit";
import { shordConfirmDeposit, shordPoolInfo, shordPrepareDeposit, shordSubmitSpend, shordWithdraw, shordRelayerInfo, shordRelayQueued, shordPendingDeposits, shordDirectMints } from "@/lib/shord-pool.functions";

const btn = "label border px-3 py-2 disabled:opacity-40";

export function PoolPanel({ keys }: { keys: ShordKeys | null }) {
  const wallet = useWalletSession();
  const qc = useQueryClient();
  const info = useServerFn(shordPoolInfo);
  const prepare = useServerFn(shordPrepareDeposit);
  const confirm = useServerFn(shordConfirmDeposit);
  const spend = useServerFn(shordSubmitSpend);
  const withdraw = useServerFn(shordWithdraw);
  const relayerInfo = useServerFn(shordRelayerInfo);
  const relayRetry = useServerFn(shordRelayQueued);
  const relayer = useQuery({ queryKey: ["shord", "relayer"], queryFn: () => relayerInfo(), refetchInterval: 60_000 });
  const pendingFn = useServerFn(shordPendingDeposits);
  const pending = useQuery({ queryKey: ["shord", "pending-deposits"], queryFn: () => pendingFn(), refetchInterval: 60_000 });
  const directMintsFn = useServerFn(shordDirectMints);
  const directMints = useQuery({ queryKey: ["shord", "direct-mints"], queryFn: () => directMintsFn(), refetchInterval: 60_000 });
  const [exitTo, setExitTo] = useState<Record<string, string>>({});
  const pool = useQuery({ queryKey: ["shord", "own-pool"], queryFn: () => info(), refetchInterval: 60_000 });

  const [notes, setNotes] = useState<PoolNoteRecord[]>([]);
  const [inscription, setInscription] = useState("");
  const [gift, setGift] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendTo, setSendTo] = useState<Record<string, string>>({});
  const [giftOut, setGiftOut] = useState<string | null>(null);

  useEffect(() => setNotes(loadPoolNotes()), []);
  const persist = (next: PoolNoteRecord[]) => {
    setNotes(next);
    savePoolNotes(next);
  };

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setMsg(label);
    try {
      await fn();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["shord", "own-pool"] });
      void qc.invalidateQueries({ queryKey: ["shord", "relayer"] });
      void qc.invalidateQueries({ queryKey: ["shord", "pending-deposits"] });
      void qc.invalidateQueries({ queryKey: ["shord", "direct-mints"] });
    }
  }

  const startDeposit = () =>
    run("SIGN IN YOUR WALLET…", async () => {
      if (!keys) throw new Error("CREATE A SHIELDED KEY FIRST");
      if (!wallet) throw new Error("CONNECT THE WALLET HOLDING THE GUARDIAN");
      const id = inscription.trim().toLowerCase();
      const assetId = assetIdFromInscription(id);
      const salt = randomField();
      const commitment = poolNote(keys.publicKey, assetId, salt).toString();
      const holder = wallet.ordinalsAddress || wallet.paymentAddress;
      const signature = await signMessageWithWallet(wallet.provider, holder, depositMessage(id, commitment));
      const res = await prepare({ data: { inscriptionId: id, commitment, holderAddress: holder, signature } });
      if (!res.ok) throw new Error(res.reason);
      persist([
        ...loadPoolNotes().filter((n) => !(n.inscriptionId === id && n.status === "awaiting")),
        { inscriptionId: id, assetId: assetId.toString(), salt: salt.toString(), commitment, status: "awaiting" },
      ]);
      setMsg(`✓ SIGNED. NOW SEND THE GUARDIAN FROM YOUR WALLET TO ${res.poolAddress}, THEN PRESS CHECK DEPOSIT.`);
    });


  /** Seals any Guardian already sitting at the pool address, including direct-to-shield mints. */
  const sealAtPool = (inscriptionId: string) =>
    run("CHECKING THE POOL ADDRESS…", async () => {
      const id = inscriptionId.trim().toLowerCase();
      const res = await confirm({ data: { inscriptionId: id } });
      if (!res.ok) {
        // Fallback: this device's note may already be a leaf even if the deposit row is gone.
        const local = loadPoolNotes().find((x) => x.inscriptionId === id);
        const leaf = local ? (await info()).leaves.find((l) => l.commitment === local.commitment) : undefined;
        if (!leaf) throw new Error(res.reason);
        persist(loadPoolNotes().map((x) => (x.inscriptionId === id ? { ...x, status: "shielded", idx: leaf.idx } : x)));
        setMsg(`✓ GUARDIAN SHIELDED AS POOL NOTE #${leaf.idx}`);
        return;
      }
      if ("waiting" in res) return setMsg(res.waiting);
      const mine = loadPoolNotes().find((x) => x.commitment === res.commitment);
      if (mine) {
        persist(loadPoolNotes().map((x) => (x.commitment === res.commitment ? { ...x, status: "shielded", idx: res.idx } : x)));
        setMsg(`✓ GUARDIAN SHIELDED AS POOL NOTE #${res.idx}`);
        return;
      }
      setMsg(
        `✓ SEALED AS POOL NOTE #${res.idx}. THIS BROWSER DOES NOT HOLD THAT NOTE'S KEY, SO IT CANNOT MOVE IT — OPEN THE VAULT ON THE DEVICE THAT MINTED IT.`,
      );
    });



  const sendPrivately = (n: PoolNoteRecord) =>
    run("PROVING ON THIS DEVICE…", async () => {
      if (!keys) throw new Error("CREATE A SHIELDED KEY FIRST");
      const recipient = decodeShordAddress(sendTo[n.commitment] ?? "");
      if (!recipient) throw new Error("ENTER A VALID shord1… ADDRESS");
      const fresh = await info();
      const leaves = fresh.leaves.map((l) => BigInt(l.commitment));
      const idx = leaves.findIndex((l) => l.toString() === n.commitment);
      if (idx < 0) throw new Error("NOTE IS NOT IN THE POOL YET");
      const newSalt = randomField();
      const proof = await proveSpend({
        keys, assetId: BigInt(n.assetId), salt: BigInt(n.salt), leaves, leafIndex: idx,
        recipientPublicKey: recipient, newSalt, exit: false, intent: 1n,
      });
      setMsg("SUBMITTING PROOF TO THE POOL…");
      const res = await spend({ data: { proof: proof.proof as Record<string, unknown>, publicSignals: proof.publicSignals } });
      if (!res.ok) throw new Error(res.reason);
      persist(loadPoolNotes().map((x) => (x.commitment === n.commitment ? { ...x, status: "spent" } : x)));
      setGiftOut(encodeNoteGift({ inscriptionId: n.inscriptionId, assetId: n.assetId, salt: newSalt.toString(), commitment: proof.outCommitment }));
      setMsg(
        res.relay.status === "broadcast"
          ? `✓ SENT PRIVATELY · NEW NOTE #${res.idx} · ANCHORED ON BITCOIN https://mempool.space/tx/${res.relay.txid}. GIVE THE RECIPIENT THE CODE BELOW.`
          : `✓ SENT PRIVATELY · NEW NOTE #${res.idx} · BITCOIN ANCHOR QUEUED (${res.relay.error ?? "WAITING"}). GIVE THE RECIPIENT THE CODE BELOW.`,
      );
    });

  const withdrawNote = (n: PoolNoteRecord) =>
    run("PROVING WITHDRAWAL ON THIS DEVICE…", async () => {
      if (!keys) throw new Error("CREATE A SHIELDED KEY FIRST");
      const dest = (exitTo[n.commitment] ?? wallet?.ordinalsAddress ?? "").trim();
      if (!dest) throw new Error("ENTER THE BITCOIN ADDRESS TO RECEIVE THE GUARDIAN");
      const fresh = await info();
      const leaves = fresh.leaves.map((l) => BigInt(l.commitment));
      const idx = leaves.findIndex((l) => l.toString() === n.commitment);
      if (idx < 0) throw new Error("NOTE IS NOT IN THE POOL YET");
      const proof = await proveSpend({
        keys, assetId: BigInt(n.assetId), salt: BigInt(n.salt), leaves, leafIndex: idx,
        recipientPublicKey: keys.publicKey, newSalt: randomField(), exit: true, intent: exitIntent(dest),
      });
      setMsg("POOL IS CHECKING THE PROOF AND SIGNING…");
      const res = await withdraw({ data: { proof: proof.proof as Record<string, unknown>, publicSignals: proof.publicSignals, destination: dest } });
      if (!res.ok) throw new Error(res.reason);
      persist(loadPoolNotes().map((x) => (x.commitment === n.commitment ? { ...x, status: "spent" } : x)));
      setMsg(`✓ WITHDRAWN TO ${dest} · FEE ${res.feeSats} SATS · https://mempool.space/tx/${res.txid}`);
    });

  const importGift = () =>
    run("CHECKING THE NOTE…", async () => {
      if (!keys) throw new Error("CREATE A SHIELDED KEY FIRST");
      const g = decodeNoteGift(gift);
      if (!g) throw new Error("THAT IS NOT A SHORD NOTE CODE");
      if (poolNote(keys.publicKey, BigInt(g.assetId), BigInt(g.salt)).toString() !== g.commitment)
        throw new Error("THIS NOTE WAS NOT SEALED FOR YOUR KEY");
      const fresh = await info();
      const idx = fresh.leaves.findIndex((l) => l.commitment === g.commitment);
      if (idx < 0) throw new Error("NOTE IS NOT IN THE POOL");
      persist([...loadPoolNotes().filter((x) => x.commitment !== g.commitment), { ...g, status: "shielded", idx }]);
      setGift("");
      setMsg(`✓ RECEIVED POOL NOTE #${idx}`);
    });

  return (
    <section className="border border-border bg-card/60 p-4">
      <p className="label text-signal">STEP 4 · BITMAPWIN SHIELDED POOL</p>
      <h2 className="font-display text-lg text-foreground">SHIELD A GUARDIAN</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Send a Block-DNA Guardian into the pool and it becomes a sealed note only your key can move. BITMAPWIN holds the
        Guardian while it is shielded. Research grade: unaudited, single-party setup.
      </p>
      <p className="label mt-3 break-all text-muted-foreground">
        POOL {pool.data?.poolAddress ?? "…"} · {pool.data?.leaves.length ?? 0} NOTES · {pool.data?.spent ?? 0} SPENT
      </p>
      <div className="mt-3 border border-border p-3">
        <p className="label text-signal">RELAYER · SPONSORS EACH PRIVATE TRANSFER ON BITCOIN</p>
        <p className="label mt-1 break-all text-muted-foreground">
          {relayer.data?.address ?? "…"} · {relayer.data?.sats ?? 0} SATS FOR FEES
        </p>
        {relayer.data?.anchors.length ? (
          <ul className="mt-2 space-y-1">
            {relayer.data.anchors.map((a) => (
              <li key={a.nullifier} className="label break-all">
                {a.relay_status === "broadcast" && a.relay_txid ? (
                  <a className="text-signal" href={`https://mempool.space/tx/${a.relay_txid}`} target="_blank" rel="noreferrer">
                    ✓ ANCHORED {a.relay_txid.slice(0, 16)}… · {a.relay_fee_sats} SATS
                  </a>
                ) : (
                  <span className="text-bitcoin">QUEUED · {a.relay_error ?? "WAITING"}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {relayer.data?.anchors.some((a) => a.relay_status === "queued") ? (
          <button type="button" disabled={busy} className={`${btn} mt-2 border-signal text-signal`}
            onClick={() => run("RETRYING QUEUED ANCHORS…", async () => { await relayRetry(); setMsg("✓ RETRY DONE"); })}>
            RETRY QUEUED ANCHORS
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input value={inscription} onChange={(e) => setInscription(e.target.value)} placeholder="GUARDIAN INSCRIPTION ID …i0"
          className="min-w-[280px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs" />
        <button type="button" disabled={busy || !/^[0-9a-f]{64}i\d+$/i.test(inscription.trim())} onClick={startDeposit}
          className={`${btn} border-bitcoin text-bitcoin`}>SIGN DEPOSIT</button>
        <button type="button" disabled={busy || !/^[0-9a-f]{64}i\d+$/i.test(inscription.trim())} onClick={() => sealAtPool(inscription)}
          className={`${btn} border-signal text-signal`}>CHECK DEPOSIT</button>
      </div>
      <p className="label mt-1 text-muted-foreground">
        SIGN DEPOSIT IS FOR A GUARDIAN IN YOUR OWN WALLET. A DIRECT-TO-SHIELD MINT IS ALREADY AT THE POOL — JUST PRESS CHECK DEPOSIT.
      </p>

      {directMints.data?.length ? (
        <div className="mt-4 border border-bitcoin/40 p-3">
          <p className="label text-bitcoin">MINTED STRAIGHT TO THE POOL · NEVER SAT IN A WALLET</p>
          <ul className="mt-2 space-y-2">
            {directMints.data.map((m) => (
              <li key={m.commitment} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className={m.status === "shielded" ? "text-signal" : "text-bitcoin"}>
                  {m.status === "shielded" ? `◆ SHIELDED · NOTE #${m.idx}` : "◌ AWAITING DEPOSIT"}
                </span>
                <a className="break-all text-muted-foreground underline decoration-dotted"
                  href={`https://ordinals.com/inscription/${m.inscriptionId}`} target="_blank" rel="noreferrer">
                  {m.inscriptionId.slice(0, 20)}…{m.inscriptionId.slice(-3)}
                </a>
                {m.depositTxid ? (
                  <a className="text-muted-foreground underline decoration-dotted"
                    href={`https://mempool.space/tx/${m.depositTxid}`} target="_blank" rel="noreferrer">TX</a>
                ) : null}
                {m.status !== "shielded" ? (
                  <button type="button" disabled={busy} onClick={() => sealAtPool(m.inscriptionId)}
                    className={`${btn} border-signal text-signal`}>CHECK DEPOSIT</button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending.data?.length ? (
        <div className="mt-4 border border-signal/40 p-3">
          <p className="label text-signal">◌ REGISTERED AT THE POOL · NOT SEALED YET</p>
          <ul className="mt-2 space-y-2">
            {pending.data.map((p) => (
              <li key={p.commitment} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="break-all text-muted-foreground">
                  {p.direct ? "DIRECT MINT · " : ""}
                  {p.inscriptionId}
                </span>
                <button type="button" disabled={busy} onClick={() => sealAtPool(p.inscriptionId)}
                  className={`${btn} border-signal text-signal`}>CHECK DEPOSIT</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}


      {notes.length ? (
        <ul className="mt-4 space-y-2">
          {notes.map((n) => (
            <li key={n.commitment} className="border border-border p-3 font-mono text-xs">
              <p className="label">
                {n.status === "awaiting" ? "◌ AWAITING DEPOSIT" : n.status === "shielded" ? `◆ SHIELDED · NOTE #${n.idx}` : "✓ SENT"}
              </p>
              <p className="mt-1 break-all text-muted-foreground">{n.inscriptionId}</p>
              {n.status === "awaiting" ? (
                <button type="button" disabled={busy} onClick={() => sealAtPool(n.inscriptionId)} className={`${btn} mt-2 border-signal text-signal`}>CHECK DEPOSIT</button>
              ) : n.status === "shielded" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input value={sendTo[n.commitment] ?? ""} onChange={(e) => setSendTo({ ...sendTo, [n.commitment]: e.target.value })}
                    placeholder="RECIPIENT shord1…" className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2" />
                  <button type="button" disabled={busy} onClick={() => sendPrivately(n)} className={`${btn} border-bitcoin text-bitcoin`}>SEND PRIVATELY</button>
                  <input value={exitTo[n.commitment] ?? wallet?.ordinalsAddress ?? ""} onChange={(e) => setExitTo({ ...exitTo, [n.commitment]: e.target.value })}
                    placeholder="WITHDRAW TO bc1…" className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2" />
                  <button type="button" disabled={busy} onClick={() => withdrawNote(n)} className={`${btn} border-signal text-signal`}>WITHDRAW TO BITCOIN</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {giftOut ? <p className="mt-3 break-all border border-signal p-2 font-mono text-xs text-signal">{giftOut}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="RECEIVED A NOTE CODE? SHORD-NOTE-v1.…"
          className="min-w-[280px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs" />
        <button type="button" disabled={busy || !gift} onClick={importGift} className={`${btn} border-signal text-signal`}>RECEIVE</button>
      </div>

      {msg ? <p className="label mt-3 break-all text-signal">{msg}</p> : null}
      <p className="label mt-3 text-muted-foreground">THE RELAYER FEE WALLET PAYS THE BITCOIN FEE FOR WITHDRAWALS; THE GUARDIAN ARRIVES WITH ITS FULL OUTPUT. FUND THE RELAYER FIRST.</p>
    </section>
  );
}
