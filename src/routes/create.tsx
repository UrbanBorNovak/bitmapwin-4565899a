import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { useAuthSession } from "@/lib/auth";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { useWalletSession } from "@/lib/wallet-session";
import { SDK_VERSION, categoryLabel, slugify } from "@/lib/extenders";
import { createExtenderFn, deployExtenderFn, publishVersionFn } from "@/lib/extenders.functions";
import { buildExtenderPackageFn } from "@/lib/extender-ai.functions";
import { RUNTIME_LIMITS } from "@/lib/extender-sdk";

/**
 * CREATE WITH AI — the whole build in one page.
 *
 * A brief goes to the model, which plans the package and writes real SDK code;
 * the code runs in the same sandbox the world uses; then the package is
 * registered, versioned, published and deployed onto a BITMAP the signed-in
 * builder actually holds. Every step here writes real rows — nothing is mocked.
 */
export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isFinite(height) && height >= 0 ? { height } : {};
  },
  head: () => {
    const title = "Create With AI — Build an Experience for Your BITMAP";
    const description =
      "Describe a place in plain English. The builder plans the package, writes the world code, runs it in the sandbox, then publishes and deploys it onto land you hold.";
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
  component: CreatePage,
});

const IDEAS = [
  "A medieval tavern with a bartender NPC, tables, chairs, a quest board and a drink-selling interaction",
  "A pirate harbour with a pier, three sailing ships, a merchant and two quests",
  "A neon night market with stalls, lanterns, a trader and a haggling quest",
  "A watchtower with a rotating beacon and a climb-to-the-top quest",
];

type Design = {
  name: string;
  summary: string;
  category: string;
  tags: string[];
  stages: Array<{ label: string; detail: string }>;
  assets: Array<{ name: string; kind: string; note: string }>;
};

type Deployed = { slug: string; height: number; semver: string };

function CreatePage() {
  const { height: searchHeight } = Route.useSearch();
  const { session, loading } = useAuthSession();
  const wallet = useWalletSession();
  const links = useQuery(myWalletLinksQuery(session?.user?.id ?? null));
  const address = wallet?.ordinalsAddress ?? links.data?.[0]?.address ?? "";
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const held = useQuery(heldHeightsQuery(addresses));

  const [prompt, setPrompt] = useState("");
  const [design, setDesign] = useState<Design | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ running: boolean; error: string | null; props: number }>({
    running: false,
    error: null,
    props: 0,
  });
  const [target, setTarget] = useState(searchHeight ? String(searchHeight) : "");
  const [deployed, setDeployed] = useState<Deployed | null>(null);

  const build = useServerFn(buildExtenderPackageFn);
  const createExtender = useServerFn(createExtenderFn);
  const publishVersion = useServerFn(publishVersionFn);
  const deploy = useServerFn(deployExtenderFn);
  const queryClient = useQueryClient();

  const heights = held.data ?? [];
  const testHeight = Number.isFinite(Number(target)) && Number(target) > 0 ? Number(target) : (searchHeight ?? 36095);

  const generate = useMutation({
    mutationFn: async () => {
      const brief = prompt.trim();
      if (brief.length < 8) throw new Error("DESCRIBE WHAT SHOULD STAND ON THE TILE");
      return build({ data: { prompt: brief, height: testHeight } });
    },
    onSuccess: (result) => {
      setDesign(result.design as Design);
      setCode(result.code);
      setDeployed(null);
      toast("PACKAGE BUILT", { description: "IT IS RUNNING IN THE SANDBOX BELOW" });
    },
    onError: (error) => toast("BUILD FAILED", { description: (error as Error).message }),
  });

  const ship = useMutation({
    mutationFn: async () => {
      if (!design || !code.trim()) throw new Error("BUILD SOMETHING FIRST");
      const chosen = Number(target);
      if (!Number.isFinite(chosen) || chosen < 0) throw new Error("PICK THE BITMAP TO DEPLOY ON");
      const slugBase = slugify(design.name) || "ai-extender";
      const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`.slice(0, 60);

      const created = await createExtender({
        data: {
          slug,
          name: design.name.slice(0, 80),
          summary: design.summary.slice(0, 200),
          description: design.stages.map((s) => `${s.label}: ${s.detail}`).join("\n").slice(0, 4000),
          category: design.category,
          tags: design.tags.slice(0, 8),
          isAiBuilt: true,
          license: "all-rights-reserved",
          monetization: "free",
          priceSats: 0,
          iconInscriptionId: null,
          previewInscriptionId: null,
        },
      });

      const version = await publishVersion({
        data: {
          extenderId: created.id,
          semver: "1.0.0",
          sdkVersion: SDK_VERSION,
          changelog: `Built with AI from: ${prompt.trim().slice(0, 300)}`,
          manifest: {
            code,
            builtWith: "ai",
            plan: design.stages,
            assets: design.assets,
            brief: prompt.trim().slice(0, 1200),
          },
          publish: true,
          dependencies: [],
          permissions: [],
        },
      });

      await deploy({
        data: { extenderId: created.id, versionId: version.id, height: chosen, config: {} },
      });

      return { slug, height: chosen, semver: "1.0.0" } satisfies Deployed;
    },
    onSuccess: (result) => {
      setDeployed(result);
      queryClient.invalidateQueries({ queryKey: ["my-extenders"] });
      queryClient.invalidateQueries({ queryKey: ["extenders"] });
      queryClient.invalidateQueries({ queryKey: ["tile-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["world-deployments"] });
      toast("DEPLOYED AND PUBLISHED", { description: `${result.height}.BITMAP · v${result.semver}` });
    },
    onError: (error) => toast("COULD NOT DEPLOY", { description: (error as Error).message }),
  });

  if (loading) {
    return <p className="mx-auto max-w-[1300px] px-4 py-20 font-mono text-sm text-muted-foreground md:px-8">&gt; CHECKING SESSION…</p>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-20 md:px-8">
        <div className="label text-bitcoin">BEDROCK · CREATE WITH AI</div>
        <h1 className="display mt-3 text-3xl md:text-5xl">CREATE WITH AI</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sign in to build. The builder writes real code, publishes a real version and deploys it on land you hold, so
          it needs an account and a connected wallet.
        </p>
        <Link to="/auth" className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · CREATE WITH AI</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">WHAT DO YOU WANT TO BUILD?</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Describe the place in plain words. The builder plans it, writes the code, runs it in the sandbox in front of
        you, and then puts it on your land as a published package.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="REAL CODE · REAL SANDBOX · REAL DEPLOY" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="border border-bitcoin/50 bg-surface p-4">
            <div className="label text-bitcoin">1 · THE BRIEF</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Build a medieval tavern for my BITMAP. Add a bartender NPC, tables, chairs, a quest board and a simple drink-selling interaction."
              className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-bitcoin"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setPrompt(idea)}
                  className="label border border-border px-2 py-1.5 text-left text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
                >
                  {idea.split(" ").slice(0, 3).join(" ")}
                </button>
              ))}
            </div>
            <button type="button" className="btn-term mt-3 w-full" disabled={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? "[ BUILDING… ]" : design ? "[ BUILD AGAIN ]" : "[ BUILD IT ]"}
            </button>
          </div>

          <div className="border border-border bg-surface p-4">
            <div className="label text-bitcoin">2 · PLANNING</div>
            {generate.isPending ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; PLANNING THE PACKAGE<span className="blink">_</span></p>
            ) : !design ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; NOTHING PLANNED YET</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="display text-lg">{design.name}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{design.summary}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground" data-no-translate>
                    {categoryLabel(design.category)} · {design.tags.join(" · ") || "NO TAGS"}
                  </p>
                </div>
                <ol className="space-y-2">
                  {design.stages.map((stage) => (
                    <li key={stage.label + stage.detail} className="font-mono text-[11px]">
                      <span className="text-bitcoin">✓ </span>
                      <span className="text-foreground" data-no-translate>{stage.label}</span>
                      <span className="text-muted-foreground"> — {stage.detail}</span>
                    </li>
                  ))}
                </ol>
                {design.assets.length > 0 ? (
                  <div>
                    <div className="label text-muted-foreground">ASSETS IN THE SCENE</div>
                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                      {design.assets.map((asset) => (
                        <li key={asset.name + asset.kind}>
                          <span className="text-foreground">{asset.name}</span>{" "}
                          <span data-no-translate>[{asset.kind.toUpperCase()}]</span> {asset.note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {code ? (
            <details className="border border-border bg-surface p-4">
              <summary className="label cursor-pointer text-bitcoin">THE CODE IT WROTE</summary>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                rows={16}
                data-no-translate
                className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
              />
              <p className="mt-1 font-mono text-[10px] text-muted-foreground" data-no-translate>
                {new TextEncoder().encode(code).length} / {RUNTIME_LIMITS.maxCodeBytes} BYTES
              </p>
            </details>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="border border-border bg-surface px-3 py-2">
            <div className="label text-bitcoin">3 · SANDBOX</div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              THIS IS THE SANDBOX THE WORLD RUNS — WHAT YOU SEE IS WHAT A VISITOR SEES
            </p>
          </div>
          <ExtenderPreview
            code={code}
            height={testHeight}
            club={design?.name ?? "AI BUILD"}
            autoRun
            canvasHeight={380}
            onStatus={setStatus}
          />
          <p className="font-mono text-[10px] text-muted-foreground" data-no-translate>
            {status.error
              ? `SANDBOX ERROR: ${status.error}`
              : status.running
                ? `RUNNING · ${status.props} OBJECTS PLACED`
                : "NOT RUNNING YET"}
          </p>

          <div className="border border-border bg-surface p-4">
            <div className="label text-bitcoin">4 · DEPLOY ON YOUR LAND</div>
            {held.isPending ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; CHECKING WHICH BITMAPS YOU HOLD…</p>
            ) : heights.length === 0 ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                &gt; NO LAND FOUND FOR THIS WALLET — CONNECT IT ON{" "}
                <Link to="/wallet" className="text-bitcoin underline">/WALLET</Link>{" "}
                OR TYPE A BITMAP YOU HOLD BELOW
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1">
                {heights.slice(0, 40).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setTarget(String(h))}
                    className={`label border px-2 py-1.5 ${
                      String(h) === target ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    data-no-translate
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="label text-muted-foreground">BITMAP</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="382441"
                className="w-32 border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
                data-no-translate
              />
            </div>
            <button
              type="button"
              className="btn-term mt-3 w-full"
              disabled={ship.isPending || !design || !code.trim()}
              onClick={() => ship.mutate()}
            >
              {ship.isPending ? "[ PUBLISHING & DEPLOYING… ]" : "[ PUBLISH & DEPLOY ]"}
            </button>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              DEPLOYING IS CHECKED AGAINST LIVE ON-CHAIN LAND RIGHTS — IT FAILS IF YOU DO NOT HOLD THE BITMAP
            </p>
          </div>

          {deployed ? (
            <div className="border border-bitcoin bg-surface p-4">
              <div className="label text-bitcoin">✓ DEPLOYED</div>
              <p className="mt-2 font-mono text-xs" data-no-translate>
                {deployed.height}.BITMAP · v{deployed.semver} · ACTIVE
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/map" search={{ height: deployed.height }} className="btn-term">[ ENTER EXPERIENCE ]</Link>
                <Link to="/extenders/$slug" params={{ slug: deployed.slug }} className="btn-term-ghost">[ MANAGE ]</Link>
                <Link to="/studio" className="btn-term-ghost">[ OPEN IN STUDIO ]</Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
