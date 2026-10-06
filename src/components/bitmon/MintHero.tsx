import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/mint-guardians.jpg";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";
import { MINT_COPY, MintLangToggle, useMintLang } from "@/lib/mint-lang";

/** Mint page hero: art + live, real collection counts from the Guardian index. */
export function MintHero() {
  const all = useQuery(allGuardiansQuery());
  const children = useQuery({ queryKey: ["guardian-children-v6"], queryFn: () => getGuardianChildrenFn(), staleTime: 60_000, refetchInterval: 120_000 });
  const [lang, setLang] = useMintLang();
  const t = MINT_COPY[lang];
  const list = all.data ?? [];
  const inscribed = children.data && !children.data.unavailable ? children.data.ids.length : null;
  const onChain = new Set(children.data?.ids ?? []);
  const latest = list.slice(0, 6);

  return (
    <section className="relative mb-8 overflow-hidden rounded-md border border-border">
      <img src={hero} alt="Nine voxel Guardians standing on glowing BITMAP land" width={1920} height={832} className="h-[340px] w-full object-cover object-top md:h-[460px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute right-3 top-3"><MintLangToggle lang={lang} setLang={setLang} /></div>
      <div data-no-translate={lang === "zh" ? "" : undefined} className="absolute inset-x-0 bottom-0 p-4 md:p-6">
        <p className="label text-signal">{t.heroTag}</p>
        <p className="display mt-1 text-2xl md:text-4xl">{t.heroA} <span className="text-bitcoin">{t.heroB}</span></p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t.heroBody}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="panel rounded-sm border border-bitcoin/50 px-2 py-1 text-bitcoin">{all.isLoading ? "…" : list.length} AWAKENED</span>
          <span className="panel rounded-sm border border-signal/50 px-2 py-1 text-signal">{inscribed ?? "…"} {t.inscribedOnChain}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{t.formula}</span>
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
