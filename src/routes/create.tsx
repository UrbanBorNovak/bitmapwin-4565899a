import { ExperienceFlow } from "@/components/studio/ExperienceFlow";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { MvpFlowRail } from "@/components/MvpFlowRail";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { TerritoryShareCard } from "@/components/TerritoryShareCard";
import { FirstTenMinutes } from "@/components/FirstTenMinutes";

import { useAuthSession } from "@/lib/auth";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { useWalletSession } from "@/lib/wallet-session";
import {
  SDK_VERSION,
  categoryLabel,
  extenderVersionsQuery,
  myExtendersQuery,
  slugify,
  type Extender,
} from "@/lib/extenders";
import { createExtenderFn, deployExtenderFn, publishVersionFn } from "@/lib/extenders.functions";
import { buildExtenderPackageFn } from "@/lib/extender-ai.functions";
import { RUNTIME_LIMITS } from "@/lib/extender-sdk";
import { BUILD_TIERS, DEFAULT_BUILD_TIER, buildTier, type BuildTierId } from "@/lib/build-tiers";
import { coinBalanceQuery, formatBit } from "@/lib/coins";

/**
 * CREATE WITH AI — the whole build in one page.
 *
 * A brief goes to the model, which plans the package and writes real SDK code;
 * the code runs in the same sandbox the world uses; then the package is
 * registered, versioned, published and deployed onto a BITMAP the signed-in
 * builder actually holds. Every step here writes real rows — nothing is mocked.
 */
export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): { height?: number; prompt?: string } => {
    const height = Number(search["height"]);
    const raw = search["prompt"];
    const brief = typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 1200) : undefined;
    return {
      ...(Number.isFinite(height) && height >= 0 ? { height } : {}),
      ...(brief ? { prompt: brief } : {}),
    };
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

type ModelAsset = { inscriptionId: string; height: number; triangleCount: number; animationCount: number };

type Deployed = { slug: string; height: number; semver: string; extenderId: string };


function CreatePage() {
  const { height: searchHeight, prompt: searchPrompt } = Route.useSearch();
  const { session, user, loading } = useAuthSession();
  const wallet = useWalletSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = wallet?.ordinalsAddress ?? links.data?.[0]?.address ?? "";
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const held = useQuery(heldHeightsQuery(addresses));

  const balances = useQuery({ ...coinBalanceQuery(addresses), enabled: addresses.length > 0 });
  const bitBalance = (balances.data ?? []).reduce((sum, row) => sum + row.balance, 0);

  // A brief typed on the home page arrives as a search param and pre-fills the builder.
  const [prompt, setPrompt] = useState(searchPrompt ?? "");

  const [tierId, setTierId] = useState<BuildTierId>(DEFAULT_BUILD_TIER);
  const [priceBit, setPriceBit] = useState("0");
  const tier = buildTier(tierId);
  const [design, setDesign] = useState<Design | null>(null);
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [modelsDowngraded, setModelsDowngraded] = useState(0);
  const [code, setCode] = useState("");

  const [status, setStatus] = useState<{ running: boolean; error: string | null; props: number }>({
    running: false,
    error: null,
    props: 0,
  });
  const [target, setTarget] = useState(searchHeight ? String(searchHeight) : "");
  const [deployed, setDeployed] = useState<Deployed | null>(null);

  const [existingExtenderId, setExistingExtenderId] = useState<string | "new">("new");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [iconInscriptionId, setIconInscriptionId] = useState("");
  const [previewInscriptionId, setPreviewInscriptionId] = useState("");

  const build = useServerFn(buildExtenderPackageFn);
  const createExtender = useServerFn(createExtenderFn);
  const publishVersion = useServerFn(publishVersionFn);
  const deploy = useServerFn(deployExtenderFn);
  const queryClient = useQueryClient();

  const mine = useQuery(myExtendersQuery(user?.id ?? null));
  const selectedExtender = (mine.data ?? []).find((e: Extender) => e.id === existingExtenderId);
  const existingVersions = useQuery(extenderVersionsQuery(selectedExtender?.id ?? null));
  const latestExisting = existingVersions.data?.[0] ?? null;

  const heights = held.data ?? [];
  const testHeight = Number.isFinite(Number(target)) && Number(target) > 0 ? Number(target) : (searchHeight ?? 36095);

  // Pick the first BITMAP the builder holds automatically so nobody has to type a number.
  useEffect(() => {
    if (target || heights.length === 0) return;
    setTarget(String(heights[0]));
  }, [heights, target]);


  const generate = useMutation({
    mutationFn: async () => {
      const brief = prompt.trim();
      if (brief.length < 8) throw new Error("DESCRIBE WHAT SHOULD STAND ON THE TILE");
      if (!address) throw new Error("CONNECT A VERIFIED WALLET TO PAY IN BIT");
      if (bitBalance < tier.costBit) {
        throw new Error(`${tier.label} COSTS ${tier.costBit} BIT — YOU HOLD ${Math.round(bitBalance)} BIT`);
      }
      return build({ data: { prompt: brief, height: testHeight, tier: tierId, address } });
    },
    onSuccess: (result) => {
      setDesign(result.design as Design);
      setCode(result.code);
      setModels((result.models ?? []) as ModelAsset[]);
      setModelsDowngraded(result.modelsDowngraded ?? 0);
      setDeployed(null);
      queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      toast("PACKAGE BUILT", {
        description: `${result.costBit} BIT SPENT · ${Math.round(result.balance)} BIT LEFT`,
      });
    },

    onError: (error) => toast("BUILD FAILED", { description: (error as Error).message }),
  });

  const ship = useMutation({
    mutationFn: async () => {
      if (!design || !code.trim()) throw new Error("BUILD SOMETHING FIRST");
      const chosen = Number(target);
      if (!Number.isFinite(chosen) || chosen < 0) throw new Error("PICK THE BITMAP TO DEPLOY ON");
      const askBit = Math.max(0, Math.round(Number(priceBit) || 0));

      let extenderId: string;
      let slug: string;
      let semver: string;

      if (selectedExtender) {
        extenderId = selectedExtender.id;
        slug = selectedExtender.slug;
        semver = nextSemver(latestExisting?.semver ?? null);
      } else {
        const slugBase = slugify(design.name) || "ai-extender";
        slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`.slice(0, 60);
        semver = "1.0.0";

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
            monetization: askBit > 0 ? "paid" : "free",
            priceSats: 0,
            priceBit: askBit,
            iconInscriptionId: iconInscriptionId.trim() || null,
            previewInscriptionId: previewInscriptionId.trim() || null,
          },
        });
        extenderId = created.id;
      }

      const version = await publishVersion({
        data: {
          extenderId,
          semver,
          sdkVersion: SDK_VERSION,
          changelog: `Built with AI from: ${prompt.trim().slice(0, 300)}`,
          manifest: {
            code,
            builtWith: "ai",
            plan: design.stages,
            assets: design.assets,
            models,
            brief: prompt.trim().slice(0, 1200),
            configSchema: Object.keys(config).length > 0 ? config : undefined,
          },
          publish: true,
          dependencies: [],
          permissions: [],
        },
      });

      await deploy({
        data: { extenderId, versionId: version.versionId, height: chosen, config },
      });

      return { slug, height: chosen, semver, extenderId } satisfies Deployed;
    },
    onSuccess: (result) => {
      setDeployed(result);
      queryClient.invalidateQueries({ queryKey: ["my-extenders"] });
      queryClient.invalidateQueries({ queryKey: ["extender-versions"] });
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
      <ExperienceFlow current="describe" />
      <MvpFlowRail active="deploy" {...(searchHeight === undefined ? {} : { height: searchHeight })} />
      <div className="mx-auto mt-4 grid max-w-[1600px] gap-px border border-border px-0 md:grid-cols-2">
        <Link
          to="/forge"
          {...(searchHeight === undefined ? {} : { search: { height: searchHeight } as never })}
          className="group block border-l-2 border-bitcoin p-4 hover:bg-bitcoin/5"
        >
          <div className="label text-bitcoin">START HERE · LAND FORGE</div>
          <div className="display mt-1 text-lg">BUILD VOXELS ON YOUR BITMAP →</div>
          <p className="mt-1 text-xs text-muted-foreground">Place blocks on your parcels and inscribe the build onto your BITMAP's own sat.</p>
        </Link>
        <div className="border-l-2 border-signal p-4">
          <div className="label text-signal">YOU ARE HERE · AI EXPERIENCES</div>
          <div className="display mt-1 text-lg">DESCRIBE A PLACE, AI WRITES IT</div>
          <p className="mt-1 text-xs text-muted-foreground">Scripted places with characters and quests, deployed onto land you hold. Continue below.</p>
        </div>
      </div>
      <h1 className="display mt-6 text-3xl md:text-5xl">WHAT DO YOU WANT TO BUILD?</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Two steps: say what you want, then put it on your land. Everything else is done for you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="REAL CODE · REAL SANDBOX · REAL DEPLOY" />
      </div>
      <div className="mt-6 max-w-3xl">
        <FirstTenMinutes compact />
      </div>


      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="border border-bitcoin/50 bg-surface p-4">
            <div data-tour="create-brief" className="label text-bitcoin">STEP 1 · SAY WHAT YOU WANT</div>
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
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <div className="label text-muted-foreground">HOW BIG?</div>
                <div className="font-mono text-[10px] text-muted-foreground" data-no-translate>
                  YOU HOLD {formatBit(bitBalance)}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {BUILD_TIERS.map((option) => {
                  const affordable = bitBalance >= option.costBit;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTierId(option.id)}
                      className={`terminal-interactive border px-2 py-1.5 text-left ${
                        option.id === tierId ? "border-bitcoin" : "border-border"
                      }`}
                    >
                      <span className={`label ${option.id === tierId ? "text-bitcoin" : "text-foreground"}`} data-no-translate>
                        {option.label}
                      </span>
                      <span
                        className={`ml-2 font-mono text-[10px] ${affordable ? "text-muted-foreground" : "text-muted-foreground line-through"}`}
                        data-no-translate
                      >
                        {option.costBit.toLocaleString("en-US")} BIT
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                {tier.detail.toUpperCase()} · UP TO {tier.maxProps} OBJECTS AND {tier.maxQuests} QUESTS · ONLY CHARGED IF IT WORKS
              </p>
            </div>
            <button type="button" className="btn-term mt-3 w-full" disabled={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending
                ? "[ BUILDING… ]"
                : design
                  ? `[ BUILD AGAIN · ${tier.costBit} BIT ]`
                  : `[ BUILD IT · ${tier.costBit} BIT ]`}
            </button>
          </div>

          <div className="border border-border bg-surface p-4">
            <div className="label text-bitcoin">WHAT IT MADE</div>
            {generate.isPending ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; BUILDING IT NOW<span className="blink">_</span></p>
            ) : !design ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; NOTHING BUILT YET</p>
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
                <div>
                  <div className="label text-muted-foreground">ON-CHAIN 3D MODELS PLACED</div>
                  {models.length > 0 ? (
                    <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted-foreground">
                      {models.map((model) => (
                        <li key={model.inscriptionId} data-no-translate>
                          <span className="text-bitcoin">▣ </span>
                          {model.inscriptionId.slice(0, 10)}…{model.inscriptionId.slice(-6)} · {model.height}.BITMAP ·{" "}
                          {model.triangleCount.toLocaleString()} TRIS
                          {model.animationCount > 0 ? " · ANIMATED" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      &gt; NO VALIDATED GLB INSCRIPTION IN THE REGISTRY YET — THIS BUILD USES PRIMITIVE GEOMETRY ONLY
                      {modelsDowngraded > 0 ? ` (${modelsDowngraded} MODEL CALLS DOWNGRADED)` : ""}
                    </p>
                  )}
                </div>
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
            <div className="label text-bitcoin">LIVE PREVIEW</div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              EXACTLY WHAT A VISITOR WILL SEE ON YOUR LAND
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
            <div className="label text-bitcoin">STEP 2 · PUT IT ON YOUR LAND</div>

            {held.isPending ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">&gt; CHECKING WHICH BITMAPS YOU HOLD…</p>
            ) : heights.length === 0 ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                &gt; NO LAND FOUND FOR THIS WALLET — CONNECT IT ON{" "}
                <Link to="/wallet" className="text-bitcoin underline">/WALLET</Link>{" "}
                OR TYPE A BITMAP YOU HOLD BELOW
              </p>
            ) : (
              <>
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">PICK ONE OF YOUR BITMAPS</p>
                <div className="mt-2 flex flex-wrap gap-1">
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
              </>
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
              className="btn-term mt-4 w-full"
              disabled={ship.isPending || !design || !code.trim()}
              onClick={() => ship.mutate()}
            >
              {ship.isPending ? "[ PUTTING IT ON YOUR LAND… ]" : "[ PUT IT ON MY LAND ]"}
            </button>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              GOES LIVE ON {target || "YOUR BITMAP"} AND IS SHARED FREE IN THE MARKET · YOUR LAND RIGHTS ARE CHECKED ON-CHAIN
            </p>

            <details className="mt-4 border-t border-border pt-3">
              <summary className="label cursor-pointer text-muted-foreground hover:text-bitcoin">
                OPTIONAL SETTINGS
              </summary>

              <div className="mt-3">
                <div className="label text-muted-foreground">ADD TO AN EXISTING EXTENDER</div>
                <select
                  value={existingExtenderId}
                  onChange={(e) => setExistingExtenderId(e.target.value)}
                  className="mt-2 w-full border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
                  data-no-translate
                >
                  <option value="new">+ CREATE NEW EXTENDER</option>
                  {(mine.data ?? []).map((e: Extender) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.slug}
                    </option>
                  ))}
                </select>
                {selectedExtender ? (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground" data-no-translate>
                    &gt; VERSION WILL BE v{nextSemver(latestExisting?.semver ?? null)} · LATEST v{latestExisting?.semver ?? "—"}
                  </p>
                ) : null}
              </div>

              {selectedExtender ? null : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="label text-muted-foreground">ICON INSCRIPTION</div>
                    <input
                      value={iconInscriptionId}
                      onChange={(e) => setIconInscriptionId(e.target.value)}
                      placeholder="abc123...i0"
                      className="mt-2 w-full border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
                      data-no-translate
                    />
                  </div>
                  <div>
                    <div className="label text-muted-foreground">PREVIEW INSCRIPTION</div>
                    <input
                      value={previewInscriptionId}
                      onChange={(e) => setPreviewInscriptionId(e.target.value)}
                      placeholder="abc123...i0"
                      className="mt-2 w-full border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
                      data-no-translate
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="label text-muted-foreground">PRICE IN BIT</span>
                <input
                  value={priceBit}
                  onChange={(e) => setPriceBit(e.target.value)}
                  placeholder="0"
                  className="w-32 border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
                  data-no-translate
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {Math.round(Number(priceBit) || 0) > 0
                    ? `OTHERS PAY ${formatBit(Math.round(Number(priceBit)))} TO USE IT`
                    : "0 = FREE FOR EVERYONE"}
                </span>
              </div>

              <div className="mt-4">
                <div className="label text-muted-foreground">SETTINGS PASSED TO THE BUILD (JSON)</div>
                <ConfigEditor value={config} onChange={setConfig} />
              </div>
            </details>
          </div>

          {deployed ? (
            <div className="border border-bitcoin bg-surface p-4">
              <div className="label text-bitcoin">✓ DEPLOYED</div>
              <p className="mt-2 font-mono text-xs" data-no-translate>
                {deployed.height}.BITMAP · v{deployed.semver} · ACTIVE
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/oasis" search={{ height: deployed.height }} className="btn-term">[ ENTER EXPERIENCE ]</Link>
                <Link to="/extenders/$slug" params={{ slug: deployed.slug }} className="btn-term-ghost">[ MANAGE ]</Link>
                <Link to="/studio" search={{ selected: deployed.extenderId }} className="btn-term-ghost">[ OPEN IN STUDIO ]</Link>
              </div>
            </div>
          ) : null}

          {deployed ? (
            <TerritoryShareCard
              height={deployed.height}
              title={design?.name ?? null}
              tags={design ? [categoryLabel(design.category), ...design.tags.slice(0, 3)] : []}
            />
          ) : null}

        </div>
      </div>
    </div>
  );
}

function ConfigEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              onChange(parsed as Record<string, unknown>);
              setInvalid(false);
            } else {
              setInvalid(true);
            }
          } catch {
            setInvalid(true);
          }
        }}
        rows={4}
        placeholder='{"greeting":"Welcome traveller","difficulty":"normal"}'
        className="w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
        data-no-translate
      />
      {invalid ? (
        <p className="mt-1 font-mono text-[10px] text-destructive">INVALID JSON — MUST BE AN OBJECT</p>
      ) : (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          PASSED TO land.config AT RUNTIME. LEAVE EMPTY IF THE BUILD DOES NOT NEED IT.
        </p>
      )}
    </div>
  );
}

function nextSemver(current: string | null): string {
  if (!current) return "1.0.0";
  const parts = current.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "1.0.0";
  return `${parts[0]}.${(parts[1] ?? 0) + 1}.0`;
}
