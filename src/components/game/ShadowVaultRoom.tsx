/**
 * THE SHADOW VAULT — the interior chamber behind an obsidian archway.
 *
 * A separate scene from the open Oasis: stepping through the veil drops you
 * into a sealed subterranean hall. Entry is proven on the device that holds
 * the pass; the server only ever sees the commitment hash.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { toast } from "sonner";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { SafeHtml } from "@/components/game/SafeHtml";
import { AssemblyDecor } from "@/components/game/AssemblyDecor";
import { onShadowRoom, type ShadowRoomRequest } from "@/lib/shadow-room";
import { getPass, shadowHandle } from "@/lib/shadow-vault";
import { verifyShadowPassFn, postShadowWhisperFn } from "@/lib/shadow-assets.functions";
import { getShadowNoteFn } from "@/lib/shadow-l1.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMempoolWatch } from "@/lib/use-mempool-watch";

type Whisper = { id: string; nullifier: string; content: string; createdAt: string };
type EventInfo = { title: string; subtitle: string; description: string; maxPasses: number; passesIssued: number; territoryBlock: number };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "JUST NOW";
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return `${Math.floor(s / 86400)}D AGO`;
}

const HALL = 26; // half-extent of the hall floor, in metres
const LORE = [
  "PRIVACY IS NECESSARY FOR AN OPEN SOCIETY IN THE ELECTRONIC AGE.",
  "THE LAND IS PUBLIC. WHO GATHERS ON IT NEED NOT BE.",
  "A PASS IS A SECRET ON YOUR DEVICE — NOT A NAME IN A LEDGER.",
  "NOTHING HERE LINKS A WALLET TO A PRESENCE.",
];

/* ---------------------------------------------------------------- controller */

function Walker({ look }: { look: React.MutableRefObject<{ yaw: number; pitch: number }> }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const vel = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(0, 1.7, HALL * 0.72);
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = keys.current;
    const fwd = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
    const side = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
    const speed = k["shift"] ? 9 : 4.6;
    const yaw = look.current.yaw;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * -fwd + Math.cos(yaw) * side,
      0,
      Math.cos(yaw) * -fwd - Math.sin(yaw) * side,
    );
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed);
    vel.current.lerp(dir, 1 - Math.exp(-9 * dt));
    camera.position.addScaledVector(vel.current, dt);
    const edge = HALL - 1.4;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -edge, edge);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -edge, edge);
    camera.position.y = 1.7;
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, "YXZ");
  });
  return null;
}

/* -------------------------------------------------------------------- scene */

function Monolith({ x, z, text, rot }: { x: number; z: number; text: string; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[2.6, 5.2, 0.55]} />
        <meshStandardMaterial color="#0b0a11" roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.6, 0.31]}>
        <planeGeometry args={[2.1, 4.4]} />
        <meshStandardMaterial color="#04060a" emissive="#0e7490" emissiveIntensity={0.5} />
      </mesh>
      <SafeHtml position={[0, 2.7, 0.4]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div className="w-40 text-center font-mono text-[8px] leading-relaxed tracking-wide text-signal/90">
          {text}
        </div>
      </SafeHtml>
    </group>
  );
}

function Hall({ title, onTerminal, onLeave }: { title: string; onTerminal: () => void; onLeave: () => void }) {
  const veil = useRef<THREE.MeshStandardMaterial>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (veil.current) veil.current.emissiveIntensity = 0.7 + Math.sin(t * 1.4) * 0.35;
    if (core.current) {
      core.current.rotation.y = t * 0.5;
      core.current.position.y = 1.5 + Math.sin(t * 1.1) * 0.12;
    }
  });
  const obsidian = { color: "#0a0910", roughness: 0.28, metalness: 0.55 } as const;
  const lines = useMemo(() => [-18, -9, 0, 9, 18], []);

  return (
    <group>
      {/* floor + bioluminescent seams */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[HALL * 2, HALL * 2]} />
        <meshStandardMaterial color="#080711" roughness={0.5} metalness={0.35} />
      </mesh>
      {lines.map((v) => (
        <group key={v}>
          <mesh rotation-x={-Math.PI / 2} position={[v, 0.02, 0]}>
            <planeGeometry args={[0.08, HALL * 2]} />
            <meshStandardMaterial color="#06121a" emissive="#22d3ee" emissiveIntensity={1.4} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, v]}>
            <planeGeometry args={[HALL * 2, 0.08]} />
            <meshStandardMaterial color="#06121a" emissive="#22d3ee" emissiveIntensity={1.1} />
          </mesh>
        </group>
      ))}
      {/* walls + ceiling */}
      {[
        [0, -HALL, 0],
        [0, HALL, Math.PI],
        [-HALL, 0, Math.PI / 2],
        [HALL, 0, -Math.PI / 2],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x as number, 5, z as number]} rotation={[0, r as number, 0]}>
          <boxGeometry args={[HALL * 2, 10, 0.6]} />
          <meshStandardMaterial {...obsidian} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 10, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[HALL * 2, HALL * 2]} />
        <meshStandardMaterial color="#05040a" roughness={0.8} />
      </mesh>

      {/* the void terminal at the heart of the hall */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[1.6, 2.1, 1, 8]} />
          <meshStandardMaterial {...obsidian} />
        </mesh>
        <mesh ref={core} position={[0, 1.5, 0]} onClick={onTerminal}>
          <octahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#031017" emissive="#22d3ee" emissiveIntensity={1.6} />
        </mesh>
        <pointLight position={[0, 2.4, 0]} color="#22d3ee" intensity={18} distance={22} />
        <SafeHtml position={[0, 3.1, 0]} center distanceFactor={16}>
          <button
            type="button"
            onClick={onTerminal}
            className="whitespace-nowrap border border-signal/70 bg-background/85 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/15"
          >
            ◈ VOID TERMINAL
          </button>
        </SafeHtml>
      </group>

      {/* lore monoliths */}
      <Monolith x={-11} z={-11} rot={Math.PI * 0.25} text={LORE[0]!} />
      <Monolith x={11} z={-11} rot={-Math.PI * 0.25} text={LORE[1]!} />
      <Monolith x={-11} z={6} rot={Math.PI * 0.75} text={LORE[2]!} />
      <Monolith x={11} z={6} rot={-Math.PI * 0.75} text={LORE[3]!} />

      {/* the return archway */}
      <group position={[0, 0, HALL - 2]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 2.2, 3, 0]}>
            <boxGeometry args={[0.6, 6, 0.8]} />
            <meshStandardMaterial {...obsidian} />
          </mesh>
        ))}
        <mesh position={[0, 6, 0]}>
          <torusGeometry args={[2.5, 0.3, 8, 24, Math.PI]} />
          <meshStandardMaterial {...obsidian} />
        </mesh>
        <mesh position={[0, 3.1, 0]} onClick={onLeave}>
          <planeGeometry args={[4, 6]} />
          <meshStandardMaterial ref={veil} color="#05030a" emissive="#f7931a" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <SafeHtml position={[0, 7.1, 0]} center distanceFactor={18}>
          <button
            type="button"
            onClick={onLeave}
            className="whitespace-nowrap border border-bitcoin/70 bg-background/85 px-2 py-1 font-mono text-[10px] text-bitcoin hover:bg-bitcoin/15"
          >
            ← BACK TO THE OASIS
          </button>
        </SafeHtml>
      </group>

      <SafeHtml position={[0, 8, -HALL + 1]} center distanceFactor={26} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap border border-signal/40 bg-background/70 px-3 py-1 font-mono text-[11px] tracking-[0.3em] text-signal">
          ◈ {title.toUpperCase()}
        </div>
      </SafeHtml>
    </group>
  );
}

/* ------------------------------------------------------------------ overlay */

export function ShadowVaultRoom() {
  const [room, setRoom] = useState<ShadowRoomRequest | null>(null);
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tab, setTab] = useState<"whispers" | "attendees" | "lore">("whispers");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const look = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const pass = room ? getPass(room.slug) : null;

  const refresh = useCallback(async (slug: string, commitment: string) => {
    try {
      const res = await verifyShadowPassFn({ data: { slug, commitment } });
      if (res.valid) {
        setWhispers(res.whispers as Whisper[]);
        setEvent(res.event as EventInfo | null);
      }
    } catch {
      /* the chamber stays open even if the board cannot load */
    }
  }, []);

  // Attendees are shown only as pass handles of those who have spoken; the
  // rest are counted, never named — no wallet is ever linked to a presence.
  const attendees = useMemo(() => {
    const m = new Map<string, { handle: string; count: number; last: string }>();
    for (const w of whispers) {
      const cur = m.get(w.nullifier);
      if (cur) cur.count += 1;
      else m.set(w.nullifier, { handle: shadowHandle(w.nullifier), count: 1, last: w.createdAt });
    }
    return [...m.entries()].map(([n, v]) => ({ nullifier: n, ...v }));
  }, [whispers]);

  // Whether this device's own pass has been written onto Bitcoin.
  const l1Note = useQuery({
    queryKey: ["shadow-note", pass?.commitment ?? "none"],
    enabled: Boolean(pass?.commitment),
    staleTime: 30_000,
    queryFn: () => getShadowNoteFn({ data: { digest: pass!.commitment } }),
  });
  // Live watcher: a mempool websocket tracks the note's txid and the chamber
  // re-reads the note the moment a block carries it — no timer polling.
  const qc = useQueryClient();
  const pending = l1Note.data && l1Note.data.status === "broadcast" ? l1Note.data.txid : null;
  const onChain = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["shadow-note"] });
    void qc.invalidateQueries({ queryKey: ["shadow-notes"] });
  }, [qc]);
  const watch = useMempoolWatch(pending, onChain);
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const st = l1Note.data?.status ?? null;
    if (prevStatus.current === "broadcast" && st === "confirmed") {
      toast.success(`PASS ANCHORED ON BITCOIN · BLOCK ${l1Note.data?.confirmedHeight ?? ""}`);
    }
    prevStatus.current = st;
  }, [l1Note.data]);
  const anchorLine = l1Note.data
    ? l1Note.data.status === "confirmed"
      ? `◆ ANCHORED ON BITCOIN · BLOCK ${l1Note.data.confirmedHeight ?? "—"}`
      : `◈ ANCHORING · WAITING FOR A MINER${watch === "live" ? " · WATCHING LIVE" : watch === "offline" ? " · RECONNECTING" : ""}`
    : null;

  useEffect(
    () =>
      onShadowRoom((req) => {
        look.current = { yaw: 0, pitch: 0 };
        setTerminalOpen(true);
        setTab("lore");
        setEvent(null);
        setRoom(req);
        const held = getPass(req.slug);
        if (held) void refresh(req.slug, held.commitment);
      }),
    [refresh],
  );

  useEffect(() => {
    if (!room) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRoom(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [room]);

  const send = async () => {
    if (!room || !pass || !draft.trim()) return;
    setSending(true);
    try {
      const res = await postShadowWhisperFn({
        data: { slug: room.slug, commitment: pass.commitment, nullifier: pass.nullifier, content: draft.trim() },
      });
      if (res.ok) {
        setWhispers(res.whispers as Whisper[]);
        setDraft("");
      } else {
        toast.error("THE TERMINAL REFUSED THAT WHISPER");
      }
    } finally {
      setSending(false);
    }
  };

  if (!room) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div
        className="absolute inset-0"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          look.current.yaw -= (e.clientX - d.x) * 0.004;
          look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - (e.clientY - d.y) * 0.004, -1.1, 1.1);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
      >
        <SafeCanvas shadows camera={{ fov: 68, near: 0.1, far: 200 }}>
          <color attach="background" args={["#03030a"]} />
          <fog attach="fog" args={["#03030a", 12, 52]} />
          <ambientLight intensity={0.35} color="#7dd3fc" />
          <directionalLight position={[8, 14, 6]} intensity={0.5} color="#a5f3fc" castShadow />
          <pointLight position={[-14, 6, -14]} color="#22d3ee" intensity={14} distance={30} />
          <pointLight position={[14, 6, 14]} color="#f7931a" intensity={8} distance={26} />
          <Walker look={look} />
          <Hall
            title={room.title}
            onTerminal={() => setTerminalOpen((v) => !v)}
            onLeave={() => setRoom(null)}
          />
          {room.slug === "cypherpunk-assembly" ? (
            <AssemblyDecor taken={event?.passesIssued ?? 0} max={event?.maxPasses ?? 21} />
          ) : null}
        </SafeCanvas>
      </div>

      {/* chamber HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-[10px] text-signal">
        <div className="space-y-1">
          <div className="border border-signal/40 bg-background/70 px-2 py-1">
            ◈ SHADOW VAULT · {pass ? shadowHandle(pass.nullifier) : "ENTERED WITH A SEALED KEYCARD · WHISPERS NEED A PASS"}
          </div>
          {l1Note.data ? (
            l1Note.data.status === "confirmed" ? (
              <div className="border border-bitcoin bg-bitcoin/15 px-2 py-1 text-bitcoin">
                ◆ ANCHORED ON BITCOIN · BLOCK {l1Note.data.confirmedHeight ?? "—"}
              </div>
            ) : (
              <div className="animate-pulse border border-signal/50 bg-background/70 px-2 py-1 text-signal">
                {anchorLine}
              </div>
            )
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setRoom(null)}
          className="pointer-events-auto border border-bitcoin/60 bg-background/80 px-2 py-1 text-bitcoin hover:bg-bitcoin/15"
        >
          LEAVE · ESC
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 border border-border/60 bg-background/70 px-2 py-1 font-mono text-[9px] text-muted-foreground">
        WASD / ARROWS TO WALK · DRAG TO LOOK · SHIFT TO HURRY
      </div>

      {terminalOpen ? (
        <div className="absolute right-3 top-14 flex max-h-[70vh] w-[min(92vw,22rem)] flex-col border border-signal/40 bg-background/95 p-3 font-mono text-[10px]">
          <div className="mb-2 flex items-center justify-between text-signal">
            <span>◈ VOID TERMINAL</span>
            <button type="button" onClick={() => setTerminalOpen(false)} className="text-muted-foreground hover:text-signal">
              ✕
            </button>
          </div>
          <div className="mb-2 grid grid-cols-3 border border-border/60">
            {(["whispers", "attendees", "lore"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`py-1 ${tab === t ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-signal"}`}
              >
                {t === "whispers" ? `WHISPERS · ${whispers.length}` : t === "attendees" ? `PRESENT · ${event?.passesIssued ?? "—"}` : "LORE"}
              </button>
            ))}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {tab === "whispers" ? (
              whispers.length === 0 ? (
                <p className="text-muted-foreground">NO WHISPERS YET. BE THE FIRST VOICE IN THE DARK.</p>
              ) : (
                whispers.map((w) => (
                  <div key={w.id} className="border border-border/50 p-2">
                    <div className="flex justify-between text-signal/80">
                      <span>{shadowHandle(w.nullifier)}{pass && w.nullifier === pass.nullifier ? " · YOU" : ""}</span>
                      <span className="text-muted-foreground">{ago(w.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{w.content}</p>
                  </div>
                ))
              )
            ) : tab === "attendees" ? (
              <div className="space-y-2">
                <div className="border border-signal/30 p-2">
                  <div className="text-signal">{event?.passesIssued ?? 0} / {event?.maxPasses ?? "—"} PASSES TAKEN</div>
                  <div className="mt-1 h-1 bg-border/50">
                    <div className="h-1 bg-signal" style={{ width: `${event ? Math.min(100, (event.passesIssued / Math.max(1, event.maxPasses)) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    ONLY PASS HANDLES OF THOSE WHO HAVE SPOKEN ARE SHOWN. NO WALLET OR ACCOUNT IS EVER LINKED.
                  </p>
                </div>
                {pass && !attendees.some((a) => a.nullifier === pass.nullifier) ? (
                  <div className="flex justify-between border border-border/50 p-2">
                    <span className="text-signal">{shadowHandle(pass.nullifier)} · YOU</span>
                    <span className="text-muted-foreground">SILENT</span>
                  </div>
                ) : null}
                {attendees.map((a) => (
                  <div key={a.nullifier} className="flex justify-between border border-border/50 p-2">
                    <span className="text-signal/90">{a.handle}{pass && a.nullifier === pass.nullifier ? " · YOU" : ""}</span>
                    <span className="text-muted-foreground">{a.count} WHISPER{a.count === 1 ? "" : "S"} · {ago(a.last)}</span>
                  </div>
                ))}
                {event ? (
                  <p className="text-muted-foreground">
                    +{Math.max(0, event.passesIssued - attendees.length - (pass && !attendees.some((a) => a.nullifier === pass.nullifier) ? 1 : 0))} SILENT HOLDERS
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[12px] text-signal">{(event?.title ?? room.title).toUpperCase()}</div>
                  {event?.subtitle ? <div className="text-muted-foreground">{event.subtitle.toUpperCase()}</div> : null}
                  {event ? <div className="mt-1 text-bitcoin">HELD ON {event.territoryBlock}.BITMAP</div> : null}
                </div>
                {anchorLine ? (
                  <div className={l1Note.data?.status === "confirmed" ? "border border-bitcoin/60 px-2 py-1 text-bitcoin" : "border border-signal/40 px-2 py-1 text-signal"}>
                    YOUR PASS · {anchorLine}
                  </div>
                ) : null}
                {event?.description ? <p className="whitespace-pre-wrap leading-relaxed text-foreground">{event.description}</p> : null}
                <div className="space-y-1 border-t border-border/50 pt-2">
                  {LORE.map((l) => (
                    <p key={l} className="text-signal/80">› {l}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          {pass && tab === "whispers" ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="SPEAK WITHOUT A NAME…"
                className="w-full resize-none border border-border/60 bg-background p-2 text-foreground outline-none focus:border-signal/60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                className="w-full border border-signal/60 py-1.5 text-signal hover:bg-signal/15 disabled:opacity-40"
              >
                {sending ? "SENDING…" : "LEAVE WHISPER"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
