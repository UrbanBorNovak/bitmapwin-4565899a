import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/lib/auth";
import type { ToonEpisode } from "@/lib/toon-script";
import { isCinemaAdmin, mySubmissions, submitEpisode, withdrawSubmission, type Submission } from "@/lib/toon-cinema";

const STATUS: Record<string, string> = { pending: "WAITING FOR REVIEW", approved: "LIVE IN CINEMA", rejected: "NOT ACCEPTED" };

export function CinemaSubmitPanel({ episode }: { episode: ToonEpisode }) {
  const { user, loading } = useAuthSession();
  const [name, setName] = useState("");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try { setSubs(await mySubmissions(user.id)); setAdmin(await isCinemaAdmin(user.id)); } catch { /* keep last */ }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async () => {
    if (!user) return;
    setBusy(true); setMsg(null);
    try { await submitEpisode(user.id, episode, name); setMsg("SUBMITTED — IT APPEARS IN THE CINEMA ONCE APPROVED."); await refresh(); }
    catch (e) { setMsg((e as Error).message.toUpperCase()); }
    finally { setBusy(false); }
  };

  return (
    <section className="border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="label text-bitcoin">SUBMIT TO TOON CINEMA</div>
        {admin && <Link to="/cinema-queue" className="label text-signal hover:underline">REVIEW QUEUE →</Link>}
      </div>
      {loading ? null : !user ? (
        <p className="mt-2 text-xs text-muted-foreground"><Link to="/auth" className="text-bitcoin hover:underline">Sign in</Link> to send this episode to the public cinema.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">Sends “{episode.title}” for review. Approved episodes play for everyone on <Link to="/watch" search={{ ep: undefined }} className="text-bitcoin hover:underline">/watch</Link>.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="Creator name (optional)"
              className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs" />
            <button className="btn-term" disabled={busy} onClick={() => void submit()}>[ {busy ? "SENDING…" : "SUBMIT EPISODE"} ]</button>
          </div>
          {msg && <div className="label mt-2 text-signal">{msg}</div>}
          {subs.length > 0 && (
            <ul className="mt-3 space-y-1 font-mono text-[0.7rem]">
              {subs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1">
                  <span className="truncate">{s.title}</span>
                  <span className={s.status === "approved" ? "text-signal" : s.status === "rejected" ? "text-destructive" : "text-bitcoin"}>
                    {STATUS[s.status]}{s.review_note ? ` · ${s.review_note}` : ""}
                    {s.status === "approved" && <> · <Link to="/watch" search={{ ep: s.id }} className="underline">WATCH</Link></>}
                    {s.status === "pending" && <> · <button className="underline" onClick={() => void withdrawSubmission(s.id).then(refresh)}>WITHDRAW</button></>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
