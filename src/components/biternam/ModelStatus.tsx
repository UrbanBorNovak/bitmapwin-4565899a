/** Loading / unavailable markers for on-chain models in Biternam rooms. Never substitutes another asset. */
import { Component, Suspense, useState, type ReactNode } from "react";
import { Html, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

export type SlotState = "loading" | "unavailable";

export function StatusMarker({ state, size, label, onRetry, compact }: { state: SlotState; size: number; label: string; onRetry?: () => void; compact?: boolean }) {
  const down = state === "unavailable";
  const click = (e: ThreeEvent<MouseEvent>) => { if (down && onRetry) { e.stopPropagation(); onRetry(); } };
  return (
    <group onClick={click}>
      <mesh position={[0, size * 0.35, 0]}>
        <boxGeometry args={[size * 0.7, size * 0.7, size * 0.7]} />
        <meshBasicMaterial color={down ? "#ff5a3d" : "#28e0ff"} wireframe />
      </mesh>
      <Html center position={[0, size * 0.85, 0]} zIndexRange={[20, 0]}>
        {down ? (
          <button type="button" title={`${label} unavailable from ordinals.com, retry`} aria-label={`Retry ${label}`} onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
            className="whitespace-nowrap rounded border border-destructive bg-card/90 px-1.5 py-0.5 font-mono text-[10px] text-destructive hover:bg-destructive hover:text-destructive-foreground">
            {compact ? "↻" : `${label} UNAVAILABLE · RETRY`}
          </button>
        ) : (
          <span className="whitespace-nowrap rounded border border-signal bg-card/90 px-1.5 py-0.5 font-mono text-[10px] text-signal">{compact ? "…" : `LOADING ${label}…`}</span>
        )}
      </Html>
    </group>
  );
}

class Catch extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFail(); }
  override render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Loads one on-chain GLB with explicit states. `children(gltfUrl)` renders the
 * model and must call `onEmpty` when the loaded scene has no meshes (the app's
 * loader resolves failed downloads as empty scenes).
 */
export function ModelSlot({ url, size, label, children, compact }: {
  url: string; size: number; label: string; compact?: boolean;
  children: (p: { onEmpty: () => void }) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retry = () => { useGLTF.clear(url); setFailed(false); setAttempt((a) => a + 1); };
  if (failed) return <StatusMarker state="unavailable" size={size} label={label} onRetry={retry} compact={compact} />;
  return (
    <Catch key={attempt} onFail={() => setFailed(true)}>
      <Suspense fallback={<StatusMarker state="loading" size={size} label={label} compact={compact} />}>
        {children({ onEmpty: () => setFailed(true) })}
      </Suspense>
    </Catch>
  );
}
