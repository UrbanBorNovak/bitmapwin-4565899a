/**
 * Terminal-style infographics for the docs page. Pure SVG/CSS, monochrome with
 * Bitcoin-orange accents, no external assets, no data — these explain concepts.
 */

function Frame({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="infogfx border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="label text-bitcoin">{title}</span>
        {caption ? <span className="label text-muted-foreground">{caption}</span> : null}
      </figcaption>
      <div className="p-4">{children}</div>
    </figure>
  );
}

/** OWN -> EXTEND -> DEPLOY -> EXPERIENCE -> PUBLISH as a pipeline with a running signal. */
export function LoopInfographic() {
  const steps = ["OWN", "EXTEND", "DEPLOY", "EXPERIENCE", "PUBLISH"];
  return (
    <Frame title="THE LOOP" caption="ONE CYCLE FROM LAND TO REGISTRY">
      <div className="grid gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <div key={s} className="relative border border-border bg-background p-3">
            <div className="label text-bitcoin">{String(i + 1).padStart(2, "0")}</div>
            <div className="display mt-1 text-sm">{s}</div>
            <div className="mt-3 h-1 overflow-hidden bg-secondary">
              <div className="infogfx-sweep h-full bg-bitcoin" style={{ animationDelay: `${i * 0.4}s` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative h-px flex-1 bg-border">
          <span className="infogfx-runner absolute -top-[3px] h-[7px] w-[7px] bg-bitcoin" />
        </div>
        <span className="label text-muted-foreground">LOOPS FOREVER</span>
      </div>
    </Frame>
  );
}

/** First-is-first: many inscriptions of one height, only the earliest is the deed. */
export function FirstIsFirstInfographic() {
  const rows = [
    { t: "T0", label: "FIRST INSCRIPTION", valid: true },
    { t: "T1", label: "COPY", valid: false },
    { t: "T2", label: "COPY", valid: false },
    { t: "T3", label: "COPY", valid: false },
  ];
  return (
    <Frame title="FIRST-IS-FIRST" caption="ONE HEIGHT · ONE DEED">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.t}
            className="infogfx-rise flex items-center gap-3 border border-border bg-background px-3 py-2"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <span className="label w-8 text-muted-foreground">{r.t}</span>
            <span className={`h-3 w-3 shrink-0 border ${r.valid ? "border-bitcoin bg-bitcoin" : "border-border-strong"}`} />
            <span className="font-mono text-xs">382441.BITMAP</span>
            <span className={`label ml-auto ${r.valid ? "text-bitcoin" : "text-muted-foreground line-through"}`}>
              {r.valid ? "DEED" : "IGNORED"}
            </span>
          </div>
        ))}
      </div>
      <p className="label mt-3 text-muted-foreground">REVEAL ORDER DECIDES. NO SERVER CAN OVERRULE IT.</p>
    </Frame>
  );
}

/** A bitmap subdividing into parcels, capped by block transaction count. */
export function ParcelsInfographic() {
  const cells = Array.from({ length: 64 }, (_, i) => i);
  return (
    <Frame title="PARCELS" caption="CHILD INSCRIPTIONS OF ONE BITMAP">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid w-full max-w-[220px] grid-cols-8 gap-px border border-border bg-border">
          {cells.map((c) => (
            <span
              key={c}
              className="infogfx-cell aspect-square bg-background"
              style={{ animationDelay: `${(c % 8) * 0.06 + Math.floor(c / 8) * 0.06}s` }}
            />
          ))}
        </div>
        <ul className="flex-1 space-y-2 font-mono text-xs text-muted-foreground">
          <li>
            <span className="text-bitcoin">›</span> PARENT: <span className="text-foreground">382441.BITMAP</span>
          </li>
          <li>
            <span className="text-bitcoin">›</span> PARCEL: <span className="text-foreground">&lt;index&gt;.382441.BITMAP</span>
          </li>
          <li>
            <span className="text-bitcoin">›</span> MAX PARCELS = BLOCK TRANSACTION COUNT
          </li>
          <li>
            <span className="text-bitcoin">›</span> PARCEL CONTROL FOLLOWS THE PARENT DEED
          </li>
        </ul>
      </div>
    </Frame>
  );
}

/** What the bedrock provides vs what builders bring. */
export function BedrockStackInfographic() {
  const layers = [
    { k: "EXPERIENCES", v: "BUILT BY HUMANS AND AI", ours: false },
    { k: "EXTENDERS", v: "VERSIONED, PERMISSIONED PACKAGES", ours: true },
    { k: "RUNTIME", v: "SANDBOXED WORKER + SDK", ours: true },
    { k: "PERSISTENCE", v: "PER DEPLOYMENT AND PER PLAYER STATE", ours: true },
    { k: "OWNERSHIP", v: "BITMAP INSCRIPTIONS ON BITCOIN", ours: true },
  ];
  return (
    <Frame title="THE BEDROCK" caption="WE PROVIDE THE LAYERS · YOU BRING THE WORLD">
      <div className="border border-border">
        {layers.map((l, i) => (
          <div
            key={l.k}
            className="infogfx-rise flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 last:border-b-0"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="label w-8 text-muted-foreground">{String(layers.length - i).padStart(2, "0")}</span>
            <span className={`display text-sm ${l.ours ? "" : "text-bitcoin"}`}>{l.k}</span>
            <span className="label ml-auto text-muted-foreground">{l.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="h-3 w-3 border border-bitcoin bg-bitcoin" />
        <span className="label text-muted-foreground">YOURS</span>
        <span className="ml-4 h-3 w-3 border border-border-strong" />
        <span className="label text-muted-foreground">BEDROCK</span>
      </div>
    </Frame>
  );
}

/** Deployment: rights rechecked against chain at deploy time. */
export function DeployFlowInfographic() {
  const nodes = ["PUBLISH VERSION", "CHECK RIGHTS ON CHAIN", "DEPLOY TO HEIGHT", "PLAYERS ENTER"];
  return (
    <Frame title="DEPLOY PATH" caption="NO FAKED SUCCESS">
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {nodes.map((n, i) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className="infogfx-rise flex-1 border border-border bg-background p-3"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="label text-bitcoin">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 font-mono text-xs leading-snug">{n}</div>
            </div>
            {i < nodes.length - 1 ? (
              <span className="label shrink-0 text-bitcoin" aria-hidden="true">
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="label mt-3 text-muted-foreground">
        IF THE CHAIN DOES NOT CONFIRM THE RIGHT, THE DEPLOY FAILS LOUDLY.
      </p>
    </Frame>
  );
}

/** Ownership vs permission: deed stays, rights move. */
export function RightsInfographic() {
  return (
    <Frame title="RIGHTS, NOT CUSTODY" caption="GRANTS AND LEASES">
      <div className="grid gap-2 md:grid-cols-3">
        <div className="border border-bitcoin bg-background p-4">
          <div className="label text-bitcoin">HOLDER</div>
          <div className="display mt-1 text-sm">KEEPS THE DEED</div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            THE INSCRIPTION NEVER MOVES FOR A GRANT OR LEASE.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 border border-border bg-background p-4">
          <span className="label text-muted-foreground">BUILD RIGHT</span>
          <div className="relative h-px w-full bg-border">
            <span className="infogfx-runner absolute -top-[3px] h-[7px] w-[7px] bg-bitcoin" />
          </div>
          <span className="label text-muted-foreground">REVOCABLE · ON RECORD</span>
        </div>
        <div className="border border-border bg-background p-4">
          <div className="label text-muted-foreground">BUILDER</div>
          <div className="display mt-1 text-sm">DEPLOYS AND EARNS</div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            PRICED PER DAY IN BIT FOR LEASES, FREE FOR GRANTS.
          </p>
        </div>
      </div>
    </Frame>
  );
}
