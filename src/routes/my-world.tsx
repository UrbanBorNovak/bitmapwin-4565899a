import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useAuthSession } from "@/lib/auth";
import { useWalletSession } from "@/lib/wallet-session";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { heldHeightsQuery } from "@/lib/held-parcels";
import {
  LAND_PERMISSIONS,
  categoryGlyph,
  myDeploymentsQuery,
  myExtendersQuery,
  type LandPermission,
} from "@/lib/extenders";
import { grantLandFn, undeployExtenderFn } from "@/lib/extenders.functions";

export const Route = createFileRoute("/my-world")({
  head: () => {
    const title = "My World — Your Land, Software and Build Rights";
    const description =
      "One command view of the BITMAPs you hold, the extenders you run on them, the packages you build and the rights you grant to other builders.";
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
  component: MyWorldPage,
});

function MyWorldPage() {
  const wallet = useWalletSession();
  const { session, loading } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = wallet?.ordinalsAddress ?? links.data?.[0]?.address ?? "";
  const addresses = useMemo(() => (address ? [address] : []), [address]);

  const held = useQuery(heldHeightsQuery(addresses));
  const deployments = useQuery(myDeploymentsQuery(addresses));
  const mine = useQuery(myExtendersQuery(session?.user?.id ?? null));

  const heldHeights = held.data ?? [];
  const active = (deployments.data ?? []).filter((d) => d.status === "active");

  if (loading) {
    return <p className="mx-auto max-w-[1400px] px-4 py-20 font-mono text-sm text-muted-foreground md:px-8">&gt; CHECKING SESSION…</p>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-20 md:px-8">
        <div className="label text-bitcoin">BEDROCK · COMMAND</div>
        <h1 className="display mt-3 text-3xl md:text-5xl">MY WORLD</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sign in and connect your wallet to see the land you hold, what runs on it, and who you have let build there.
        </p>
        <Link to="/auth" className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · COMMAND</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">MY WORLD</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="ON-CHAIN HOLDINGS" />
        {address ? null : <DataBadge kind="soon" note="CONNECT A WALLET TO POPULATE" />}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="BITMAPS HELD" value={held.isPending ? "…" : heldHeights.length.toLocaleString("en-US")} />
        <Stat label="EXTENDERS RUNNING" value={deployments.isPending ? "…" : String(active.length)} />
        <Stat label="PACKAGES YOU BUILD" value={mine.isPending ? "…" : String((mine.data ?? []).length)} />
        <Stat label="TILES WITH SOFTWARE" value={String(new Set(active.map((d) => d.bitmapHeight)).size)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="SOFTWARE RUNNING ON YOUR LAND">
            {deployments.isPending ? (
              <p className="font-mono text-xs text-muted-foreground">&gt; LOADING DEPLOYMENTS…</p>
            ) : active.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                &gt; NOTHING DEPLOYED YET — PICK AN EXTENDER AND PUT IT ON A TILE
              </p>
            ) : (
              <ul className="space-y-2">
                {active.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-2">
                    <div className="min-w-0 font-mono text-xs">
                      <Link to="/extenders/$slug" params={{ slug: d.slug }} className="hover:text-bitcoin">
                        <span aria-hidden="true">{categoryGlyph(d.category)}</span> {d.name}
                      </Link>
                      <Link
                        to="/bitmap/$block"
                        params={{ block: String(d.bitmapHeight) }}
                        className="ml-2 text-muted-foreground hover:text-bitcoin"
                        data-no-translate
                      >
                        ON {d.bitmapHeight}.BITMAP
                      </Link>
                    </div>
                    <UndeployButton deploymentId={d.id} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="YOUR LAND">
            {held.isPending ? (
              <p className="font-mono text-xs text-muted-foreground">&gt; READING HOLDINGS…</p>
            ) : heldHeights.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">&gt; NO BITMAPS DETECTED ON THIS ADDRESS</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {heldHeights.slice(0, 240).map((h) => (
                  <Link
                    key={h}
                    to="/bitmap/$block"
                    params={{ block: String(h) }}
                    className="border border-border px-2 py-1 font-mono text-[10px] hover:border-bitcoin hover:text-bitcoin"
                    data-no-translate
                  >
                    {h}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="PACKAGES YOU BUILD">
            {(mine.data ?? []).length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                &gt; NONE YET — <Link to="/studio" className="text-bitcoin hover:text-foreground">OPEN THE STUDIO</Link>
              </p>
            ) : (
              <ul className="space-y-1 font-mono text-xs">
                {(mine.data ?? []).map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <Link to="/extenders/$slug" params={{ slug: e.slug }} className="hover:text-bitcoin">{e.name}</Link>
                    <span className="text-muted-foreground" data-no-translate>{e.status.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <GrantRightsForm />
          <Panel title="WHAT IS NEXT">
            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2"><DataBadge kind="soon" /> <span className="text-foreground font-medium">01 — WORLDS GO LIVE</span> Extenders execute as persistent experiences directly on player-owned Bitmap land.</li>
              <li className="flex gap-2"><DataBadge kind="soon" /> <span className="text-foreground font-medium">02 — AI STARTS BUILDING</span> AI agents create, test, compose, and deploy worlds from a simple idea.</li>
              <li className="flex gap-2"><DataBadge kind="soon" /> <span className="text-foreground font-medium">03 — THE WORLD BECOMES AN ECONOMY</span> Landowners, builders, Extenders, and players earn from the worlds they create.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function UndeployButton({ deploymentId }: { deploymentId: string }) {
  const undeploy = useServerFn(undeployExtenderFn);
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => undeploy({ data: { deploymentId } }),
    onSuccess: () => {
      toast("EXTENDER REMOVED FROM LAND");
      queryClient.invalidateQueries({ queryKey: ["my-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["tile-deployments"] });
      queryClient.invalidateQueries({ queryKey: ["world-deployments"] });
    },
    onError: (error) => toast("COULD NOT REMOVE", { description: (error as Error).message }),
  });
  return (
    <button type="button" className="btn-term-ghost shrink-0" disabled={run.isPending} onClick={() => run.mutate()}>
      {run.isPending ? "[ … ]" : "[ UNDEPLOY ]"}
    </button>
  );
}

function GrantRightsForm() {
  const grant = useServerFn(grantLandFn);
  const queryClient = useQueryClient();
  const [height, setHeight] = useState("");
  const [granteeAddress, setGrantee] = useState("");
  const [permissions, setPermissions] = useState<LandPermission[]>(["build"]);

  const run = useMutation({
    mutationFn: async () => {
      const block = Number(height);
      if (!Number.isInteger(block) || block < 0) throw new Error("ENTER ONE OF YOUR BITMAPS");
      if (granteeAddress.trim().length < 20) throw new Error("ENTER THE BUILDER'S ADDRESS");
      if (permissions.length === 0) throw new Error("PICK AT LEAST ONE RIGHT");
      return grant({
        data: { height: block, granteeAddress: granteeAddress.trim(), permissions, note: null, days: null },
      });
    },
    onSuccess: () => {
      toast("BUILD RIGHTS GRANTED");
      queryClient.invalidateQueries({ queryKey: ["land-grants"] });
      setGrantee("");
      setHeight("");
    },
    onError: (error) => toast("COULD NOT GRANT", { description: (error as Error).message }),
  });

  return (
    <Panel title="LET SOMEONE BUILD ON YOUR LAND">
      <div className="space-y-2">
        <input
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="Your BITMAP, e.g. 840000"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <input
          value={granteeAddress}
          onChange={(e) => setGrantee(e.target.value)}
          placeholder="Builder's Bitcoin address"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <div className="flex flex-wrap gap-1">
          {LAND_PERMISSIONS.map((perm) => {
            const on = permissions.includes(perm);
            return (
              <button
                key={perm}
                type="button"
                onClick={() => setPermissions((prev) => (on ? prev.filter((p) => p !== perm) : [...prev, perm]))}
                className={`label border px-2 py-1.5 ${on ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {perm.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn-term w-full" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "[ VERIFYING OWNERSHIP… ]" : "[ GRANT RIGHTS ]"}
        </button>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface p-4">
      <div className="label">{label}</div>
      <div className="display mt-2 text-2xl" data-no-translate>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 className="label">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
