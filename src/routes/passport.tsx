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
import { PassportEstatePanels } from "@/components/PassportEstate";
import { getMyEstateFn } from "@/lib/passport.functions";
import { PassportArtifact } from "@/components/PassportArtifact";
import { Button } from "@/components/ui/button";
import { Activity, Award, Boxes, KeyRound, Landmark, Radio, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

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
  const getEstate = useServerFn(getMyEstateFn);
  const estate = useQuery({ queryKey: ["my-estate", session?.user.id ?? "signed-out"], queryFn: () => getEstate(), enabled: Boolean(session), staleTime: 15_000 });
  const passport = useQuery({ queryKey: ["my-passport", session?.user.id ?? "signed-out"], queryFn: () => getPassport(), enabled: Boolean(session), staleTime: 15_000 });
  if (loading) return <main className="passport-terminal mx-auto max-w-[1400px] px-4 py-20 font-mono text-sm">&gt; AUTHENTICATING PASSPORT EVIDENCE…</main>;
  if (!session) return <main className="passport-terminal passport-terminal--unlinked px-4 py-12 md:px-8 md:py-20"><div className="mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]"><div><p className="passport-kicker">IDENTITY PROTOCOL · UNLINKED</p><h1 className="mt-4 max-w-2xl font-mono text-4xl font-bold uppercase leading-none text-[var(--passport-paper)] md:text-6xl">YOUR HISTORY NEEDS A HOLDER.</h1><p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-[var(--passport-muted)]">Sign in and verify a Bitcoin wallet to turn real visits, builds, deployments, and participation into a lasting record.</p><div className="mt-8 grid max-w-xl grid-cols-3 border border-[var(--passport-line)]"><ProtocolStat icon={<Landmark />} value="LAND" label="OWNERSHIP"/><ProtocolStat icon={<Award />} value="STAMP" label="EVIDENCE"/><ProtocolStat icon={<KeyRound />} value="BUILD" label="ACCESS"/></div></div><PassportArtifact wallet={null}/></div></main>;
  const data = passport.data;
  const held = estate.data?.land.length ?? 0;
  const passportUnavailable = passport.isError;
  const estateUnavailable = estate.isError;
  const proofCounts = { CHAIN: 0, WORLD: 0, ACCOUNT: 0 };
  for (const event of data?.events ?? []) proofCounts[event.proofLevel] += 1;
  return <main className="passport-terminal mx-auto max-w-[1500px] px-4 py-8 md:px-8 md:py-12">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--passport-line)] pb-5"><div><p className="passport-kicker">IDENTITY · HISTORY · POSSIBILITY</p><h1 className="mt-3 font-mono text-4xl font-bold uppercase text-[var(--passport-paper)] md:text-6xl">SOVEREIGN PASSPORT</h1><p className="mt-3 font-sans text-sm text-[var(--passport-muted)]">A living record of the places you hold, the marks you leave, and the access your history unlocks.</p></div><Link to="/stream" className="passport-action">WORLD STREAM <Radio className="size-3.5" /></Link></header>
    <div className="mt-5"><LoopNavigator active={data?.unlocks.length ? "unlock" : data?.stamps.length ? "stamp" : "provenance"} /></div>
    <section className="passport-evidence-grid mt-6">
      <div className="passport-artifact-cell"><PassportArtifact wallet={data?.wallet ?? null} stamps={data?.stamps.length ?? 0} unlocks={data?.unlocks.length ?? 0} records={data?.events.length ?? 0} holdings={held} loading={passport.isPending} unavailable={passportUnavailable}/></div>
      <EvidencePanel index="01" title="IDENTITY STATUS" icon={<ShieldCheck />}><p className="passport-value">{passport.isPending ? "CHECKING" : passportUnavailable ? "UNAVAILABLE" : data?.wallet ? "WALLET VERIFIED" : "WALLET NOT VERIFIED"}</p><p className="passport-copy">Verification requires a completed signed wallet proof. A connected wallet alone is not enough.</p><p className="passport-code" data-no-translate>{passport.isPending ? "READING SIGNED PROOF…" : data?.wallet ? shortenAddress(data.wallet) : passportUnavailable ? "VERIFICATION CHECK FAILED" : "NO VERIFIED WALLET"}</p>{passportUnavailable ? <RetryButton onClick={() => void passport.refetch()} /> : !data?.wallet && !passport.isPending ? <Link to="/wallet" className="passport-action mt-4">VERIFY WALLET <KeyRound className="size-3.5"/></Link> : null}</EvidencePanel>
      <EvidencePanel index="02" title="EVIDENCE LEDGER" icon={<Activity />}><div className="grid grid-cols-3 gap-px bg-[var(--passport-line)]"><MiniMetric value={passport.isPending ? null : proofCounts.CHAIN} label="CHAIN"/><MiniMetric value={passport.isPending ? null : proofCounts.WORLD} label="WORLD"/><MiniMetric value={passport.isPending ? null : proofCounts.ACCOUNT} label="ACCOUNT"/></div><p className="passport-copy mt-4">Persisted BitmapWin activity and indexed Bitcoin records only. No invented or retroactive history.</p>{passportUnavailable ? <EvidenceWarning label="EVIDENCE LEDGER UNAVAILABLE" /> : null}</EvidencePanel>
      <EvidencePanel index="03" title="CLUB SEALS" icon={<Award />} className="lg:col-span-2"><p className="passport-copy">Live membership seals resolve from valid parcel ownership.</p>{data?.wallet ? <ParcelClubBadges address={data.wallet} className="mt-4" /> : <p className="passport-code mt-4">WALLET LINK REQUIRED</p>}</EvidencePanel>
      <EvidencePanel index="04" title="CREATION INDEX" icon={<Boxes />}><p className="passport-value">{estate.isPending ? "—" : estateUnavailable ? "!" : estate.data?.blueprints.length ?? 0}</p><p className="passport-copy">Published blueprints tied to this identity.</p>{estateUnavailable ? <RetryButton onClick={() => void estate.refetch()} /> : <Link to="/studio" className="passport-text-link">OPEN STUDIO →</Link>}</EvidencePanel>
    </section>
    {estate.data ? <PassportEstatePanels estate={estate.data} /> : estate.isPending ? <section className="passport-panel mt-8 p-6"><p className="passport-kicker">05 / READING INDEXED LAND AND HISTORY…</p></section> : <section className="passport-panel mt-8 p-6"><EvidenceWarning label="ESTATE RECORDS TEMPORARILY UNAVAILABLE" /><RetryButton onClick={() => void estate.refetch()} /></section>}
    <section className="mt-8"><PassportSectionHeader index="06" eyebrow="EVIDENCE-BACKED" title="PASSPORT STAMPS" count={`${data?.stamps.length ?? 0} EARNED`}/><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data?.stamps.length ? data.stamps.map((s) => <StampCard key={s.id} stamp={s}/>) : <p className="passport-empty">&gt; ENTER THE OASIS TO CREATE YOUR FIRST RECORD_</p>}</div></section>
    <section className="passport-panel mt-8"><PassportSectionHeader index="07" eyebrow="WHAT HISTORY MAKES POSSIBLE" title="BUILD CAPABILITIES"/><UnlockPath stamps={data?.stamps ?? []} unlocks={data?.unlocks ?? []}/></section>
    <section className="passport-panel mt-8"><PassportSectionHeader index="08" eyebrow="ORDERED EVIDENCE" title="RECENT PROVENANCE" count={`${data?.events.length ?? 0} RECORDS`}/>{data?.events.length ? data.events.slice(0, 20).map((e) => <StreamEventRow key={e.id} event={e}/>) : <p className="passport-empty">&gt; NO VERIFIED HISTORY YET_</p>}</section>
  </main>;
}

function ProtocolStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="p-4 text-[var(--passport-gold)] [&+&]:border-l [&+&]:border-[var(--passport-line)]">{icon}<strong className="mt-3 block font-mono text-xs text-[var(--passport-paper)]">{value}</strong><span className="passport-kicker text-[7px]">{label}</span></div>; }
function MiniMetric({ value, label }: { value: number | null; label: string }) { return <div className="bg-[var(--passport-panel)] p-3"><strong className="passport-value block">{value ?? "—"}</strong><span className="passport-kicker text-[7px]">{label}</span></div>; }
function EvidencePanel({ index, title, icon, className = "", children }: { index: string; title: string; icon: React.ReactNode; className?: string; children: React.ReactNode }) { return <article className={`passport-panel passport-reveal p-4 ${className}`}><header className="mb-5 flex items-center justify-between border-b border-[var(--passport-line)] pb-3"><span className="passport-kicker">{index} / {title}</span><span className="text-[var(--passport-gold)] [&>svg]:size-4">{icon}</span></header>{children}</article>; }
function PassportSectionHeader({ index, eyebrow, title, count }: { index: string; eyebrow: string; title: string; count?: string }) { return <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--passport-line)] p-4"><div><p className="passport-kicker">{index} / {eyebrow}</p><h2 className="mt-2 font-mono text-xl font-bold uppercase text-[var(--passport-paper)] md:text-2xl">{title}</h2></div>{count ? <span className="passport-code">{count}</span> : null}</header>; }
function EvidenceWarning({ label }: { label: string }) { return <p className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--passport-gold)]"><TriangleAlert className="size-3.5" />{label}</p>; }
function RetryButton({ onClick }: { onClick: () => void }) { return <Button type="button" variant="terminalGhost" size="sm" onClick={onClick} className="mt-4 border-[var(--passport-gold)] text-[var(--passport-gold)]"><RefreshCw className="size-3.5" /> RETRY</Button>; }
