import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { ExtenderPreview } from "@/components/extenders/ExtenderPreview";
import { useAuthSession } from "@/lib/auth";
import {
  EXTENDER_CATEGORIES,
  LAND_PERMISSIONS,
  SDK_VERSION,
  categoryLabel,
  extendersQuery,
  extenderVersionsQuery,
  myExtendersQuery,
  slugify,
  type Extender,
  type LandPermission,
} from "@/lib/extenders";
import { createExtenderFn, publishVersionFn, setExtenderStatusFn, updateExtenderMetadataFn } from "@/lib/extenders.functions";
import { generateExtenderCodeFn } from "@/lib/extender-ai.functions";
import { RUNTIME_LIMITS, STARTER_TEMPLATES, codeFromManifest } from "@/lib/extender-sdk";
import { BlueprintEditor } from "@/components/studio/BlueprintEditor";
import { PublishToAtlas } from "@/components/studio/PublishToAtlas";
import { ShadowGateIssuer } from "@/components/studio/ShadowGateIssuer";
import { EMPTY_BLUEPRINT, blueprintFromManifest, codeFromBlueprint, type Blueprint } from "@/lib/blueprint";
import { StudioHome } from "@/components/studio/StudioHome";

export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>): { selected?: string; tool?: "extenders" } => {
    const selected = search["selected"];
    const out: { selected?: string; tool?: "extenders" } = {};
    if (typeof selected === "string" && selected.length > 0) out.selected = selected;
    if (search["tool"] === "extenders") out.tool = "extenders";
    return out;
  },
  head: () => {
    const title = "BITMAPWIN Studio — Build, Script and Ship on Bitcoin Land";
    const description =
      "The creator home for Bitcoin-native worlds: Land Forge builds, Extender experiences, reusable BWVX pieces and collections, all proven on Bitcoin.";
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
  component: StudioRoute,
});

function StudioRoute() {
  const { selected, tool } = Route.useSearch();
  if (!selected && tool !== "extenders") return <StudioHome />;
  return <StudioPage />;
}

function StudioPage() {
  const { selected: searchSelected } = Route.useSearch();
  const { session, loading } = useAuthSession();
  const userId = session?.user?.id ?? null;
  const mine = useQuery(myExtendersQuery(userId));
  const [selected, setSelected] = useState<string | null>(searchSelected ?? null);


  if (loading) {
    return <p className="mx-auto max-w-[1300px] px-4 py-20 font-mono text-sm text-muted-foreground md:px-8">&gt; CHECKING SESSION…</p>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-20 md:px-8">
        <div className="label text-bitcoin">BEDROCK · STUDIO</div>
        <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDER STUDIO</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sign in to build extenders. Describing a place in plain words is enough to get working code — publishing
          writes to the public registry under your account, and deploying is checked against the BITMAPs you hold.
        </p>
        <Link to="/auth" className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link>
      </div>
    );
  }

  const extenders = mine.data ?? [];
  const active = extenders.find((e) => e.id === selected) ?? null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · STUDIO</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDER STUDIO</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Describe the place you want on your land. The studio writes the code, runs it on a test tile in front of you,
        and publishes it when it looks right. Everything here is real and public — there is no demo mode.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="AI CODE WRITER · LIVE SANDBOX · REGISTRY" />
      </div>

      <ol className="mt-6 flex flex-wrap gap-2 font-mono text-[10px]">
        {["1 · NAME IT", "2 · DESCRIBE IT", "3 · TEST IT", "4 · PUBLISH", "5 · DEPLOY ON YOUR LAND"].map((step) => (
          <li key={step} className="border border-border px-2 py-1.5 text-muted-foreground" data-no-translate>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <CreateExtenderForm onCreated={(id) => setSelected(id)} />
          <ShadowGateIssuer />
          <div className="border border-border bg-surface">
            <header className="border-b border-border px-4 py-3">
              <h2 className="label">YOUR EXTENDERS</h2>
            </header>
            <div className="p-2">
              {mine.isPending ? (
                <p className="p-2 font-mono text-xs text-muted-foreground">&gt; LOADING…</p>
              ) : extenders.length === 0 ? (
                <p className="p-2 font-mono text-xs text-muted-foreground">&gt; NOTHING CREATED YET</p>
              ) : (
                <ul className="space-y-1">
                  {extenders.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(e.id)}
                        className={`w-full border px-3 py-2 text-left font-mono text-xs transition-colors ${
                          selected === e.id ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {e.name}
                        <span className="ml-2 text-muted-foreground" data-no-translate>{e.status.toUpperCase()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Link to="/sdk" className="btn-term-ghost w-full justify-center">[ READ THE SDK ]</Link>
        </div>

        <div>
          {active ? (
            <ExtenderWorkbench extender={active} />
          ) : (
            <div className="border border-border bg-surface p-6">
              <div className="display text-xl">START WITH A NAME</div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Name your package on the left and it appears here as a draft. From there you describe what should stand
                on the tile in ordinary words, watch it run, and publish when you like it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateExtenderForm({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useServerFn(createExtenderFn);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<string>(EXTENDER_CATEGORIES[0].id);
  const [isAiBuilt, setIsAiBuilt] = useState(true);
  const [iconInscriptionId, setIconInscriptionId] = useState("");
  const [previewInscriptionId, setPreviewInscriptionId] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error("GIVE THE EXTENDER A NAME");
      return create({
        data: {
          slug: slugify(trimmed),
          name: trimmed,
          summary: summary.trim(),
          description: "",
          category,
          tags: [],
          isAiBuilt,
          license: "all-rights-reserved",
          monetization: "free",
          priceSats: 0,
          priceBit: 0,
          iconInscriptionId: iconInscriptionId.trim() || null,
          previewInscriptionId: previewInscriptionId.trim() || null,
        },
      });
    },
    onSuccess: (created) => {
      toast("DRAFT CREATED", { description: created.slug });
      queryClient.invalidateQueries({ queryKey: ["my-extenders"] });
      onCreated(created.id);
      setName("");
      setSummary("");
      setIconInscriptionId("");
      setPreviewInscriptionId("");
    },
    onError: (error) => toast("COULD NOT CREATE", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">1 · NEW EXTENDER</div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Pirate Harbor"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One line: what it does on a tile"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        >
          {EXTENDER_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          value={iconInscriptionId}
          onChange={(e) => setIconInscriptionId(e.target.value)}
          placeholder="Icon inscription id (optional)"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          data-no-translate
        />
        <input
          value={previewInscriptionId}
          onChange={(e) => setPreviewInscriptionId(e.target.value)}
          placeholder="Preview inscription id (optional)"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          data-no-translate
        />
        <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={isAiBuilt} onChange={(e) => setIsAiBuilt(e.target.checked)} />
          BUILT WITH AN AI AGENT
        </label>
        {name.trim() ? (
          <p className="font-mono text-[10px] text-muted-foreground" data-no-translate>SLUG: {slugify(name)}</p>
        ) : null}
        <button type="button" className="btn-term w-full" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "[ CREATING… ]" : "[ CREATE DRAFT ]"}
        </button>
      </div>
    </div>
  );
}

function MetadataEditor({ extender, onSave }: { extender: Extender; onSave: () => void }) {
  const update = useServerFn(updateExtenderMetadataFn);
  const [name, setName] = useState(extender.name);
  const [summary, setSummary] = useState(extender.summary ?? "");
  const [category, setCategory] = useState(extender.category);
  const [iconInscriptionId, setIconInscriptionId] = useState(extender.iconInscriptionId ?? "");
  const [previewInscriptionId, setPreviewInscriptionId] = useState(extender.previewInscriptionId ?? "");
  const [tags, setTags] = useState((extender.tags ?? []).join(", "));

  const run = useMutation({
    mutationFn: async () =>
      update({
        data: {
          extenderId: extender.id,
          name: name.trim() || extender.name,
          summary: summary.trim(),
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          iconInscriptionId: iconInscriptionId.trim() || null,
          previewInscriptionId: previewInscriptionId.trim() || null,
        },
      }),
    onSuccess: () => {
      toast("PACKAGE UPDATED");
      onSave();
    },
    onError: (error) => toast("COULD NOT UPDATE", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">EDIT PACKAGE</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Summary"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        >
          {EXTENDER_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags, comma separated"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          data-no-translate
        />
        <input
          value={iconInscriptionId}
          onChange={(e) => setIconInscriptionId(e.target.value)}
          placeholder="Icon inscription id"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          data-no-translate
        />
        <input
          value={previewInscriptionId}
          onChange={(e) => setPreviewInscriptionId(e.target.value)}
          placeholder="Preview inscription id"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
          data-no-translate
        />
      </div>
      <button type="button" className="btn-term mt-3" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "[ SAVING… ]" : "[ SAVE PACKAGE ]"}
      </button>
    </div>
  );
}

function ExtenderWorkbench({ extender }: { extender: Extender }) {
  const versions = useQuery(extenderVersionsQuery(extender.id));
  const setStatus = useServerFn(setExtenderStatusFn);
  const updateMetadata = useServerFn(updateExtenderMetadataFn);
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [testHeight, setTestHeight] = useState("36095");
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [mode, setMode] = useState<"blueprint" | "code">("blueprint");
  const [blueprint, setBlueprint] = useState<Blueprint>({ ...EMPTY_BLUEPRINT, name: extender.name });

  const latestWithCode = (versions.data ?? []).find((v) => codeFromManifest(v.manifest));
  const latestPublished = (versions.data ?? []).find((v) => v.status === "published") ?? null;
  const height = Number.isFinite(Number(testHeight)) ? Number(testHeight) : 0;

  function applyBlueprint(next: Blueprint) {
    setBlueprint(next);
    setCode(codeFromBlueprint(next));
    setLoadedFrom("BLUEPRINT");
  }

  const status = useMutation({
    mutationFn: (next: "draft" | "published" | "archived") =>
      setStatus({ data: { extenderId: extender.id, status: next } }),
    onSuccess: () => {
      toast("STATUS UPDATED");
      queryClient.invalidateQueries({ queryKey: ["my-extenders"] });
      queryClient.invalidateQueries({ queryKey: ["extenders"] });
    },
    onError: (error) => toast("COULD NOT UPDATE", { description: (error as Error).message }),
  });

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label text-bitcoin">{categoryLabel(extender.category)}</div>
            <h2 className="display mt-2 text-2xl">{extender.name}</h2>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground" data-no-translate>
              /{extender.slug} · {extender.status.toUpperCase()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {extender.status === "published" ? (
              <>
                <Link to="/extenders/$slug" params={{ slug: extender.slug }} className="btn-term">[ DEPLOY ON YOUR LAND ]</Link>
                <button type="button" className="btn-term-ghost" onClick={() => status.mutate("draft")}>[ UNPUBLISH ]</button>
              </>
            ) : (
              <button type="button" className="btn-term" onClick={() => status.mutate("published")}>[ PUBLISH EXTENDER ]</button>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {extender.summary || "NO SUMMARY YET"}
        </p>
      </div>

      <MetadataEditor extender={extender} onSave={() => queryClient.invalidateQueries({ queryKey: ["my-extenders"] })} />

      <div className="flex flex-wrap items-center gap-2 border border-border bg-surface px-3 py-2">
        <span className="label text-muted-foreground">HOW YOU BUILD IT</span>
        {([
          ["blueprint", "BLUEPRINT EDITOR"],
          ["code", "PLAIN WORDS + CODE"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`border px-2 py-1.5 font-mono text-[10px] ${
              mode === id ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {latestWithCode && blueprintFromManifest(latestWithCode.manifest) ? (
          <button
            type="button"
            onClick={() => {
              const loaded = blueprintFromManifest(latestWithCode.manifest);
              if (loaded) {
                setMode("blueprint");
                applyBlueprint(loaded);
              }
            }}
            className="border border-signal px-2 py-1.5 font-mono text-[10px] text-signal"
            data-no-translate
          >
            LOAD BLUEPRINT v{latestWithCode.semver}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {mode === "blueprint" ? (
            <BlueprintEditor blueprint={blueprint} onChange={applyBlueprint} />
          ) : (
            <AiComposer
              code={code}
              onCode={setCode}
              category={extender.category}
              height={height}
              name={extender.name}
              summary={extender.summary}
            />
          )}

          <div className="border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="label text-bitcoin">THE CODE</div>
              <div className="flex flex-wrap items-center gap-1">
                {STARTER_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setCode(template.code);
                      setLoadedFrom(template.name);
                    }}
                    className="label border border-border px-2 py-1.5 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
                  >
                    {template.name}
                  </button>
                ))}
                {latestWithCode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCode(codeFromManifest(latestWithCode.manifest) ?? "");
                      setLoadedFrom(`v${latestWithCode.semver}`);
                    }}
                    className="label border border-bitcoin px-2 py-1.5 text-bitcoin"
                    data-no-translate
                  >
                    LOAD v{latestWithCode.semver}
                  </button>
                ) : null}
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setLoadedFrom(null);
              }}
              spellCheck={false}
              rows={18}
              data-no-translate
              placeholder={'world.prop({ shape: "box", w: 2, h: 3, color: "#f7931a", label: "TOWER" });'}
              className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground" data-no-translate>
              {new TextEncoder().encode(code).length} / {RUNTIME_LIMITS.maxCodeBytes} BYTES
              {loadedFrom ? ` · LOADED FROM ${loadedFrom.toUpperCase()}` : ""}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border border-border bg-surface px-3 py-2">
            <span className="label text-muted-foreground">TEST TILE</span>
            <input
              value={testHeight}
              onChange={(e) => setTestHeight(e.target.value)}
              className="w-28 border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-bitcoin"
              data-no-translate
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              THE SANDBOX HERE IS THE ONE THE WORLD RUNS
            </span>
          </div>
          <ExtenderPreview code={code} height={height} club={extender.name} canvasHeight={340} />
          <PublishVersionForm
            extenderId={extender.id}
            slug={extender.slug}
            code={code}
            blueprint={mode === "blueprint" && blueprint.pieces.length > 0 ? blueprint : null}
            suggestedSemver={nextSemver(latestWithCode?.semver ?? (versions.data ?? [])[0]?.semver ?? null)}
          />
          <PublishToAtlas
            extenderId={extender.id}
            extenderName={extender.name}
            versionId={latestPublished?.id ?? null}
            versionSemver={latestPublished?.semver ?? null}
          />
        </div>
      </div>

      <div className="border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h3 className="label">VERSION HISTORY</h3>
        </header>
        <div className="p-4">
          {versions.isPending ? (
            <p className="font-mono text-xs text-muted-foreground">&gt; LOADING…</p>
          ) : (versions.data ?? []).length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">&gt; NO VERSIONS YET — PUBLISH 1.0.0 TO MAKE IT DEPLOYABLE</p>
          ) : (
            <ol className="space-y-3">
              {(versions.data ?? []).map((v) => (
                <li key={v.id} className="border-l border-border pl-4">
                  <div className="font-mono text-xs" data-no-translate>
                    v{v.semver} · SDK {v.sdkVersion} · {v.status.toUpperCase()} ·{" "}
                    {codeFromManifest(v.manifest) ? "CODE" : "DESCRIPTION ONLY"}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{v.changelog || "NO CHANGELOG"}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const IDEAS = [
  "A pirate harbour with a pier, three sailing ships and a quest board",
  "A neon night market with stalls, lanterns and a trader to talk to",
  "A watchtower with a rotating beacon and a climb-to-the-top quest",
  "A small arena with a fighting ring, torches and seating",
  "A quiet garden with trees, a pond and stepping stones",
];

function AiComposer({
  code,
  onCode,
  category,
  height,
  name,
  summary,
}: {
  code: string;
  onCode: (code: string) => void;
  category: string;
  height: number;
  name: string;
  summary: string;
}) {
  const generate = useServerFn(generateExtenderCodeFn);
  const [prompt, setPrompt] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const brief = prompt.trim();
      if (brief.length < 4) throw new Error("DESCRIBE WHAT SHOULD STAND ON THE TILE");
      return generate({
        data: {
          prompt: [name ? `Extender name: ${name}.` : "", summary ? `Purpose: ${summary}.` : "", brief]
            .filter(Boolean)
            .join(" "),
          height,
          category,
          existingCode: code.trim(),
        },
      });
    },
    onSuccess: (result) => {
      onCode(result.code);
      toast(code.trim() ? "CODE REVISED" : "CODE WRITTEN", { description: "PRESS RUN TO SEE IT" });
    },
    onError: (error) => toast("COULD NOT WRITE THE CODE", { description: (error as Error).message }),
  });

  return (
    <div className="border border-bitcoin/50 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label text-bitcoin">2 · DESCRIBE IT IN PLAIN WORDS</div>
        <DataBadge kind="live" note="WRITES REAL SDK CODE" />
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={code.trim() ? "What should change? e.g. add two more ships and a lighthouse" : IDEAS[0]}
        className="mt-3 w-full border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-bitcoin"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setPrompt(idea)}
            className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
          >
            {idea}
          </button>
        ))}
      </div>
      <button type="button" className="btn-term mt-3 w-full" disabled>
        [ AI BUILDING IS OFF · WRITE OR USE A TEMPLATE ]
      </button>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        THE RESULT IS EDITABLE CODE — NOTHING IS HIDDEN, AND NOTHING PUBLISHES UNTIL YOU SAY SO
      </p>
    </div>
  );
}

function nextSemver(current: string | null): string {
  if (!current) return "1.0.0";
  const parts = current.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "1.0.0";
  return `${parts[0]}.${(parts[1] ?? 0) + 1}.0`;
}

function PublishVersionForm({
  extenderId,
  slug,
  code,
  blueprint,
  suggestedSemver,
}: {
  extenderId: string;
  slug: string;
  code: string;
  blueprint: Blueprint | null;
  suggestedSemver: string;
}) {
  const publish = useServerFn(publishVersionFn);
  const queryClient = useQueryClient();
  const catalogue = useQuery(extendersQuery({}));
  const [semver, setSemver] = useState(suggestedSemver);
  const [changelog, setChangelog] = useState("");
  const [permissions, setPermissions] = useState<LandPermission[]>(["view", "enter"]);
  const [published, setPublished] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [configText, setConfigText] = useState("{}");
  const [configInvalid, setConfigInvalid] = useState(false);
  const [dependencies, setDependencies] = useState<{ extenderId: string; versionRange: string }[]>([]);

  const bytes = new TextEncoder().encode(code).length;
  const tooLarge = bytes > RUNTIME_LIMITS.maxCodeBytes;

  const run = useMutation({
    mutationFn: () =>
      publish({
        data: {
          extenderId,
          semver: semver.trim(),
          sdkVersion: SDK_VERSION,
          changelog: changelog.trim(),
          manifest: {
            ...(code.trim() ? { code: code.trim() } : {}),
            ...(blueprint ? { blueprint } : {}),
            config,
          },
          publish: true,
          dependencies: dependencies.map((d) => ({ dependsOnExtenderId: d.extenderId, versionRange: d.versionRange })),
          permissions: permissions.map((permission) => ({ permission, reason: "" })),
        },
      }),
    onSuccess: () => {
      toast("VERSION PUBLISHED", { description: "NOW DEPLOY IT ON A BITMAP YOU HOLD" });
      setChangelog("");
      setPublished(true);
      queryClient.invalidateQueries({ queryKey: ["extender-versions"] });
      queryClient.invalidateQueries({ queryKey: ["extender-stats"] });
    },
    onError: (error) => toast("PUBLISH REFUSED", { description: (error as Error).message }),
  });

  const availableDeps = (catalogue.data ?? []).filter((e) => e.id !== extenderId && e.status === "published");

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">4 · PUBLISH THIS VERSION</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
        <input
          value={semver}
          onChange={(e) => setSemver(e.target.value)}
          placeholder="1.0.0"
          data-no-translate
          className="border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <input
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="What changed in this version"
          className="border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
      </div>

      <div className="mt-4">
        <div className="label">DEPENDENCIES</div>
        {catalogue.isPending ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">&gt; LOADING CATALOGUE…</p>
        ) : availableDeps.length === 0 ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">&gt; NO PUBLISHED EXTENDERS TO DEPEND ON YET</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {availableDeps.map((e) => {
              const selected = dependencies.find((d) => d.extenderId === e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    setDependencies((prev) => {
                      if (selected) return prev.filter((d) => d.extenderId !== e.id);
                      return [...prev, { extenderId: e.id, versionRange: "^1.0.0" }];
                    })
                  }
                  className={`flex items-center justify-between border px-2 py-1.5 text-left font-mono text-[11px] ${
                    selected ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span data-no-translate>{e.name}</span>
                  {selected ? (
                    <input
                      value={selected.versionRange}
                      onChange={(ev) =>
                        setDependencies((prev) =>
                          prev.map((d) => (d.extenderId === e.id ? { ...d, versionRange: ev.target.value } : d))
                        )
                      }
                      onClick={(ev) => ev.stopPropagation()}
                      className="w-24 border border-border bg-background px-1 py-0.5 font-mono text-[10px] outline-none focus:border-bitcoin"
                      data-no-translate
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="label">DEPLOY CONFIG (JSON)</div>
        <textarea
          value={configText}
          onChange={(e) => {
            setConfigText(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                setConfig(parsed as Record<string, unknown>);
                setConfigInvalid(false);
              } else {
                setConfigInvalid(true);
              }
            } catch {
              setConfigInvalid(true);
            }
          }}
          rows={4}
          placeholder='{"greeting":"Welcome traveller"}'
          className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
          data-no-translate
        />
        {configInvalid ? (
          <p className="mt-1 font-mono text-[10px] text-destructive">INVALID JSON — MUST BE AN OBJECT</p>
        ) : (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">PASSED TO land.config AT RUNTIME</p>
        )}
      </div>

      <div className="mt-4">
        <div className="label">LAND PERMISSIONS THIS VERSION REQUESTS</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {LAND_PERMISSIONS.map((perm) => {
            const on = permissions.includes(perm);
            return (
              <button
                key={perm}
                type="button"
                onClick={() =>
                  setPermissions((prev) => (on ? prev.filter((p) => p !== perm) : [...prev, perm]))
                }
                className={`label border px-2 py-1.5 ${on ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {perm.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground" data-no-translate>
        {bytes} / {RUNTIME_LIMITS.maxCodeBytes} BYTES ·{" "}
        {code.trim()
          ? tooLarge
            ? "TOO LARGE — TRIM THE CODE"
            : "LIVE CODE — RUNS SANDBOXED ON EVERY TILE THIS VERSION IS DEPLOYED TO"
          : "EMPTY — THIS VERSION WILL PUBLISH AS A DESCRIPTION ONLY"}
      </p>

      <button type="button" className="btn-term mt-3 w-full" disabled={run.isPending || tooLarge || configInvalid} onClick={() => run.mutate()}>
        {run.isPending ? "[ PUBLISHING… ]" : "[ PUBLISH VERSION ]"}
      </button>

      {published ? (
        <Link to="/extenders/$slug" params={{ slug }} className="btn-term-ghost mt-2 w-full justify-center">
          [ 5 · DEPLOY ON YOUR LAND ]
        </Link>
      ) : null}
    </div>
  );
}
