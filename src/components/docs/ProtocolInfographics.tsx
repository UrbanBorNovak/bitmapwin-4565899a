import { Link } from "@tanstack/react-router";
import { FORGE_STEPS, GUARDIAN_STEPS, type ProtocolStep } from "@/lib/protocol-sdk";

/** Small SVG pictogram per step — pure shapes, no assets. */
function Glyph({ id }: { id: string }) {
  const s = "stroke-bitcoin";
  const c = "stroke-signal";
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" strokeWidth={2} aria-hidden="true">
      {id === "summon" && (
        <>
          <rect x="8" y="40" width="48" height="16" className={c} />
          <path d="M32 8 L44 26 L32 36 L20 26 Z" className={`${s} infogfx-rise`} />
          <path d="M20 26 L10 18 M44 26 L54 18" className={s} />
        </>
      )}
      {id === "inscribe" && (
        <>
          <rect x="14" y="10" width="36" height="44" className={c} />
          <path d="M22 22 H42 M22 30 H42 M22 38 H34" className={s} />
          <circle cx="44" cy="46" r="6" className={s} />
        </>
      )}
      {id === "breed" && (
        <>
          <circle cx="20" cy="20" r="9" className={s} />
          <circle cx="44" cy="20" r="9" className={c} />
          <path d="M20 29 L32 44 L44 29" className="stroke-muted-foreground" />
          <circle cx="32" cy="50" r="6" className={`${s} infogfx-rise`} />
        </>
      )}
      {id === "verify" && (
        <>
          <path d="M32 8 L52 16 V32 C52 44 42 52 32 56 C22 52 12 44 12 32 V16 Z" className={c} />
          <path d="M22 32 L30 40 L44 24" className={s} />
        </>
      )}
      {id === "target" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={10 + (i % 2) * 22} y={10 + Math.floor(i / 2) * 22} width="20" height="20" className={i === 1 ? s : c} />
          ))}
        </>
      )}
      {id === "compose" && (
        <>
          <rect x="10" y="38" width="16" height="16" className={c} />
          <rect x="26" y="38" width="16" height="16" className={c} />
          <rect x="18" y="22" width="16" height="16" className={s} />
          <rect x="38" y="8" width="16" height="16" className={`${s} infogfx-rise`} strokeDasharray="3 3" />
        </>
      )}
      {id === "encode" && (
        <>
          <path d="M8 16 H28 M8 24 H28 M8 32 H28 M8 40 H28 M8 48 H28" className="stroke-muted-foreground" />
          <path d="M32 32 L40 32" className={s} />
          <rect x="42" y="20" width="14" height="24" className={s} />
        </>
      )}
      {id === "inscribe" ? null : null}
    </svg>
  );
}

function Flow({ title, caption, steps }: { title: string; caption: string; steps: ProtocolStep[] }) {
  return (
    <figure className="infogfx border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="label text-bitcoin">{title}</span>
        <span className="label text-muted-foreground">{caption}</span>
      </figcaption>
      <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((st, i) => (
          <li key={st.id + i} className="infogfx-rise flex flex-col gap-2 bg-background p-4" style={{ animationDelay: `${i * 0.12}s` }}>
            <div className="flex items-center justify-between">
              <span className="label text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
              <Glyph id={st.id} />
            </div>
            <div className="display text-sm">{st.title}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{st.detail}</p>
            <span className="label mt-auto text-signal">{st.cost}</span>
            {st.route !== "/pet/$id" ? (
              <Link to={st.route as "/mint"} className="btn-term-ghost self-start">[ OPEN ]</Link>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function GuardianLifecycleInfographic() {
  return <Flow title="GUARDIAN · SUMMON → INSCRIBE → BREED" caption="EVERY TRAIT FROM THE BLOCK" steps={GUARDIAN_STEPS} />;
}

export function ForgeBuildInfographic() {
  return <Flow title="LAND FORGE · COMPOSE → ENCODE → REINSCRIBE" caption="THE INSCRIBED BYTES ARE THE PROOF" steps={FORGE_STEPS} />;
}
