import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoopNavigator } from "@/components/LoopNavigator";
import { StampCard } from "@/components/StampCard";
import { StreamEventRow } from "@/components/StreamEventRow";
import { UnlockPath } from "@/components/UnlockPath";
import { useAuthSession } from "@/lib/auth";
import { getMyPassportFn } from "@/lib/passport.functions";
import { shortenAddress } from "@/lib/registry";
import { ParcelClubBadges } from "@/components/ParcelClubBadges";

export const Route = createFileRoute("/passport")({
  head: () => ({ meta: [
    { title: "Passport — Your Verified History in BitmapWin" },
    { name: "description", content: "Your evidence-backed BitmapWin participation, app-record stamps, build capability unlocks, and recent provenance." },
    { property: "og:title", content: "BitmapWin Passport — Portable World History" },
    { property: "og:description", content: "Verified visits, builds, participation, stamps, and capabilities earned across the Bitcoin land world." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PassportPage,
});
function PassportPage() {
  const { session, loading } = useAuthSession(); const getPassport = useServerFn(getMyPassportFn);
  const passport = useQuery({ queryKey: ["my-passport", session?.user.id ?? "signed-out"], queryFn: () => getPassport(), enabled: Boolean(session), staleTime: 15_000 });
  if (loading) return <main className="mx-auto max-w-[1200px] px-4 py-20 font-mono text-sm text-muted-foreground">&gt; OPENING PASSPORT…</main>;
  if (!session) return <main className="mx-auto max-w-[900px] px-4 py-20 md:px-8"><p className="label text-bitcoin">PORTABLE HISTORY</p><h1 className="display mt-3 text-4xl">YOUR PASSPORT</h1><p className="mt-4 max-w-xl text-muted-foreground">Sign in and verify a Bitcoin wallet to turn real visits, builds, deployments, and participation into a lasting record.</p><Link to="/auth" className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link></main>;
  const data = passport.data;
  return <main className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
    <p className="label text-bitcoin">IDENTITY · HISTORY · POSSIBILITY</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="display text-4xl md:text-6xl">PASSPORT</h1><p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{data?.wallet ? shortenAddress(data.wallet) : "NO VERIFIED WALLET"}</p></div><Link to="/stream" className="btn-term-ghost">[ WORLD STREAM ]</Link></div>
    <div className="mt-6"><LoopNavigator active={data?.unlocks.length ? "unlock" : data?.stamps.length ? "stamp" : "provenance"} /></div>
    {data?.wallet ? <section className="mt-8 border border-border p-5"><p className="label text-bitcoin">PARCEL CLUBS</p><h2 className="display mt-2 text-xl">CLUB MEMBERSHIPS</h2><p className="mt-2 text-sm text-muted-foreground">Holding a valid parcel of a club's BITMAP earns its badge, read live from chain.</p><ParcelClubBadges address={data.wallet} className="mt-4" /></section> : null}
    {!data?.wallet ? <section className="mt-8 border border-bitcoin p-5"><h2 className="display text-xl">VERIFY A WALLET</h2><p className="mt-2 text-sm text-muted-foreground">A verified wallet is the thread connecting your world actions to this Passport.</p><Link to="/wallet" className="btn-term mt-4 inline-flex">[ VERIFY WALLET ]</Link></section> : null}
    <section className="mt-10"><header className="flex items-end justify-between border-b border-border pb-3"><div><p className="label text-bitcoin">EVIDENCE-BACKED</p><h2 className="display mt-2 text-2xl">STAMPS</h2></div><span className="label">{data?.stamps.length ?? 0} EARNED</span></header><div className="mt-4 grid gap-3 md:grid-cols-2">{data?.stamps.length ? data.stamps.map((s) => <StampCard key={s.id} stamp={s}/>) : <p className="font-mono text-xs text-muted-foreground">&gt; ENTER THE OASIS TO CREATE YOUR FIRST RECORD_</p>}</div></section>
    <section className="mt-10 border border-border"><header className="border-b border-border px-4 py-3"><p className="label text-bitcoin">WHAT HISTORY MAKES POSSIBLE</p><h2 className="display mt-2 text-2xl">BUILD CAPABILITIES</h2></header><UnlockPath stamps={data?.stamps ?? []} unlocks={data?.unlocks ?? []}/></section>
    <section className="mt-10 border border-border"><header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="display text-xl">RECENT PROVENANCE</h2><span className="label">{data?.events.length ?? 0} RECORDS</span></header>{data?.events.length ? data.events.slice(0, 20).map((e) => <StreamEventRow key={e.id} event={e}/>) : <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NO VERIFIED HISTORY YET_</p>}</section>
  </main>;
}
