import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { codeFromManifest } from "@/lib/extender-sdk";
import { extenderVersionsQuery, type Extender } from "@/lib/extenders";

/** In-catalogue live 3D render of an extender's latest published code. */
export function ExtenderPreviewDialog({ extender, onClose }: { extender: Extender | null; onClose: () => void }) {
  const versions = useQuery(extenderVersionsQuery(extender?.id ?? null));
  const code =
    (versions.data ?? [])
      .filter((v) => v.status === "published")
      .map((v) => codeFromManifest(v.manifest))
      .find((c): c is string => Boolean(c)) ?? null;

  return (
    <Dialog open={extender !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="display">{extender?.name}</DialogTitle>
          <DialogDescription>{extender?.summary || "NO SUMMARY PROVIDED"}</DialogDescription>
        </DialogHeader>
        {versions.isPending ? (
          <p className="font-mono text-xs text-muted-foreground">&gt; LOADING 3D SCENE…</p>
        ) : code && extender ? (
          <ExtenderPreview key={extender.id} code={code} height={840000} club={extender.name} autoRun publicView canvasHeight={420} />
        ) : (
          <p className="border border-border p-4 font-mono text-xs text-muted-foreground">
            &gt; NO PUBLISHED CODE YET — NOTHING TO RENDER
          </p>
        )}
        {extender ? (
          <Link to="/extenders/$slug" params={{ slug: extender.slug }} className="btn-term-ghost inline-flex justify-center">
            [ OPEN FULL PAGE ]
          </Link>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
