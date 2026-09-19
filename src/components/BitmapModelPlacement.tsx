import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Box, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bitmapModelQuery } from "@/lib/bitmap-models";
import { publishBitmapModelFn, removeBitmapModelFn } from "@/lib/bitmap-models.functions";

export function BitmapModelPlacement({
  height,
  canEdit,
  compact = false,
}: {
  height: number;
  canEdit: boolean;
  compact?: boolean;
}) {
  const current = useQuery(bitmapModelQuery(height));
  const client = useQueryClient();
  const publish = useServerFn(publishBitmapModelFn);
  const remove = useServerFn(removeBitmapModelFn);
  const [inscriptionId, setInscriptionId] = useState("");
  const [scale, setScale] = useState(1);
  const [rotationY, setRotationY] = useState(0);
  const [heightOffset, setHeightOffset] = useState(0);

  useEffect(() => {
    if (!current.data) return;
    setInscriptionId(current.data.inscriptionId);
    setScale(current.data.scale);
    setRotationY(current.data.rotationY);
    setHeightOffset(current.data.heightOffset);
  }, [current.data]);

  const save = useMutation({
    mutationFn: () => publish({ data: { height, inscriptionId: inscriptionId.trim(), scale, rotationY, heightOffset } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bitmap-model", height] });
      client.invalidateQueries({ queryKey: ["map-bitmap-models"] });
      toast(`${height}.BITMAP`, { description: "ON-CHAIN MODEL PUBLISHED TO THE WORLD" });
    },
    onError: (error) => toast("MODEL REJECTED", { description: (error as Error).message }),
  });
  const clear = useMutation({
    mutationFn: () => remove({ data: { height } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bitmap-model", height] });
      client.invalidateQueries({ queryKey: ["map-bitmap-models"] });
      setInscriptionId("");
      toast(`${height}.BITMAP`, { description: "MODEL REMOVED FROM THE WORLD" });
    },
    onError: (error) => toast("REMOVE FAILED", { description: (error as Error).message }),
  });

  return (
    <section className={compact ? "mt-4 border-t border-border pt-4" : "mt-6 border border-border"}>
      <header className={compact ? "flex items-center gap-2" : "flex items-center gap-2 border-b border-border px-4 py-3"}>
        <Box className="h-4 w-4 text-bitcoin" /><span className="label">3D WORLD MODEL</span>
      </header>
      <div className={compact ? "mt-3 space-y-3" : "space-y-4 p-4"}>
        {current.data ? (
          <p data-no-translate className="min-w-0 break-all font-mono text-xs text-muted-foreground">
            {current.data.inscriptionId} · {current.data.triangleCount.toLocaleString("en-US")} TRIANGLES
          </p>
        ) : <p className="font-mono text-xs text-muted-foreground">&gt; NO MODEL PLACED</p>}
        {canEdit ? (
          <>
            <label className="block"><span className="label">GLB INSCRIPTION ID</span><input value={inscriptionId} onChange={(event) => setInscriptionId(event.target.value.slice(0, 120))} placeholder="&lt;txid&gt;i0" className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground" /></label>
            <div className={compact ? "grid grid-cols-3 gap-2" : "grid gap-4 sm:grid-cols-3"}>
              <NumberField label="SCALE" min={0.1} max={4} step={0.1} value={scale} onChange={setScale} />
              <NumberField label="ROTATION" min={-6.28} max={6.28} step={0.1} value={rotationY} onChange={setRotationY} />
              <NumberField label="HEIGHT" min={0} max={2} step={0.05} value={heightOffset} onChange={setHeightOffset} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="btn-term" disabled={save.isPending || inscriptionId.trim().length < 66} onClick={() => save.mutate()}>{save.isPending ? "VALIDATING…" : "VALIDATE + PUBLISH"}</Button>
              {current.data ? <Button className="btn-term-ghost" variant="ghost" disabled={clear.isPending} onClick={() => clear.mutate()}><Trash2 /> REMOVE</Button> : null}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">model/gltf-binary (GLB) + GLTF + DRACO · 2 MB · 100K TRIANGLES · 8 TEXTURES · 4 ANIMATIONS MAX</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="label">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground" /></label>;
}
