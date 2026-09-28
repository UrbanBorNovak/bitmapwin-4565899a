import { useMemo, useState } from "react";
import { Check, Code2, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BuildRenderer } from "@/components/builds/BuildRenderer";
import { buildInscriptionPayload } from "@/lib/builds";
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
  const source = useMemo(
    () => JSON.stringify(buildInscriptionPayload(page, district), null, 2),
    [page, district],
  );

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
            <BuildRenderer kind={page.buildKind} config={page.buildConfig} height={page.bitmapHeight} />
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