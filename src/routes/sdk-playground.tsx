import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { SafeOrbitControls } from "@/components/game/SafeOrbitControls";
import { ClientOnly } from "@tanstack/react-router";
import { DataBadge } from "@/components/extenders/DataBadge";
import { ExtenderPropGroup } from "@/components/extenders/ExtenderProps";
import { startExtender, type ExtenderRuntime } from "@/lib/extender-runtime";
import {
  EMPTY_SNAPSHOT,
  RUNTIME_LIMITS,
  STARTER_TEMPLATES,
  type ExtenderSnapshot,
} from "@/lib/extender-sdk";

export const Route = createFileRoute("/sdk-playground")({
  head: () => {
    const title = "SDK Playground — Run Extender Code Live";
    const description =
      "Write BitmapWin extender code and watch it execute in a sandbox: objects, movement, interaction and quests, before you publish a version.";
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
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const [code, setCode] = useState(STARTER_TEMPLATES[0]?.code ?? "");
  const [height, setHeight] = useState("36095");
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

  const run = useCallback(() => {
    stop();
    setError(null);
    setSnapshot(EMPTY_SNAPSHOT);
    const parsed = Number(height);
    runtime.current = startExtender(
      code,
      {
        height: Number.isFinite(parsed) ? parsed : 0,
        club: "PLAYGROUND",
        owner: null,
        config: {},
      },
      {
        onSnapshot: setSnapshot,
        onError: (message) => {
          setError(message);
          setRunning(false);
        },
      },
    );
    setRunning(true);
    // in the playground the visitor is always standing in the middle of the tile
    runtime.current.setPlayer({ x: 0, z: 0, y: 0 });
  }, [code, height, stop]);

  const bytes = new TextEncoder().encode(code).length;

  return (
    <div className="mx-auto max-w-[1250px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · SDK</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">SDK PLAYGROUND</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        This is the same sandbox the world uses. Whatever you see here is exactly what visitors see once you publish this
        code as a version and deploy it to a BITMAP you hold.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DataBadge kind="live" note="REAL EXECUTION — NOT A PREVIEW MOCK" />
        <Link to="/sdk" className="label text-muted-foreground hover:text-bitcoin">
          READ THE API →
        </Link>
        <Link to="/studio" className="label text-muted-foreground hover:text-bitcoin">
          PUBLISH IT →
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-1">
            {STARTER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setCode(template.code)}
                className="label border border-border px-2 py-1.5 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
              >
                {template.name}
              </button>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            rows={22}
            data-no-translate
            className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-term" onClick={run}>
              [ RUN CODE ]
            </button>
            <button type="button" className="btn-term-ghost" onClick={stop} disabled={!running}>
              [ STOP ]
            </button>
            <label className="label text-muted-foreground" htmlFor="playground-height">
              TILE
            </label>
            <input
              id="playground-height"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              className="w-24 border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
            />
            <span className="font-mono text-[10px] text-muted-foreground" data-no-translate>
              {bytes}/{RUNTIME_LIMITS.maxCodeBytes} BYTES
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-[420px] border border-border bg-background">
            <ClientOnly fallback={<div className="h-full w-full" />}>
              <SafeCanvas camera={{ position: [9, 7, 11], fov: 45, near: 0.1, far: 200 }} dpr={[1, 1.75]}>
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
                <SafeOrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} />
              </SafeCanvas>
            </ClientOnly>
          </div>

          <div className="border border-border bg-surface p-4 font-mono text-[11px]">
            <div className="flex justify-between text-bitcoin">
              <span>RUNTIME</span>
              <span data-no-translate>
                {error ? "STOPPED" : running ? "RUNNING" : "IDLE"} · {snapshot.props.length} OBJECTS ·{" "}
                {snapshot.time.toFixed(1)}s
              </span>
            </div>
            {error ? (
              <p className="mt-2 text-destructive" data-no-translate>
                {error}
              </p>
            ) : null}
            {snapshot.quests.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {snapshot.quests.map((quest) => (
                  <li key={quest.id} data-no-translate className="text-foreground">
                    [{quest.state.toUpperCase()}] {quest.title}
                    {quest.reward ? <span className="text-muted-foreground"> · {quest.reward}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground">
              {snapshot.logs.length === 0 ? (
                <p>&gt; NO OUTPUT YET — PRESS RUN CODE</p>
              ) : (
                snapshot.logs.map((line, index) => (
                  <p key={`${index}-${line}`} data-no-translate>
                    &gt; {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
