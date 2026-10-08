import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/mint-guardians.jpg";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";
import { MINT_COPY, MintLangToggle, useMintLang } from "@/lib/mint-lang";
import { RARITY_TONE } from "@/lib/bitmon";

/** One Guardian per Bitcoin block in the DMT range (blocks 0–839,999). */
const MAX_SUPPLY = 840_000;

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
        <div className="panel mt-3 max-w-2xl rounded-sm border border-border p-2 font-mono text-[11px]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div><p className="text-[9px] text-muted-foreground">MAX SUPPLY</p><p className="text-base">{MAX_SUPPLY.toLocaleString()}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{t.awakened}</p><p className="text-base text-bitcoin">{all.isLoading ? "…" : list.length.toLocaleString()}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{t.inscribedOnChain}</p><p className="text-base text-signal">{inscribed ?? "…"}</p></div>
            <div><p className="text-[9px] text-muted-foreground">AWAKENED %</p><p className="text-base">{((list.length / MAX_SUPPLY) * 100).toFixed(4)}%</p></div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-bitcoin" style={{ width: `${Math.max(0.5, (list.length / MAX_SUPPLY) * 100)}%` }} /></div>
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
