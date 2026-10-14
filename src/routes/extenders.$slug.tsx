import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { InscriptionContent } from "@/components/InscriptionContent";
import {
  categoryGlyph,
  categoryLabel,
  extenderQuery,
  extenderStatsQuery,
  extenderVersionsQuery,
  versionRequirementsQuery,
} from "@/lib/extenders";
import { useAuthSession } from "@/lib/auth";
import { shortenAddress } from "@/lib/registry";
import { formatBit } from "@/lib/coins";
import { timeAgo } from "@/lib/bitmap";
import { deployExtenderFn } from "@/lib/extenders.functions";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { codeFromManifest } from "@/lib/extender-sdk";

export const Route = createFileRoute("/extenders/$slug")({
  head: ({ params }) => {
    const title = `${params.slug} — BitmapWin Extender`;
    const description = `Version history, dependencies, permissions and live deployments for the ${params.slug} extender on BITMAP land.`;
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
  component: ExtenderDetail,
});

function ExtenderDetail() {
  const { slug } = Route.useParams();
  const extender = useQuery(extenderQuery(slug));
  const versions = useQuery(extenderVersionsQuery(extender.data?.id ?? null));
  const stats = useQuery(extenderStatsQuery());
  const published = useMemo(
    () => (versions.data ?? []).filter((v) => v.status === "published"),
    [versions.data],
  );
  const latest = published[0] ?? null;
  const requirements = useQuery(versionRequirementsQuery(latest?.id ?? null));

  if (extender.isPending) {
    return <p className="mx-auto max-w-[1100px] px-4 py-20 font-mono text-sm text-muted-foreground md:px-8">&gt; LOADING EXTENDER…</p>;
  }
  if (!extender.data) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-20 md:px-8">
        <h1 className="display text-3xl">EXTENDER NOT FOUND</h1>
        <Link to="/extenders" className="btn-term mt-6 inline-flex">[ BACK TO EXTENDERS ]</Link>
      </div>
    );
  }

  const e = extender.data;
  const stat = stats.data?.get(e.id);
  const liveCode =
    published.map((v) => codeFromManifest(v.manifest)).find((c): c is string => Boolean(c)) ?? null;
  const previewHeight = 840000;

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-10 md:px-8 md:py-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="label flex items-center gap-2 text-bitcoin">
            <span aria-hidden="true">{categoryGlyph(e.category)}</span>
            {categoryLabel(e.category)}
            {e.isAiBuilt ? <span className="border border-bitcoin px-1.5 py-0.5">AI BUILT</span> : null}
          </div>
          <h1 className="display mt-3 text-3xl md:text-5xl">{e.name}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {e.summary || "NO SUMMARY PROVIDED"}
          </p>

          {liveCode ? (
            <div className="mt-6">
              <ExtenderPreview
                code={liveCode}
                height={previewHeight}
                club={e.name}
                autoRun
                publicView
                canvasHeight={460}
              />
            </div>
          ) : versions.isPending ? (
            <p className="mt-6 font-mono text-xs text-muted-foreground">&gt; LOADING 3D SCENE…</p>
          ) : (
            <p className="mt-6 border border-border bg-surface p-4 font-mono text-xs text-muted-foreground">
              &gt; NO PUBLISHED CODE YET — NOTHING TO RENDER
            </p>
          )}

          {e.previewInscriptionId ? (
            <div className="mt-6 border border-border bg-surface p-2">
              <InscriptionContent inscriptionId={e.previewInscriptionId} />
            </div>
          ) : null}

          <Section title="DESCRIPTION">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {e.description || "NO DATA YET"}
            </p>
          </Section>

          <Section title="COMPATIBILITY & REQUIREMENTS">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact k="SDK VERSION" v={latest?.sdkVersion ?? "NO DATA YET"} />
              <Fact k="LATEST VERSION" v={latest?.semver ?? "NOT PUBLISHED"} />
              <Fact k="LICENSE" v={e.license.toUpperCase()} />
              <Fact k="PRICE" v={e.monetization === "free" || e.priceBit <= 0 ? "FREE" : formatBit(e.priceBit)} />
            </dl>
            <div className="mt-5">
              <div className="label">DEPENDENCIES</div>
              {requirements.data?.dependencies.length ? (
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {requirements.data.dependencies.map((dep) => (
                    <li key={dep.id}>
                      {dep.slug ? (
                        <Link to="/extenders/$slug" params={{ slug: dep.slug }} className="text-bitcoin hover:text-foreground">
                          {dep.name ?? dep.slug}
                        </Link>
                      ) : (
                        <span>{dep.dependsOnExtenderId}</span>
                      )}{" "}
                      <span className="text-muted-foreground" data-no-translate>{dep.versionRange}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; NONE DECLARED — STANDS ALONE</p>
              )}
            </div>
            <div className="mt-5">
              <div className="label">PERMISSIONS REQUESTED ON LAND</div>
              {requirements.data?.permissions.length ? (
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {requirements.data.permissions.map((perm) => (
                    <li key={perm.permission}>
                      <span className="text-bitcoin">{perm.permission.toUpperCase()}</span>{" "}
                      <span className="text-muted-foreground">{perm.reason || "NO REASON GIVEN"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; NONE DECLARED</p>
              )}
            </div>
          </Section>

          <Section title="UPDATE HISTORY">
            {published.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">&gt; NO PUBLISHED VERSIONS YET</p>
            ) : (
              <ol className="space-y-3">
                {published.map((v) => (
                  <li key={v.id} className="border-l border-border pl-4">
                    <div className="font-mono text-xs text-foreground" data-no-translate>
                      v{v.semver} · SDK {v.sdkVersion} · {v.publishedAt ? timeAgo(v.publishedAt) : "—"}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {v.changelog || "NO CHANGELOG"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="border border-border bg-surface p-4">
            <DataBadge kind="live" />
            <dl className="mt-4 space-y-4">
              <Fact k="CREATOR" v={e.creatorAddress ? shortenAddress(e.creatorAddress) : "UNLINKED BUILDER"} />
              <Fact k="PUBLISHED VERSIONS" v={String(stat?.publishedVersions ?? 0)} />
              <Fact k="ACTIVE DEPLOYMENTS" v={String(stat?.activeDeployments ?? 0)} />
              <Fact k="LAST UPDATE" v={stat?.lastPublishedAt ? timeAgo(stat.lastPublishedAt) : "NO DATA YET"} />
            </dl>
            {e.creatorAddress ? (
              <Link
                to="/profile/$address"
                params={{ address: e.creatorAddress }}
                className="btn-term-ghost mt-4 inline-flex w-full justify-center"
              >
                [ VIEW BUILDER ]
              </Link>
            ) : null}
          </div>

          <DeployPanel extenderId={e.id} versionId={latest?.id ?? null} />
        </aside>
      </div>
    </div>
  );
}

function DeployPanel({ extenderId, versionId }: { extenderId: string; versionId: string | null }) {
  const { session } = useAuthSession();
  const [height, setHeight] = useState("");
  const [configText, setConfigText] = useState("{}");
  const [configInvalid, setConfigInvalid] = useState(false);
  const deploy = useServerFn(deployExtenderFn);
  const queryClient = useQueryClient();

  const run = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("THIS EXTENDER HAS NO PUBLISHED VERSION TO DEPLOY");
      const block = Number(height);
      if (!Number.isInteger(block) || block < 0) throw new Error("ENTER A VALID BITMAP NUMBER");
      let config: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(configText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          config = parsed as Record<string, unknown>;
          setConfigInvalid(false);
        } else {
          setConfigInvalid(true);
          throw new Error("CONFIG MUST BE A JSON OBJECT");
        }
      } catch {
        setConfigInvalid(true);
        throw new Error("CONFIG JSON IS INVALID");
      }
      return deploy({ data: { extenderId, versionId, height: block, config } });
    },
    onSuccess: (result) => {
      toast("EXTENDER DEPLOYED", { description: `AUTHORISED VIA ${String(result.grantedVia).toUpperCase()}` });
      queryClient.invalidateQueries({ queryKey: ["tile-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["extender-stats"] });
      queryClient.invalidateQueries({ queryKey: ["world-deployments"] });
      setHeight("");
      setConfigText("{}");
    },
    onError: (error) => toast("DEPLOY REFUSED", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">DEPLOY TO LAND</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Deployment is checked against live on-chain rights: you must hold the BITMAP, lease it, or hold a build grant
        from its owner.
      </p>
      {session ? (
        <div className="mt-4 space-y-2">
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="BITMAP number, e.g. 840000"
            className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          />
          <textarea
            value={configText}
            onChange={(e) => {
              setConfigText(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                setConfigInvalid(!(parsed && typeof parsed === "object" && !Array.isArray(parsed)));
              } catch {
                setConfigInvalid(true);
              }
            }}
            placeholder='{"greeting":"Welcome traveller","difficulty":"normal"}'
            rows={3}
            className="w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
            data-no-translate
          />
          {configInvalid ? (
            <p className="font-mono text-[10px] text-destructive">INVALID JSON — MUST BE AN OBJECT</p>
          ) : (
            <p className="font-mono text-[10px] text-muted-foreground">PASSED TO land.config AT RUNTIME</p>
          )}
          <button type="button" className="btn-term w-full" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "[ VERIFYING OWNERSHIP… ]" : "[ DEPLOY ]"}
          </button>
        </div>
      ) : (
        <Link to="/auth" className="btn-term-ghost mt-4 inline-flex w-full justify-center">[ SIGN IN TO DEPLOY ]</Link>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className="mt-1 font-mono text-sm text-foreground" data-no-translate>{v}</dd>
    </div>
  );
}
