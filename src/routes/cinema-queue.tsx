import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/lib/auth";
import { episodeLength } from "@/lib/toon-script";
import { isCinemaAdmin, reviewQueue, reviewSubmission, type Submission, type SubmissionStatus } from "@/lib/toon-cinema";

export const Route = createFileRoute("/cinema-queue")({
  head: () => ({
    meta: [
      { title: "Toon Cinema Review Queue — BitmapWin" },
      { name: "description", content: "Review creator episodes before they appear in the public Toon Cinema." },
      { property: "og:title", content: "Toon Cinema Review Queue" },
      { property: "og:description", content: "Review creator episodes before they appear in the public Toon Cinema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QueuePage,
});

function QueuePage() {
  const { user, loading } = useAuthSession();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<SubmissionStatus>("pending");
  const [rows, setRows] = useState<Submission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (user) void isCinemaAdmin(user.id).then(setAdmin); else if (!loading) setAdmin(false); }, [user, loading]);
  const load = useCallback(async () => { try { setRows(await reviewQueue(tab)); setErr(null); } catch (e) { setErr((e as Error).message); } }, [tab]);
  useEffect(() => { if (admin) void load(); }, [admin, load]);

  const act = async (id: string, status: SubmissionStatus) => {
    try { await reviewSubmission(id, status, notes[id] ?? null); await load(); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="label text-bitcoin">MEDIA · CINEMA</div>
      <h1 className="display mt-2 text-2xl md:text-4xl">CINEMA REVIEW QUEUE</h1>
      {admin === null ? <p className="label mt-4">CHECKING ACCESS…</p> : !admin ? (
        <p className="mt-4 text-sm text-muted-foreground">Only cinema reviewers can open this page. {!user && <Link to="/auth" className="text-bitcoin hover:underline">Sign in</Link>}</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <button key={s} className={tab === s ? "btn-term" : "btn-term-ghost"} onClick={() => setTab(s)}>[ {s.toUpperCase()} ]</button>
            ))}
          </div>
          {err && <div className="label mt-3 text-destructive">{err}</div>}
          {rows.length === 0 && <p className="label mt-6">NOTHING HERE.</p>}
          <ul className="mt-4 space-y-3">
            {rows.map((s) => (
              <li key={s.id} className="border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="display text-lg">{s.title}</div>
                  <div className="font-mono text-[0.7rem] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  BY {s.creator_name || "ANONYMOUS CREATOR"} · {Math.round(episodeLength(s.episode))}s · {s.episode.scenes.length} SCENES · {[...new Set(s.episode.scenes.map((x) => x.block))].join(" → ")}
                </div>
                <div className="mt-2 max-h-24 overflow-auto font-mono text-[0.7rem] text-muted-foreground">
                  {s.episode.scenes.flatMap((x) => x.lines).map((l, i) => <div key={i}>“{l.text}”</div>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/watch" search={{ ep: s.id }} className="btn-term-ghost">[ ▶ PREVIEW ]</Link>
                  <input placeholder="Note to creator (optional)" maxLength={200} value={notes[s.id] ?? s.review_note ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs" />
                  {s.status !== "approved" && <button className="btn-term" onClick={() => void act(s.id, "approved")}>[ APPROVE ]</button>}
                  {s.status !== "rejected" && <button className="btn-term-ghost" onClick={() => void act(s.id, "rejected")}>[ REJECT ]</button>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
