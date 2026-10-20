import { Suspense, lazy, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { REGISTRY_MODELS, stridesFor } from "@/lib/model-registry";
import { verifyRegistryModelFn } from "@/lib/model-registry.functions";
import { publishBitmapModelFn } from "@/lib/bitmap-models.functions";
import { bitmapModelQuery } from "@/lib/bitmap-models";

const ModelPreview = lazy(() => import("@/components/registry/ModelPreview"));

/** Land Forge drawer: pick a registry model, verify it live, place it on this BITMAP. */
export function RegistryDrawer({ height, canPlace }: { height: number | null; canPlace: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const [lift, setLift] = useState(0);
  const verify = useServerFn(verifyRegistryModelFn);
  const publish = useServerFn(publishBitmapModelFn);
  const client = useQueryClient();
  const current = useQuery({ ...bitmapModelQuery(height ?? 0), enabled: height !== null });

  const check = useQuery({
    queryKey: ["registry-verify", picked],
    queryFn: () => verify({ data: { inscription: picked! } }),
    enabled: !!picked,
    staleTime: 10 * 60_000,
  });

  const place = useMutation({
    mutationFn: () => publish({ data: { height: height!, inscriptionId: picked!, scale, rotationY: rot, heightOffset: lift } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bitmap-model", height] });
      client.invalidateQueries({ queryKey: ["map-bitmap-models"] });
      toast.success(`Model placed on ${height}.BITMAP`, { description: "Visible in the Oasis now" });
    },
    onError: (e) => toast.error("Could not place model", { description: (e as Error).message }),
  });

  const model = REGISTRY_MODELS.find((m) => m.inscription === picked);
  const verified = check.data?.ok === true;
  const blocker = height === null ? "Enter your BITMAP number first." : !canPlace ? "Only the BITMAP holder can place a model." : !verified ? "Waiting for on-chain check." : null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" data-testid="forge-registry" className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">◈ MODEL REGISTRY</button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto font-mono sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display">INSERT FROM MODEL REGISTRY</SheetTitle></SheetHeader>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {height !== null ? `${height}.BITMAP · ` : ""}one on-chain model per BITMAP{current.data ? ` · now: ${REGISTRY_MODELS.find((m) => m.inscription === current.data?.inscriptionId)?.label ?? current.data.inscriptionId.slice(0, 10) + "…"} (placing replaces it)` : ""}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {REGISTRY_MODELS.map((m) => (
            <button key={m.inscription} type="button" onClick={() => setPicked(m.inscription)}
              className={`rounded border p-2 text-left text-[10px] ${picked === m.inscription ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
              <span className="block text-foreground">{m.label}</span>{m.category} · ~{stridesFor(m.fit)} strides
            </button>
          ))}
        </div>
        {model && (
          <div className="mt-4 space-y-3 border-t border-border pt-3 text-[11px]">
            <div className="aspect-square overflow-hidden rounded border border-border bg-background">
              <ClientOnly fallback={null}>
                <Suspense fallback={<p className="p-4 text-muted-foreground">LOADING MODEL…</p>}>
                  <ModelPreview key={model.inscription} inscription={model.inscription} />
                </Suspense>
              </ClientOnly>
            </div>
            <p>
              {check.isFetching ? <span className="text-muted-foreground">READING INSCRIPTION…</span>
                : check.data?.ok ? <span className="text-signal">✓ VERIFIED · {(check.data.bodyBytes / 1024).toFixed(0)} KB · {check.data.triangleCount.toLocaleString()} TRIS</span>
                : check.data ? <span className="text-destructive">✕ {check.data.error}</span> : null}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Num label="SCALE" v={scale} set={setScale} min={0.1} max={4} step={0.1} />
              <Num label="ROTATION" v={rot} set={setRot} min={-6.28} max={6.28} step={0.1} />
              <Num label="LIFT" v={lift} set={setLift} min={0} max={2} step={0.05} />
            </div>
            <button type="button" disabled={!!blocker || place.isPending} onClick={() => place.mutate()}
              className="w-full rounded border border-primary px-3 py-2 text-primary disabled:opacity-50">
              {place.isPending ? "CHECKING OWNERSHIP…" : `PLACE ON ${height ?? "—"}.BITMAP`}
            </button>
            {blocker && <p className="text-[10px] text-muted-foreground">{blocker}</p>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Num({ label, v, set, min, max, step }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block text-[10px] text-muted-foreground">{label}
      <input type="number" value={v} min={min} max={max} step={step}
        onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
    </label>
  );
}
