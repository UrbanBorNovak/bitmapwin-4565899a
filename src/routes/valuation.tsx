import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BitmapValuation } from "@/components/BitmapValuation";

export const Route = createFileRoute("/valuation")({
  head: () => ({
    meta: [
      { title: "Bitmap Valuation Index — Score Any Bitmap From Chain Data" },
      {
        name: "description",
        content:
          "Score any Bitmap district from Bitcoin itself: claim text, block hash cross-check, parcels, holders, sat geology and UTXOs — read live from ordinals recursive endpoints.",
      },
      { property: "og:title", content: "Bitmap Valuation Index — BVI-4" },
      {
        property: "og:description",
        content:
          "A recursive-only valuation of any Bitmap district: hard verification checks, weighted score, inventory and audit JSON.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ValuationPage,
});

function ValuationPage() {
  const [height, setHeight] = useState("715093");
  const [claim, setClaim] = useState("");
  const [target, setTarget] = useState<{ height: number; claim: string | null } | null>(null);

  const submit = () => {
    const h = Number(height);
    if (!Number.isFinite(h)) return;
    setTarget({ height: Math.floor(h), claim: claim.trim() || null });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display text-3xl md:text-5xl">BITMAP VALUATION INDEX</h1>
      <p className="label mt-3">BVI-4 · EVERY FIGURE READ FROM BITCOIN, NOTHING ESTIMATED</p>
      <p className="mt-4 max-w-3xl font-mono text-[12px] text-muted-foreground">
        &gt; ENTER A BLOCK HEIGHT AND, IF YOU HAVE IT, THE CLAIM INSCRIPTION ID. THE SCAN VERIFIES
        THE CLAIM TEXT, CROSS-CHECKS THE BLOCK HASH, WALKS THE CHILD TREE FOR PARCELS AND BUILDS,
        THEN SCORES HOLDERS, SAT GEOLOGY, UTXOS AND ACTIVITY.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="label">BLOCK HEIGHT</span>
          <input
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full border border-border bg-background px-3 py-3 font-mono text-sm"
          />
        </label>
        <label className="block">
          <span className="label">CLAIM INSCRIPTION ID (OPTIONAL)</span>
          <input
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="…i0"
            className="mt-1 w-full border border-border bg-background px-3 py-3 font-mono text-sm"
          />
        </label>
        <button type="button" onClick={submit} className="btn-term mt-6 !px-4 !py-3">
          [ LOAD ]
        </button>
      </div>

      {target ? (
        <>
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            &gt; TARGET BITMAP {target.height} ·{" "}
            <Link to="/bitmap/$block" params={{ block: String(target.height) }} className="hover:text-primary">
              OPEN ITS PAGE →
            </Link>
          </p>
          <BitmapValuation
            key={`${target.height}-${target.claim ?? ""}`}
            height={target.height}
            claimInscriptionId={target.claim}
          />
        </>
      ) : (
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          &gt; AWAITING TARGET.
        </p>
      )}
    </div>
  );
}
