import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useAuthSession } from "@/lib/auth";
import {
  EXTENDER_CATEGORIES,
  LAND_PERMISSIONS,
  SDK_VERSION,
  categoryLabel,
  extenderVersionsQuery,
  myExtendersQuery,
  slugify,
  type Extender,
  type LandPermission,
} from "@/lib/extenders";
import { createExtenderFn, publishVersionFn, setExtenderStatusFn } from "@/lib/extenders.functions";
import { RUNTIME_LIMITS, STARTER_TEMPLATES } from "@/lib/extender-sdk";

export const Route = createFileRoute("/studio")({
  head: () => {
    const title = "Extender Studio — Ship Software to Bitcoin Land";
    const description =
      "Create, version and publish extenders for BitmapWin: declare dependencies, request land permissions and release to the marketplace.";
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
  component: StudioPage,
});

function StudioPage() {
  const { session, loading } = useAuthSession();
  const userId = session?.user?.id ?? null;
  const mine = useQuery(myExtendersQuery(userId));
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) {
    return <p className="mx-auto max-w-[1300px] px-4 py-20 font-mono text-sm text-muted-foreground md:px-8">&gt; CHECKING SESSION…</p>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-20 md:px-8">
        <div className="label text-bitcoin">BEDROCK · STUDIO</div>
        <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDER STUDIO</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sign in to create extenders. Publishing writes to the public registry under your account, and deploying is
          checked against the BITMAPs you actually hold.
        </p>
        <Link to="/auth" className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link>
      </div>
    );
  }

  const extenders = mine.data ?? [];
  const active = extenders.find((e) => e.id === selected) ?? null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · STUDIO</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">EXTENDER STUDIO</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Define a package, publish immutable versions, declare what it depends on and what rights it needs on land. Every
        release here is real and public — there is no demo mode.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="WRITES TO THE REGISTRY" />
        <DataBadge kind="soon" note="AI GENERATION · IMPORT · SANDBOX" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <CreateExtenderForm onCreated={(id) => setSelected(id)} />
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
        </div>

        <div>
          {active ? (
            <ExtenderWorkbench extender={active} />
          ) : (
            <div className="border border-border bg-surface p-6">
              <div className="display text-xl">SELECT OR CREATE AN EXTENDER</div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                A package starts as a draft. Publishing a version makes it installable on land; publishing the extender
                itself makes it visible in the marketplace.
              </p>
              <Link to="/sdk" className="btn-term-ghost mt-5 inline-flex">[ READ THE SDK FIRST ]</Link>
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
  const [isAiBuilt, setIsAiBuilt] = useState(false);

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
          iconInscriptionId: null,
          previewInscriptionId: null,
        },
      });
    },
    onSuccess: (created) => {
      toast("DRAFT CREATED", { description: created.slug });
      queryClient.invalidateQueries({ queryKey: ["my-extenders"] });
      onCreated(created.id);
      setName("");
      setSummary("");
    },
    onError: (error) => toast("COULD NOT CREATE", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">NEW EXTENDER</div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Voxel City Kit"
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

function ExtenderWorkbench({ extender }: { extender: Extender }) {
  const versions = useQuery(extenderVersionsQuery(extender.id));
  const setStatus = useServerFn(setExtenderStatusFn);
  const queryClient = useQueryClient();

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
                <Link to="/extenders/$slug" params={{ slug: extender.slug }} className="btn-term-ghost">[ VIEW PUBLIC PAGE ]</Link>
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

      <PublishVersionForm extenderId={extender.id} />

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
                    v{v.semver} · SDK {v.sdkVersion} · {v.status.toUpperCase()}
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

function PublishVersionForm({ extenderId }: { extenderId: string }) {
  const publish = useServerFn(publishVersionFn);
  const queryClient = useQueryClient();
  const [semver, setSemver] = useState("1.0.0");
  const [changelog, setChangelog] = useState("");
  const [permissions, setPermissions] = useState<LandPermission[]>(["view", "enter"]);
  const [code, setCode] = useState("");

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
          manifest: code.trim() ? { code: code.trim() } : {},
          publish: true,
          dependencies: [],
          permissions: permissions.map((permission) => ({ permission, reason: "" })),
        },
      }),
    onSuccess: () => {
      toast("VERSION PUBLISHED");
      setChangelog("");
      queryClient.invalidateQueries({ queryKey: ["extender-versions"] });
      queryClient.invalidateQueries({ queryKey: ["extender-stats"] });
    },
    onError: (error) => toast("PUBLISH REFUSED", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-5">
      <div className="label text-bitcoin">PUBLISH A VERSION</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
        <input
          value={semver}
          onChange={(e) => setSemver(e.target.value)}
          placeholder="1.0.0"
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="label text-bitcoin">EXTENDER CODE — RUNS IN THE WORLD</div>
          <Link to="/sdk-playground" className="label text-muted-foreground hover:text-bitcoin">
            OPEN PLAYGROUND →
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setCode(template.code)}
              className="label border border-border px-2 py-1.5 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
            >
              LOAD {template.name.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          rows={14}
          data-no-translate
          placeholder={'world.prop({ shape: "box", w: 2, h: 3, color: "#f7931a", label: "TOWER" });'}
          className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-bitcoin"
        />
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" data-no-translate>
          {bytes} / {RUNTIME_LIMITS.maxCodeBytes} BYTES ·{" "}
          {code.trim()
            ? tooLarge
              ? "TOO LARGE — TRIM THE CODE"
              : "LIVE CODE — RUNS SANDBOXED ON EVERY TILE THIS VERSION IS DEPLOYED TO"
            : "EMPTY — THIS VERSION WILL PUBLISH AS A DESCRIPTION ONLY"}
        </p>
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
      <button type="button" className="btn-term mt-4 w-full sm:w-auto" disabled={run.isPending || tooLarge} onClick={() => run.mutate()}>
        {run.isPending ? "[ PUBLISHING… ]" : "[ PUBLISH VERSION ]"}
      </button>
    </div>
  );
}
