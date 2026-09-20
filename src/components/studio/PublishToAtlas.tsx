import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { deployExtenderFn } from "@/lib/extenders.functions";
import { recordParcelBuildFn } from "@/lib/passport.functions";

/**
 * PUBLISH TO THE ATLAS — deploy a published version onto a BITMAP the user can
 * build on, then record the provenance event that makes it a landmark pin on
 * the map. Ownership is verified server-side; the provenance write is a bonus
 * and never blocks the deployment.
 */
export function PublishToAtlas({
  extenderId,
  extenderName,
  versionId,
  versionSemver,
}: {
  extenderId: string;
  extenderName: string;
  versionId: string | null;
  versionSemver: string | null;
}) {
  const deploy = useServerFn(deployExtenderFn);
  const recordBuild = useServerFn(recordParcelBuildFn);
  const queryClient = useQueryClient();
  const [heightText, setHeightText] = useState("");
  const [placed, setPlaced] = useState<number | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("PUBLISH A VERSION FIRST — THE ATLAS ONLY SHOWS PUBLISHED WORK");
      const block = Number(heightText.trim());
      if (!Number.isInteger(block) || block < 0) throw new Error("ENTER THE BITMAP NUMBER YOU BUILD ON");
      const result = await deploy({ data: { extenderId, versionId, height: block, config: {} } });
      try {
        await recordBuild({
          data: { bitmapHeight: block, buildKind: "experience", title: extenderName.slice(0, 120) },
        });
      } catch {
        // history is a bonus, never a blocker
      }
      return { block, grantedVia: String((result as { grantedVia?: unknown }).grantedVia ?? "ownership") };
    },
    onSuccess: ({ block, grantedVia }) => {
      setPlaced(block);
      toast("LIVE ON THE ATLAS", { description: `${block}.BITMAP · AUTHORISED VIA ${grantedVia.toUpperCase()}` });
      queryClient.invalidateQueries({ queryKey: ["tile-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["world-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["extender-stats"] });
      queryClient.invalidateQueries({ queryKey: ["provenance-stream"] });
      setHeightText("");
    },
    onError: (error) => toast("COULD NOT PLACE IT", { description: (error as Error).message }),
  });

  return (
    <div className="border border-signal/50 bg-surface p-4">
      <div className="label text-signal">5 · PUT IT ON THE ATLAS</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Name the BITMAP you hold, lease or hold build rights on. The experience goes live on that land and the map
        raises a landmark pin there with the provenance of the build.
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground" data-no-translate>
        {versionSemver ? `DEPLOYING v${versionSemver}` : "NO PUBLISHED VERSION YET"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={heightText}
          onChange={(e) => setHeightText(e.target.value)}
          placeholder="BITMAP number, e.g. 840000"
          className="min-w-[180px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-signal"
        />
        <button
          type="button"
          className="btn-term"
          disabled={run.isPending || !versionId}
          onClick={() => run.mutate()}
        >
          {run.isPending ? "[ VERIFYING LAND RIGHTS… ]" : "[ PUBLISH TO THE ATLAS ]"}
        </button>
      </div>
      {placed !== null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/map_/$block" params={{ block: String(placed) }} className="btn-term-ghost">
            [ SEE IT ON THE MAP ]
          </Link>
          <Link to="/oasis" search={{ height: placed }} className="btn-term-ghost">[ WALK INTO IT ]</Link>
        </div>
      ) : null}
    </div>
  );
}
