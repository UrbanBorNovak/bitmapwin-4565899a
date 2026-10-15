import { Suspense, lazy } from "react";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

const MintLineup3D = lazy(() => import("@/components/bitmon/MintLineup3D").then((m) => ({ default: m.MintLineup3D })));
import hero from "@/assets/mint-guardians.jpg";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";
import { MINT_COPY, MintLangToggle, useMintLang } from "@/lib/mint-lang";
import { RARITY_TONE } from "@/lib/bitmon";
import { CLUBS, inClub } from "@/lib/clubs";
import { useChainTip } from "@/lib/use-chain-tip";

/** Mint page hero: art + live, real collection counts grouped by Bitmap club. */
export function MintHero() {
  const all = useQuery(allGuardiansQuery());
  const children = useQuery({ queryKey: ["guardian-children-v6"], queryFn: () => getGuardianChildrenFn(), staleTime: 60_000, refetchInterval: 120_000 });
  const [lang, setLang] = useMintLang();
  const t = MINT_COPY[lang];
  const tip = useChainTip();
  const list = all.data ?? [];
  const inscribed = children.data && !children.data.unavailable ? children.data.ids.length : null;
  const onChain = new Set(children.data?.ids ?? []);
  const latest = list.slice(0, 6);
  // Club supply is real: one BITMAP per mined block in range, capped at the live tip.
  const clubs = CLUBS.filter((c) => !c.future && (!tip || c.min <= tip)).map((c) => ({
    ...c,
    supply: (tip ? Math.min(c.max, tip) : c.max) - c.min + 1,
    count: list.filter((g) => inClub(g.height, c)).length,
  }));

  return (
    <section className="relative mb-8 overflow-hidden rounded-md border border-border">
      <div className="relative h-[280px] w-full md:h-[380px]">
        <img src={hero} alt="" aria-hidden width={1920} height={832} className="absolute inset-0 size-full object-cover object-top opacity-30" />
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <div className="absolute inset-0"><MintLineup3D /></div>
          </Suspense>
        </ClientOnly>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="absolute right-3 top-3"><MintLangToggle lang={lang} setLang={setLang} /></div>
      <div data-no-translate={lang === "zh" ? "" : undefined} className="relative -mt-6 p-4 md:p-6">
        <div className="mb-2"><OtherthingsBadge child="Guardians" /></div>
        <p className="label text-signal">{t.heroTag}</p>
        <p className="display mt-1 text-2xl md:text-4xl">{t.heroA} <span className="text-bitcoin">{t.heroB}</span></p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t.heroBody}
        </p>
        <div className="panel mt-3 max-w-2xl rounded-sm border border-border p-2 font-mono text-[11px]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div><p className="text-[9px] text-muted-foreground">LIVE CHAIN TIP</p><p className="text-base text-signal">{tip ? `#${tip.toLocaleString()}` : "…"}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{t.awakened}</p><p className="text-base text-bitcoin">{all.isLoading ? "…" : list.length.toLocaleString()}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{t.inscribedOnChain}</p><p className="text-base text-signal">{inscribed ?? "…"}</p></div>
            <div><p className="text-[9px] text-muted-foreground">CLUBS ACTIVE</p><p className="text-base">{clubs.filter((c) => c.count > 0).length} / {clubs.length}</p></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {clubs.map((c) => (
              <div key={c.id} className="border border-border bg-background/60 px-1.5 py-1">
                <p className="text-[9px] text-muted-foreground">{c.short}</p>
                <p className="text-xs"><span className="text-bitcoin">{c.count.toLocaleString()}</span><span className="text-muted-foreground"> / {c.supply.toLocaleString()}</span></p>
                <div className="mt-1 h-0.5 overflow-hidden bg-muted"><div className="h-full bg-bitcoin" style={{ width: `${c.count ? Math.max(2, (c.count / c.supply) * 100) : 0}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
            {(["COMMON", "RARE", "EPIC", "MYTHIC"] as const).map((r) => (
              <span key={r} className={RARITY_TONE[r]}>{r} {list.filter((g) => g.rarity === r).length}</span>
            ))}
            <span className="text-muted-foreground">· {t.formula}</span>
          </div>
        </div>
        {latest.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
            <span className="text-muted-foreground">{t.latest}</span>
            {latest.map((g) => (
              <span key={g.height} className="border border-border bg-background/70 px-1.5 py-0.5">
                {g.height}.BITMAP · {g.rarity} · {g.inscriptionId && onChain.has(g.inscriptionId) ? t.inscribed : t.awake}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
