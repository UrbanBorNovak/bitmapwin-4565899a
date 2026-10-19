import { useEffect, useRef, useState } from "react";
import type * as THREEType from "three";

type Status = { kind: "idle" } | { kind: "ok"; boxes: number } | { kind: "error"; message: string };

/** Paste a BWVX payload, preview it with the published loader, and download it as .GLB. */
export function BwvxTryViewer() {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ THREE: typeof THREEType; scene: THREEType.Scene; mesh: THREEType.Mesh | null; render: () => void } | null>(null);
  const seq = useRef(0);
  const [payload, setPayload] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false, cleanup = () => {};
    void import("three").then((THREE) => {
      if (dead || !host.current) return;
      const el = host.current;
      let renderer: THREEType.WebGLRenderer | null = null;
      try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { /* no WebGL: geometry still tracked */ }
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2));
      const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      const render = () => {
        const w = el.clientWidth || 320, h = el.clientHeight || 240;
        cam.aspect = w / h; cam.updateProjectionMatrix();
        const m = ctx.current?.mesh;
        const box = m ? new THREE.Box3().setFromObject(m) : new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(8, 8, 8));
        const c = box.getCenter(new THREE.Vector3()), r = Math.max(4, box.getSize(new THREE.Vector3()).length());
        cam.position.set(c.x + r, c.y + r * 0.8, c.z + r); cam.lookAt(c);
        if (renderer) { renderer.setSize(w, h, false); renderer.render(scene, cam); }
      };
      if (renderer) { renderer.domElement.className = "h-full w-full"; el.appendChild(renderer.domElement); }
      ctx.current = { THREE, scene, mesh: null, render };
      render();
      cleanup = () => { renderer?.dispose(); renderer?.domElement.remove(); };
    });
    return () => { dead = true; cleanup(); ctx.current = null; };
  }, []);

  const clear = () => {
    const c = ctx.current;
    if (c?.mesh) { c.scene.remove(c.mesh); c.mesh.geometry.dispose(); (c.mesh.material as THREEType.Material).dispose(); c.mesh = null; }
  };

  const load = async () => {
    const my = ++seq.current;
    clear(); // never leave the previous build visible while the next one loads or fails
    setStatus({ kind: "idle" });
    const { bwvxBoxes, loadBwvxMesh } = await import("@/lib/bwvx-export");
    if (my !== seq.current) return; // a newer load won
    try {
      const n = bwvxBoxes(payload.trim()).length;
      const c = ctx.current;
      if (c) { const mesh = loadBwvxMesh(c.THREE, payload.trim()); c.scene.add(mesh); c.mesh = mesh; c.render(); }
      setStatus({ kind: "ok", boxes: n });
    } catch (e) {
      ctx.current?.render();
      setStatus({ kind: "error", message: String((e as Error)?.message ?? e) });
    }
  };

  const download = async () => {
    const my = ++seq.current;
    setBusy(true);
    try {
      const { downloadPayloadGlb } = await import("@/lib/bwvx-export");
      const r = await downloadPayloadGlb(payload, "bwvx-build");
      if (my === seq.current) setStatus({ kind: "ok", boxes: r.boxes });
    } catch (e) {
      if (my === seq.current) { clear(); ctx.current?.render(); setStatus({ kind: "error", message: String((e as Error)?.message ?? e) }); }
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="bwvx-try" className="font-mono text-xs text-muted-foreground">PASTE A BASE64 PAYLOAD (BWVX1 OR BWVX2)</label>
        <textarea id="bwvx-try" data-testid="bwvx-try-input" value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} className="rounded border border-border bg-background p-2 font-mono text-xs" />
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="bwvx-try-load" onClick={() => void load()} className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-card">LOAD PREVIEW</button>
          <button type="button" data-testid="bwvx-try-glb" disabled={busy} onClick={() => void download()} className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-card disabled:opacity-50">DOWNLOAD .GLB</button>
        </div>
        <p aria-live="polite" className="font-mono text-xs">
          {status.kind === "ok" && <span data-testid="bwvx-try-ok" data-boxes={status.boxes} className="text-accent">LOADED · {status.boxes} BOXES · 1 DRAW CALL</span>}
          {status.kind === "error" && <span role="alert" data-testid="bwvx-try-error" className="text-destructive">{status.message}</span>}
        </p>
      </div>
      <div ref={host} data-testid="bwvx-try-canvas" data-boxes={status.kind === "ok" ? status.boxes : 0} className="h-60 rounded border border-border bg-background" />
    </div>
  );
}
