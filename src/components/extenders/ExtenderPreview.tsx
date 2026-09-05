import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ClientOnly } from "@tanstack/react-router";
import { ExtenderPropGroup } from "@/components/extenders/ExtenderProps";
import { startExtender, type ExtenderRuntime } from "@/lib/extender-runtime";
import { EMPTY_SNAPSHOT, type ExtenderSnapshot } from "@/lib/extender-sdk";

/**
 * The tile-sized test bench: runs code in the same sandbox the world uses and
 * shows exactly what a visitor standing on the BITMAP would see.
 */
export function ExtenderPreview({
  code,
  height,
  club = "STUDIO",
  autoRun = false,
  canvasHeight = 320,
  onStatus,
}: {
  code: string;
  height: number;
  club?: string;
  autoRun?: boolean;
  canvasHeight?: number;
  onStatus?: (status: { running: boolean; error: string | null; props: number }) => void;
}) {
  const [snapshot, setSnapshot] = useState<ExtenderSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const runtime = useRef<ExtenderRuntime | null>(null);

  const stop = useCallback(() => {
    runtime.current?.stop();
    runtime.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    onStatus?.({ running, error, props: snapshot.props.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, error, snapshot.props.length]);

  const run = useCallback(() => {
    stop();
    if (!code.trim()) {
      setError("NOTHING TO RUN YET");
      return;
    }
    setError(null);
    setSnapshot(EMPTY_SNAPSHOT);
    runtime.current = startExtender(
      code,
      { height, club, owner: null, config: {} },
      {
        onSnapshot: setSnapshot,
        onError: (message) => {
          setError(message);
          setRunning(false);
        },
      },
    );
    setRunning(true);
    runtime.current.setPlayer({ x: 0, z: 0, y: 0 });
  }, [code, height, club, stop]);

  useEffect(() => {
    if (!autoRun) return;
    if (!code.trim()) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, code]);

  return (
    <div className="border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="label text-bitcoin">TEST ON A TILE</span>
        <span className="font-mono text-[10px] text-muted-foreground" data-no-translate>
          {error ? "STOPPED" : running ? "RUNNING" : "IDLE"} · {snapshot.props.length} OBJECTS ·{" "}
          {snapshot.quests.length} QUESTS · {snapshot.time.toFixed(1)}s
        </span>
      </header>

      <div style={{ height: canvasHeight }} className="bg-background">
        <ClientOnly fallback={<div className="h-full w-full" />}>
          <Canvas camera={{ position: [9, 7, 11], fov: 45, near: 0.1, far: 200 }} dpr={[1, 1.75]}>
            <color attach="background" args={["#0a0a0a"]} />
            <ambientLight intensity={0.7} />
            <directionalLight intensity={1.1} position={[8, 14, 6]} />
            <gridHelper args={[10, 10, "#3a3a3a", "#232323"]} />
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
              <planeGeometry args={[10, 10]} />
              <meshBasicMaterial color="#151515" />
            </mesh>
            <ExtenderPropGroup
              props={snapshot.props}
              unit={1}
              onInteract={(propId) => runtime.current?.interact(propId)}
            />
            <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} />
          </Canvas>
        </ClientOnly>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <button type="button" className="btn-term" onClick={run}>
          [ RUN ]
        </button>
        <button type="button" className="btn-term-ghost" onClick={stop} disabled={!running}>
          [ STOP ]
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">CLICK GLOWING OBJECTS TO TEST INTERACTION</span>
      </div>

      {error ? (
        <p className="border-t border-border px-3 py-2 font-mono text-[11px] text-destructive" data-no-translate>
          {error}
        </p>
      ) : null}

      {snapshot.quests.length > 0 ? (
        <ul className="space-y-1 border-t border-border px-3 py-2 font-mono text-[11px]">
          {snapshot.quests.map((quest) => (
            <li key={quest.id} data-no-translate>
              [{quest.state.toUpperCase()}] {quest.title}
              {quest.reward ? <span className="text-muted-foreground"> · {quest.reward}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="max-h-28 space-y-0.5 overflow-y-auto border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
        {snapshot.logs.length === 0 ? (
          <p>&gt; NO OUTPUT YET — PRESS RUN</p>
        ) : (
          snapshot.logs.map((line, index) => (
            <p key={`${index}-${line}`} data-no-translate>
              &gt; {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
