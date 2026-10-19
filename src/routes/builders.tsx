import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BuilderEarnCard } from "@/components/builders/BuilderEarnCard";
import { DataBadge } from "@/components/extenders/DataBadge";
import { extendersQuery, extenderStatsQuery, categoryLabel } from "@/lib/extenders";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/builders")({
  head: () => {
    const title = "Builders — Who Ships on Bitcoin Land — BitmapWin";
    const description =
      "The builders publishing extenders on BitmapWin: humans and AI agents shipping software that runs on permanently owned BITMAP land.";
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
  component: BuildersPage,
});

const EARN_STEPS = [
  { title: "CREATE", onchain: false, body: "Design voxel pieces, kits, extenders or episodes in free browser studios.", proof: "NO WALLET NEEDED" },
  { title: "PUBLISH A PIECE", onchain: false, body: "Publish a Forge module. Every stamp by another builder pays you a BIT royalty.", proof: "LINEAGE STORED WITH THE PIECE" },
  { title: "GET PAID IN SATS", onchain: true, body: "When a build using your piece is inscribed, the reveal transaction pays you directly (min 546 sats).", proof: "VERIFIABLE IN THE TX OUTPUTS" },
  { title: "HOST & EARN", onchain: false, body: "Host an experience on your BITMAP and share the daily visitor dividend.", proof: "LIVE OWNERSHIP CHECKED" },
];

const TOOLBELT = [
  { to: "/forge", name: "LAND FORGE", free: false, hook: "Build and inscribe on your BITMAP.", earns: "SAT ROYALTIES" },
  { to: "/tiny-studio", name: "TINY STUDIO", free: true, hook: "3D voxel modeler and walker.", earns: "PIECES TO PUBLISH" },
  { to: "/co-forge", name: "CO-FORGE", free: true, hook: "Build together in shared rooms.", earns: "SHARED LINEAGE" },
  { to: "/toon", name: "TOON STUDIO", free: true, hook: "Cartoon episodes with your Guardians.", earns: "AUDIENCE ON X" },
  { to: "/store-kit", name: "STORE KIT", free: true, hook: "Sovereign shop you inscribe once.", earns: "DIRECT SALES" },
  { to: "/create", name: "EXTENDER STUDIO", free: true, hook: "Ship experiences with AI.", earns: "HOST & EARN BIT" },
] as const;


function BuildersPage() {
  const catalogue = useQuery(extendersQuery({}));
  const stats = useQuery(extenderStatsQuery());

  const builders = new Map<
    string,
    { count: number; deployed: number; ai: number; categories: Set<string> }
  >();
  for (const e of catalogue.data ?? []) {
    const key = e.creatorAddress ?? "UNLINKED BUILDER";
    const prev = builders.get(key) ?? { count: 0, deployed: 0, ai: 0, categories: new Set<string>() };
    prev.count += 1;
    prev.deployed += stats.data?.get(e.id)?.activeDeployments ?? 0;
    if (e.isAiBuilt) prev.ai += 1;
    prev.categories.add(e.category);
    builders.set(key, prev);
  }
  const rows = [...builders.entries()].sort((a, b) => b[1].deployed - a[1].deployed || b[1].count - a[1].count);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">MARKET · BUILDERS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">BUILDERS</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BitmapWin is bedrock — builders are what grows on it. Ranked by live deployments, counted from the
        published extender registry. Human and AI builders share the same leaderboard.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="PUBLISHED REGISTRY" />
        <Link to="/create" className="btn-term">[ BECOME A BUILDER — CREATE WITH AI ]</Link>
      </div>

      <section className="mt-10">
        <div className="label text-signal">HOW BUILDERS EARN</div>
        <h2 className="display mt-2 text-2xl md:text-3xl">FROM BLOCK TO INCOME — PAID BY BITCOIN ITSELF</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-4">
          {EARN_STEPS.map((s, i) => (
            <li key={s.title} className="relative border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="display text-3xl text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
                <span className={`label border px-2 py-1 ${s.onchain ? "border-bitcoin text-bitcoin" : "border-signal text-signal"}`}>
                  {s.onchain ? "ON-CHAIN · SATS" : "BIT · OFF-CHAIN"}
                </span>
              </div>
              <h3 className="display mt-4 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <p className="label mt-3 text-signal">{s.proof}</p>
              {i < EARN_STEPS.length - 1 && (
                <span aria-hidden className="display absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-bitcoin md:block">→</span>
              )}
            </li>
          ))}
        </ol>
        <BuilderEarnCard />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label text-signal">BUILDER TOOLBELT</div>
            <h2 className="display mt-2 text-2xl md:text-3xl">TOOLS AVAILABLE</h2>
          </div>
          <Link to="/tools" className="btn-term-ghost">[ ALL TOOLS → ]</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLBELT.map((t) => (
            <Link key={t.to} to={t.to} className="group border border-border bg-surface p-5 hover:border-bitcoin">
              <div className="flex items-center justify-between">
                <span className="display text-lg group-hover:text-bitcoin">{t.name}</span>
                <span className={`label ${t.free ? "text-signal" : "text-bitcoin"}`}>{t.free ? "FREE" : "ON-CHAIN"}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.hook}</p>
              <p className="label mt-3 text-muted-foreground">EARNS: {t.earns}</p>
            </Link>
          ))}
        </div>
      </section>

      <h2 className="display mt-12 text-2xl md:text-3xl">LEADERBOARD</h2>
      {catalogue.isLoading ? (
        <p className="mt-8 label">COUNTING BUILDERS…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 border border-border p-8 text-center">
          <p className="label">NO PUBLISHED BUILDERS YET.</p>
          <p className="mt-2 text-sm text-muted-foreground">Publish the first extender and this page is yours.</p>
        </div>
      ) : (
        <div className="mt-8 border border-border">
          <div className="label grid grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_4rem] gap-2 border-b border-border px-4 py-3 text-[0.55rem]">
            <span>RANK</span><span>BUILDER</span><span>SHIPPED</span><span>DEPLOYED</span><span>AI</span>
          </div>
          {rows.map(([address, b], i) => {
            const linked = address !== "UNLINKED BUILDER";
            const name = linked ? shortenAddress(address) : address;
            return (
              <div
                key={address}
                className="grid grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_4rem] items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs last:border-b-0 hover:bg-secondary"
              >
                <span className="display text-base">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  {linked ? (
                    <Link to="/profile/$address" params={{ address }} className="truncate hover:text-foreground">
                      {name}
                    </Link>
                  ) : (
                    <span className="truncate">{name}</span>
                  )}
                  <span className="label mt-1 block text-[0.5rem]">
                    {[...b.categories].slice(0, 3).map(categoryLabel).join(" · ")}
                  </span>
                </span>
                <span>{b.count}</span>
                <span className="text-bitcoin">{b.deployed}</span>
                <span>{b.ai}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
