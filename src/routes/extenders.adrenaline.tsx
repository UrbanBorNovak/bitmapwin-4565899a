import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Crosshair, Moon, Shield } from "lucide-react";
import { ADRENALINE_PRICE_BIT, adrenalineStatusFn, buyAdrenalineFn } from "@/lib/adrenaline.functions";

export const Route = createFileRoute("/extenders/adrenaline")({
  head: () => {
    const title = "Adrenaline — Combat Assist & Offline Farm Extender | BitmapWin";
    const description = "One-time licence: auto-attack, skill rotation in the Oasis, and offline material farming while you are away.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: AdrenalinePage,
});

const FEATURES = [
  { icon: Crosshair, title: "COMBAT ASSIST", body: "Press F10 in the Oasis: keeps hitting the nearest target and fires your class skills the moment they come off cooldown." },
  { icon: Moon, title: "OFFLINE FARM", body: "While you are away it hunts for you. Every 15 minutes offline yields dirt, cobble, logs and sand — up to 12 hours per visit." },
  { icon: Shield, title: "FAIR BY DESIGN", body: "Farm results are settled on the server and pay block materials only, never BIT, so the economy stays honest." },
];

function AdrenalinePage() {
  const status = useServerFn(adrenalineStatusFn);
  const buy = useServerFn(buyAdrenalineFn);
  const qc = useQueryClient();
  const lic = useQuery({ queryKey: ["adrenaline"], queryFn: () => status(), retry: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const purchase = async () => {
    setBusy(true);
    setMsg(null);
    const r = await buy().catch(() => ({ ok: false, error: "SIGN IN FIRST" }));
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "FAILED");
    setMsg("LICENCE ACTIVE — OPEN THE OASIS AND PRESS F10");
    await qc.invalidateQueries({ queryKey: ["adrenaline"] });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <Link to="/extenders" className="label text-muted-foreground hover:text-bitcoin">← EXTENDER MARKET</Link>
      <div className="mt-6 flex items-center gap-3">
        <Bot className="size-8 text-bitcoin" />
        <div>
          <div className="label text-signal">EXTENDER · ADD-ON · COMBAT</div>
          <h1 className="display text-3xl md:text-5xl">ADRENALINE</h1>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Your second pair of hands in the Oasis. Pay once, keep it forever: it fights beside you and keeps farming while you sleep.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="hud-panel p-4">
            <f.icon className="size-5 text-signal" />
            <p className="label mt-3 text-foreground">{f.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="hud-panel mt-8 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="font-mono">
          <p className="label text-muted-foreground">ONE-TIME LICENCE</p>
          <p className="display mt-1 text-3xl text-bitcoin">{ADRENALINE_PRICE_BIT.toLocaleString("en-US")} BIT</p>
          <p className="mt-1 text-xs text-muted-foreground">Paid from a linked wallet's BIT balance. No subscription.</p>
        </div>
        {lic.data?.licensed ? (
          <div className="font-mono text-sm">
            <p className="text-signal">● LICENSED</p>
            <Link to="/oasis" className="btn-term mt-2 inline-block">[ OPEN THE OASIS ]</Link>
          </div>
        ) : lic.isError ? (
          <Link to="/auth" className="btn-term">[ SIGN IN TO BUY ]</Link>
        ) : (
          <button type="button" disabled={busy || lic.isLoading} onClick={() => void purchase()} className="btn-term">
            {busy ? "PAYING…" : "[ BUY LICENCE ]"}
          </button>
        )}
      </div>
      {msg ? <p className="mt-3 font-mono text-xs text-bitcoin">{msg}</p> : null}
    </div>
  );
}
