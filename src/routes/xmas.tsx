import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth";
import { ADVENT_DOORS, doorOpensAt, isDoorOpen } from "@/lib/advent";

export const Route = createFileRoute("/xmas")({
  head: () => ({
    meta: [
      { title: "Unhinged Advent Calendar — bitmapwin" },
      { name: "description", content: "24 days of unhinged Bitcoin-native chaos in the Oasis and Biternam. Sign up for your Advent Ration Card." },
      { property: "og:title", content: "Unhinged Advent Calendar — bitmapwin" },
      { property: "og:description", content: "One unhinged story drops every day of December. Get your Ration Card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmasPage,
});

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}D ${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}M ${String(s % 60).padStart(2, "0")}S`;
}

function XmasPage() {
  const now = useNow();
  const { user, loading } = useAuthSession();
  const [count, setCount] = useState<number | null>(null);
  const [card, setCard] = useState<number | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  async function refresh() {
    const { data } = await supabase.rpc("advent_signup_count");
    setCount(typeof data === "number" ? data : null);
    if (user) {
      const { data: n } = await supabase.rpc("advent_card_number");
      setCard(typeof n === "number" && n > 0 ? n : null);
    } else setCard(null);
  }
  useEffect(() => { void refresh(); }, [user?.id]);

  async function signUp() {
    if (!user) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("advent_signups").insert({ user_id: user.id, handle: handle.trim().slice(0, 24) });
    if (error && !error.message.includes("duplicate")) setErr("SIGNUP FAILED — TRY AGAIN");
    await refresh();
    setBusy(false);
  }

  const start = doorOpensAt(1);
  const door = openDay ? ADVENT_DOORS.find((d) => d.day === openDay) : null;

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10 font-mono">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border border-border p-6 bg-card/60 backdrop-blur-sm">
          <p className="text-xs tracking-widest text-accent">// TERMINAL 24 · DECEMBER ANOMALY FEED</p>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold">UNHINGED ADVENT CALENDAR</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground font-sans">
            Every day in December, something goes badly wrong in the Oasis and Biternam. One door, one story, one disaster. Sign up to get your Advent Ration Card.
          </p>
          <div className="mt-5 flex flex-wrap gap-6 text-sm">
            <div><span className="text-muted-foreground">FIRST DOOR IN </span><span className="text-accent">{now === null ? "…" : now >= start ? "OPEN NOW" : countdown(start - now)}</span></div>
            <div><span className="text-muted-foreground">SIGNED UP </span><span className="text-primary">{count ?? "…"}</span></div>
          </div>
        </header>

        <section className="border border-border p-6 bg-card/60">
          <h2 className="text-sm tracking-widest text-accent">ADVENT RATION CARD</h2>
          {loading ? <p className="mt-3 text-sm text-muted-foreground">CHECKING…</p> : !user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground font-sans">Sign in to claim your card.</p>
              <Link to="/auth" className="btn-term">[ SIGN IN ]</Link>
            </div>
          ) : card ? (
            <div className="mt-3 inline-block border border-primary px-6 py-4">
              <p className="text-xs text-muted-foreground">CARD NO.</p>
              <p className="text-4xl text-primary">#{String(card).padStart(4, "0")}</p>
              <p className="mt-1 text-xs text-accent">YOU'RE ON THE LIST. CHAOS STARTS DEC 1.</p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} placeholder="CALLSIGN (OPTIONAL)"
                className="border border-border bg-background px-3 py-2 text-sm" />
              <button onClick={signUp} disabled={busy} className="btn-term">{busy ? "[ STAMPING… ]" : "[ CLAIM RATION CARD ]"}</button>
              {err && <p className="w-full text-xs text-destructive">{err}</p>}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm tracking-widest text-accent">THE 24 DOORS</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {ADVENT_DOORS.map((d) => {
              const open = now !== null && isDoorOpen(d.day, now);
              return (
                <button key={d.day} disabled={!open} onClick={() => setOpenDay(d.day)}
                  className={`aspect-square border p-2 text-left transition ${open ? "border-primary hover:bg-primary/10" : "border-border opacity-50"}`}>
                  <span className="text-2xl">{String(d.day).padStart(2, "0")}</span>
                  <span className="block text-[10px] text-muted-foreground">{open ? "OPEN" : "LOCKED"}</span>
                </button>
              );
            })}
          </div>
          {door && (
            <div className="mt-4 border border-primary p-5 bg-card/60">
              <p className="text-xs text-accent">DAY {door.day}</p>
              <h3 className="mt-1 font-display text-xl">{door.title}</h3>
              <p className="mt-2 text-sm font-sans">{door.story}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
