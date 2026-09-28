import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BuildRenderer } from "@/components/builds/BuildRenderer";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { buildInscriptionPayload } from "@/lib/builds";
import { runtimeDeploymentsForHeightQuery } from "@/lib/extender-code";
import type { ParcelPage } from "@/lib/profiles";

type View = "preview" | "code";

export function PublicBuildViewer({
  page,
  district,
}: {
  page: ParcelPage;
  district?: { name: string; slug: string } | null;
}) {
  const [view, setView] = useState<View>("preview");
  const [copied, setCopied] = useState(false);
  const deployments = useQuery(runtimeDeploymentsForHeightQuery(page.bitmapHeight));
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const activeDeployment = deployments.data?.find((item) => item.deploymentId === selectedDeploymentId)
    ?? deployments.data?.[0]
    ?? null;
  const source = useMemo(() => activeDeployment?.code ?? JSON.stringify(buildInscriptionPayload(page, district), null, 2), [activeDeployment, page, district]);

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      toast("BUILD CODE COPIED");
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      toast("COPY FAILED", { description: "SELECT THE CODE AND COPY IT MANUALLY" });
    }
  }

  return (
    <div className="overflow-hidden border border-border bg-background">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card p-2">
        <div className="flex min-w-0 items-center gap-1" role="tablist" aria-label="Public build view">
          <Button
            type="button"
            size="sm"
            variant={view === "preview" ? "default" : "ghost"}
            role="tab"
            aria-selected={view === "preview"}
            onClick={() => setView("preview")}
          >
            <Eye /> LIVE PREVIEW
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "code" ? "default" : "ghost"}
            role="tab"
            aria-selected={view === "code"}
            onClick={() => setView("code")}
          >
            <Code2 /> CODE
          </Button>
        </div>
        {view === "code" ? (
          <Button type="button" size="icon" variant="ghost" onClick={copySource} aria-label="Copy build code">
            {copied ? <Check /> : <Copy />}
          </Button>
        ) : (
          <span className="label hidden shrink-0 text-signal sm:block">LIVE · PUBLIC</span>
        )}
      </div>

      <div role="tabpanel" aria-label={view === "preview" ? "Live build preview" : "Build code"}>
        {view === "preview" ? (
          <div className="min-h-48 p-3 sm:p-4">
            {deployments.isPending ? (
              <div className="flex h-80 items-center justify-center border border-dashed border-border">
                <span className="label text-muted-foreground">LOADING LIVE 3D EXTENDER…</span>
              </div>
            ) : activeDeployment ? (
              <div className="space-y-2">
                {(deployments.data?.length ?? 0) > 1 ? (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {deployments.data?.map((deployment) => (
                      <Button
                        key={deployment.deploymentId}
                        type="button"
                        size="sm"
                        variant={deployment.deploymentId === activeDeployment.deploymentId ? "default" : "outline"}
                        onClick={() => setSelectedDeploymentId(deployment.deploymentId)}
                      >
                        {deployment.name} · V{deployment.semver}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <ExtenderPreview
                  code={activeDeployment.code}
                  height={activeDeployment.height}
                  club={activeDeployment.name}
                  config={activeDeployment.config}
                  autoRun
                  publicView
                  canvasHeight={420}
                />
              </div>
            ) : (
              <BuildRenderer kind={page.buildKind} config={page.buildConfig} height={page.bitmapHeight} />
            )}
          </div>
        ) : (
          <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[11px] leading-5 text-signal" data-no-translate>
            <code>{source}</code>
          </pre>
        )}
      </div>
    </div>
  );
}