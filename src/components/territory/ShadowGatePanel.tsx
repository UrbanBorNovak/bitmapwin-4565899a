import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getShadowEventsFn,
  claimShadowPassFn,
  verifyShadowPassFn,
  postShadowWhisperFn,
} from "@/lib/shadow-assets.functions";
import {
  draftPass,
  getPass,
  savePass,
  exportPass,
  importPass,
  shadowHandle,
  type ShadowPass,
} from "@/lib/shadow-vault";

type Whisper = { id: string; nullifier: string; content: string; createdAt: string };

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}S AGO`;
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return `${Math.floor(s / 86400)}D AGO`;
}

function GateGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 64 88" className="h-20 w-14 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="shadow-gate-arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M6 86V32C6 17 17 6 32 6s26 11 26 26v54"
        fill="url(#shadow-gate-arch)"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.8"
      />
      {open ? (
        <>
          <path d="M18 86V34c0-8 6-14 14-14s14 6 14 14v52" fill="currentColor" fillOpacity="0.18" />
          <path d="M32 24v54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.9">
            <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="2.4s" repeatCount="indefinite" />
          </path>
        </>
      ) : (
        <>
          <path d="M18 86V34c0-8 6-14 14-14s14 6 14 14v52" fill="currentColor" fillOpacity="0.06" />
          <rect x="27" y="48" width="10" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M29 48v-4a3 3 0 0 1 6 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

export function ShadowGatePanel({ height }: { height: number }) {
  const loadEvents = useServerFn(getShadowEventsFn);
  const events = useQuery({
    queryKey: ["shadow-events", height],
    queryFn: () => loadEvents({ data: { height } }),
    staleTime: 30_000,
  });

  const list = events.data ?? [];
  if (events.isLoading || list.length === 0) return null;

  return (
    <section id="shadow-gate" className="mt-10 scroll-mt-20">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-xl tracking-wide">SHADOW GATE</h2>
        <span className="label text-muted-foreground">SHIELDED ACCESS · NO WALLET REVEALED</span>
      </div>
      <div className="space-y-4">
        {list.map((ev) => (
          <ShadowEventCard key={ev.slug} event={ev} />
        ))}
      </div>
    </section>
  );
}

function ShadowEventCard({
  event,
}: {
  event: {
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    maxPasses: number;
    passesIssued: number;
    isActive: boolean;
    territoryBlock: number;
  };
}) {
  const claim = useServerFn(claimShadowPassFn);
  const verify = useServerFn(verifyShadowPassFn);
  const postWhisper = useServerFn(postShadowWhisperFn);

  const [pass, setPass] = useState<ShadowPass | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [draftText, setDraftText] = useState("");
  const [issued, setIssued] = useState(event.passesIssued);
  const [showBackup, setShowBackup] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    setPass(getPass(event.slug));
  }, [event.slug]);

  const remaining = Math.max(0, event.maxPasses - issued);
  const fill = event.maxPasses > 0 ? Math.min(100, (issued / event.maxPasses) * 100) : 0;
  const handle = useMemo(() => (pass ? shadowHandle(pass.nullifier) : null), [pass]);

  async function onClaim() {
    setBusy(true);
    try {
      const draft = draftPass(event.slug);
      const res = await claim({ data: { slug: event.slug, commitment: draft.commitment } });
      if (!res.ok) {
        toast.error(res.reason || "GATE REFUSED THE PASS");
        return;
      }
      const saved: ShadowPass = {
        ...draft,
        passIndex: res.passIndex,
        claimedAt: new Date().toISOString(),
      };
      savePass(saved);
      setPass(saved);
      setIssued(res.passesIssued ?? issued + 1);
      setShowBackup(true);
      toast.success(`SHADOW PASS #${res.passIndex} ISSUED · SAVE YOUR BACKUP CODE`);
    } catch {
      toast.error("GATE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  async function onEnter(withPass?: ShadowPass) {
    const p = withPass ?? pass;
    if (!p) return;
    setBusy(true);
    try {
      const res = await verify({ data: { slug: event.slug, commitment: p.commitment } });
      if (!res.valid) {
        toast.error("THIS PASS IS NOT RECOGNISED AT THE GATE");
        return;
      }
      setWhispers(res.whispers as Whisper[]);
      setUnlocked(true);
    } catch {
      toast.error("GATE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  async function onWhisper() {
    if (!pass || !draftText.trim()) return;
    setBusy(true);
    try {
      const res = await postWhisper({
        data: {
          slug: event.slug,
          commitment: pass.commitment,
          nullifier: pass.nullifier,
          content: draftText.trim(),
        },
      });
      if (!res.ok) {
        toast.error(res.reason || "TRANSMISSION REFUSED");
        return;
      }
      setWhispers(res.whispers as Whisper[]);
      setDraftText("");
    } catch {
      toast.error("GATE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  function onImport() {
    const imported = importPass(importText);
    if (!imported || imported.slug !== event.slug) {
      toast.error("THAT BACKUP CODE DOES NOT MATCH THIS GATE");
      return;
    }
    savePass(imported);
    setPass(imported);
    setImportText("");
    void onEnter(imported);
  }

  return (
    <div className="border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start gap-5">
        <span className={unlocked ? "text-signal" : "text-muted-foreground"}>
          <GateGlyph open={unlocked} />
        </span>
        <div className="min-w-[220px] flex-1">
          <h3 className="font-display text-lg tracking-wide">{event.title}</h3>
          <p className="label mt-1 text-signal">{event.subtitle}</p>
          <p className="mt-2 max-w-prose font-mono text-xs leading-relaxed text-muted-foreground">
            {event.description}
          </p>

          <div className="mt-4 max-w-sm">
            <div className="flex items-baseline justify-between">
              <span className="label">PASSES ISSUED</span>
              <span className="font-mono text-xs">
                {issued} / {event.maxPasses}
              </span>
            </div>
            <span className="relative mt-1 block h-1.5 w-full overflow-hidden bg-muted">
              <span
                className="absolute inset-y-0 left-0 bg-signal"
                style={{ width: `${fill}%` }}
              />
            </span>
            <p className="label mt-1 text-muted-foreground">
              {remaining > 0 ? `${remaining} REMAINING` : "GATE SEALED · ALL PASSES ISSUED"}
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2">
          {!pass ? (
            <>
              <button
                type="button"
                disabled={busy || remaining === 0 || !event.isActive}
                onClick={onClaim}
                className="border border-signal px-3 py-2 font-mono text-xs text-signal hover:bg-signal hover:text-background disabled:opacity-40"
              >
                ◈ TAKE A SHADOW PASS
              </button>
              <p className="label text-muted-foreground">
                NOTHING IS SIGNED. NO ADDRESS IS SENT. THE PASS LIVES ON THIS DEVICE.
              </p>
              <details className="mt-1">
                <summary className="label cursor-pointer text-muted-foreground">I ALREADY HAVE A BACKUP CODE</summary>
                <div className="mt-2 flex gap-2">
                  <input
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="SHADOW-PASS-v1…"
                    className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-[11px]"
                  />
                  <button type="button" onClick={onImport} className="border border-border px-2 py-1 font-mono text-[11px]">
                    RESTORE
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="border border-signal/40 bg-signal/5 px-3 py-2">
                <p className="label text-signal">PASS HELD · {handle}</p>
                <p className="label mt-1 text-muted-foreground">SHIELDED · NOT LINKED TO YOUR WALLET</p>
              </div>
              {!unlocked ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onEnter()}
                  className="border border-signal px-3 py-2 font-mono text-xs text-signal hover:bg-signal hover:text-background disabled:opacity-40"
                >
                  {busy ? "PROVING…" : "◈ PROVE PASS & ENTER"}
                </button>
              ) : (
                <span className="border border-signal px-3 py-2 text-center font-mono text-xs text-signal">
                  GATE OPEN
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowBackup((v) => !v)}
                className="border border-border px-3 py-2 font-mono text-[11px] text-muted-foreground"
              >
                {showBackup ? "HIDE BACKUP CODE" : "SHOW BACKUP CODE"}
              </button>
              {showBackup ? (
                <div className="border border-bitcoin/50 bg-bitcoin/5 p-2">
                  <p className="label text-bitcoin">KEEP THIS SAFE — IT IS THE PASS</p>
                  <code className="mt-1 block break-all font-mono text-[10px] leading-relaxed">
                    {exportPass(pass)}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(exportPass(pass));
                      toast.success("BACKUP CODE COPIED");
                    }}
                    className="mt-2 border border-bitcoin px-2 py-1 font-mono text-[10px] text-bitcoin"
                  >
                    COPY
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {unlocked ? (
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="flex items-baseline gap-3">
            <h4 className="font-display text-base tracking-wide">THE PRIVATE CHAMBER</h4>
            <span className="label text-muted-foreground">ANONYMOUS WHISPERS · {whispers.length}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onWhisper();
              }}
              maxLength={500}
              placeholder="LEAVE A WHISPER — NOBODY LEARNS WHO YOU ARE"
              className="min-w-0 flex-1 border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              disabled={busy || !draftText.trim()}
              onClick={onWhisper}
              className="border border-signal px-3 py-2 font-mono text-xs text-signal disabled:opacity-40"
            >
              TRANSMIT
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {whispers.length === 0 ? (
              <li className="font-mono text-xs text-muted-foreground">&gt; THE CHAMBER IS SILENT_</li>
            ) : (
              whispers.map((w) => (
                <li key={w.id} className="border border-border/60 bg-background/60 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="label text-signal">{shadowHandle(w.nullifier)}</span>
                    <span className="label text-muted-foreground">{ago(w.createdAt)}</span>
                  </div>
                  <p className="mt-1 break-words font-mono text-xs leading-relaxed">{w.content}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
