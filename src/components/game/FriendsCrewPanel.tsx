import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, UserMinus, UserPlus, X } from "lucide-react";
import {
  addFriendFn, crewFn, crewMoveFn, inviteCrewFn, myFriendsFn, removeCrewFn, respondFriendFn, type FriendRow,
} from "@/lib/crew.functions";
import { voxelBagFn } from "@/lib/voxel-world.functions";
import { BLOCKS, setVoxelBag, voxelBag } from "@/lib/voxel-world";
import { mapHandle } from "@/lib/map-identity";

type Crew = { member: boolean; members: { id: string; handle: string; owner: boolean }[]; stash: Record<string, number> };

/** Friends list + the build crew and shared block stash of the BITMAP you stand on. */
export function FriendsCrewPanel({ height, onClose }: { height: number; onClose: () => void }) {
  const [tab, setTab] = useState<"friends" | "crew">("friends");
  const [code, setCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([myFriendsFn({ data: { handle: mapHandle() } }), crewFn({ data: { height } })]);
      setCode(f.code); setFriends(f.friends); setCrew(c); setErr(null);
    } catch { setErr("SIGN IN TO USE FRIENDS AND CREWS"); }
  }, [height]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok?: string) => {
    setBusy(true);
    const r = await fn().catch(() => ({ ok: false, error: "SOMETHING WENT WRONG" }));
    setBusy(false);
    if (!r.ok) toast.error(r.error ?? "FAILED");
    else if (r.message || ok) toast.success(r.message ?? ok);
    await load();
    return r.ok;
  };
  const move = async (kind: string, n: number) => {
    const done = await run(() => crewMoveFn({ data: { height, kind, n } }));
    if (done) void voxelBagFn().then((r) => setVoxelBag(r.bag)).catch(() => {});
  };

  const accepted = friends.filter((f) => f.status === "accepted");
  const inCrew = new Set(crew?.members.map((m) => m.id));
  const bag = voxelBag.items;
  const tabBtn = (t: typeof tab, label: string) => (
    <button type="button" onClick={() => setTab(t)} className={`flex-1 border-b px-2 py-1 ${tab === t ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>{label}</button>
  );

  return (
    <div data-no-translate className="hud-panel pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] p-2 font-mono text-[10px]">
      <div className="mb-1 flex items-center">
        {tabBtn("friends", `FRIENDS · ${accepted.length}`)}
        {tabBtn("crew", `CREW · ${height}.BITMAP`)}
        <button type="button" aria-label="Close" onClick={onClose} className="ml-1 p-1 hover:text-bitcoin"><X className="size-3" /></button>
      </div>
      {err ? <p className="py-2 text-muted-foreground">{err}</p> : tab === "friends" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between border border-border px-2 py-1">
            <span className="text-muted-foreground">YOUR CODE <span className="text-signal">{code ?? "…"}</span></span>
            <button type="button" aria-label="Copy friend code" onClick={() => code && void navigator.clipboard.writeText(code).then(() => toast("CODE COPIED"))} className="hover:text-bitcoin"><Copy className="size-3" /></button>
          </div>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const c = input.trim(); if (c) void run(() => addFriendFn({ data: { code: c } })).then((ok) => ok && setInput("")); }}>
            <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} maxLength={12} placeholder="FRIEND CODE"
              className="min-w-0 flex-1 border border-border bg-background/60 px-2 py-1 outline-none focus:border-signal" />
            <button type="submit" disabled={busy} className="flex items-center gap-1 border border-bitcoin px-2 text-bitcoin disabled:opacity-50"><UserPlus className="size-3" />ADD</button>
          </form>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {friends.length === 0 ? <li className="text-muted-foreground">NO FRIENDS YET · SHARE YOUR CODE</li> : null}
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 border border-border px-2 py-1">
                <span className="truncate">{f.handle} <span className="text-muted-foreground">{f.status === "accepted" ? "" : f.status === "incoming" ? "· WANTS TO BE FRIENDS" : "· PENDING"}</span></span>
                <span className="flex shrink-0 gap-1">
                  {f.status === "incoming" ? <button type="button" aria-label="Accept" disabled={busy} onClick={() => void run(() => respondFriendFn({ data: { id: f.id, accept: true } }), "FRIEND ADDED")} className="text-signal hover:text-bitcoin"><Check className="size-3.5" /></button> : null}
                  {f.status === "accepted" && !inCrew.has(f.id) ? (
                    <button type="button" disabled={busy} onClick={() => void run(() => inviteCrewFn({ data: { height, friend: f.id } }), `${f.handle} JOINED YOUR CREW`)}
                      className="border border-border px-1 text-[9px] hover:border-bitcoin hover:text-bitcoin">INVITE TO {height}</button>
                  ) : null}
                  <button type="button" aria-label="Remove" disabled={busy} onClick={() => void run(() => respondFriendFn({ data: { id: f.id, accept: false } }))} className="text-muted-foreground hover:text-destructive"><UserMinus className="size-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1">
            {crew?.members.length ? null : <li className="text-muted-foreground">NO CREW HERE YET · THE OWNER INVITES FRIENDS FROM THE FRIENDS TAB</li>}
            {crew?.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between border border-border px-2 py-1">
                <span>{m.handle} {m.owner ? <span className="text-bitcoin">· OWNER</span> : null}</span>
                {!m.owner ? <button type="button" disabled={busy} onClick={() => void run(() => removeCrewFn({ data: { height, id: m.id } }))} className="text-[9px] text-muted-foreground hover:text-destructive">REMOVE</button> : null}
              </li>
            ))}
          </ul>
          {crew?.member ? (
            <div>
              <p className="mb-1 text-signal">SHARED STASH · CREW CAN BREAK EACH OTHER'S BLOCKS HERE</p>
              <div className="grid grid-cols-2 gap-1">
                {BLOCKS.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-1 border border-border px-1.5 py-0.5">
                    <span className="truncate">{b.name} <span className="text-signal">{crew.stash[b.id] ?? 0}</span><span className="text-muted-foreground">/{bag?.[b.id] ?? 0}</span></span>
                    <span className="flex gap-0.5">
                      <button type="button" title="Put 1 from your bag" disabled={busy || !(bag?.[b.id])} onClick={() => void move(b.id, 1)} className="border border-border px-1 disabled:opacity-40 hover:text-bitcoin">+</button>
                      <button type="button" title="Take 1 into your bag" disabled={busy || !(crew.stash[b.id])} onClick={() => void move(b.id, -1)} className="border border-border px-1 disabled:opacity-40 hover:text-bitcoin">−</button>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-muted-foreground">STASH / YOUR BAG · + PUTS IN · − TAKES OUT</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
