import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { heistStatusFn } from "@/lib/void-heist.functions";
import { voidStatusFn } from "@/lib/void-progress.functions";
import { hideoutStatusFn } from "@/lib/hideout-progress.functions";
import { resumeTarget, type ResumeTarget } from "@/lib/biternam-resume";

/** Resume button driven only by account-saved progress; hidden when signed out. */
export function ResumeAdventure() {
  const heist = useServerFn(heistStatusFn);
  const voidS = useServerFn(voidStatusFn);
  const hideout = useServerFn(hideoutStatusFn);
  const [target, setTarget] = useState<ResumeTarget | null>(null);
  const [state, setState] = useState<"loading" | "out" | "ready" | "error">("loading");

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      if (!data.session) { setState("out"); return; }
      try {
        const [h, v, b, i, w, l, d, a, k, s, f, c] = await Promise.all([heist(), voidS(), hideout({ data: { room: "batcave" } }), hideout({ data: { room: "island" } }), hideout({ data: { room: "vault" } }), hideout({ data: { room: "lair" } }), hideout({ data: { room: "basement" } }), hideout({ data: { room: "archive" } }), hideout({ data: { room: "holders" } }), hideout({ data: { room: "handshake" } }), hideout({ data: { room: "fortress" } }), hideout({ data: { room: "canon" } })]);
        if (!live) return;
        if (!h.ok || !v.ok || !b.ok || !i.ok || !w.ok || !l.ok || !d.ok || !a.ok || !k.ok || !s.ok || !f.ok || !c.ok) { setState("error"); return; }
        setTarget(resumeTarget(h.stage, v.count, b.count, i.count, w.count, l.count, d.count, a.count, k.count, s.count, f.count, c.count));
        setState("ready");
      } catch { if (live) setState("error"); }
    });
    return () => { live = false; };
  }, [heist, voidS, hideout]);

  if (state === "loading") return null;
  if (state === "out") return <p className="mt-6 font-mono text-xs text-muted-foreground">Sign in to resume your adventure on any device.</p>;
  if (state === "error" || !target) return <p className="mt-6 font-mono text-xs text-muted-foreground">Could not load your saved progress.</p>;
  return (
    <div className="mt-6">
      <Link to={target.to} data-testid="resume-adventure" className="inline-block rounded border border-bitcoin bg-bitcoin/10 px-4 py-2 font-mono text-sm text-bitcoin hover:bg-bitcoin hover:text-background">
        [ ▶ RESUME ADVENTURE ]
      </Link>
      <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-signal">{target.label}</div>
    </div>
  );
}
