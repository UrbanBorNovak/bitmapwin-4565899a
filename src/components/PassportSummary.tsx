import { Link } from "@tanstack/react-router";
import { Award, History, Unlock } from "lucide-react";
import type { Passport } from "@/lib/passport";
export function PassportSummary({ passport, publicView = false }: { passport: Passport; publicView?: boolean }) {
  return <section className="border border-border bg-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><p className="label text-bitcoin">PORTABLE HISTORY</p><h2 className="display mt-1 text-lg">PASSPORT</h2></div><Link to={publicView ? "/stream" : "/passport"} className="label text-bitcoin hover:text-foreground">[ {publicView ? "WORLD STREAM" : "OPEN PASSPORT"} ]</Link></header>
    <div className="grid grid-cols-3 divide-x divide-border"><Stat icon={<Award />} label="STAMPS" value={passport.stamps.length}/><Stat icon={<Unlock />} label="UNLOCKS" value={passport.unlocks.length}/><Stat icon={<History />} label="RECORDS" value={passport.events.length}/></div>
  </section>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="min-w-0 p-3 text-center text-bitcoin [&_svg]:mx-auto [&_svg]:size-4"><span>{icon}</span><p className="label mt-2 text-[8px]">{label}</p><p className="display mt-1 text-xl text-foreground">{value}</p></div>; }
