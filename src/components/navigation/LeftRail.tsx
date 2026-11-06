import { Link, useRouterState } from "@tanstack/react-router";
import { Globe, Map as MapIcon, Hammer, Shield, IdCard, MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Item = { to: string; label: string; icon: LucideIcon; match: string[] };

// The five core pillars: every other page lives in MORE.
const CORE: Item[] = [
  { to: "/oasis", label: "WORLD", icon: Globe, match: ["/oasis", "/cities", "/map"] },
  { to: "/marketplace", label: "LAND", icon: MapIcon, match: ["/marketplace", "/bitmap", "/traits", "/history", "/leases", "/ownership", "/barter"] },
  { to: "/forge", label: "FORGE", icon: Hammer, match: ["/forge", "/studio", "/build", "/builds"] },
  { to: "/guardians", label: "GUARDIANS", icon: Shield, match: ["/guardians", "/mint", "/breed", "/command", "/codex", "/collections/guardians"] },
  { to: "/passport", label: "PASSPORT", icon: IdCard, match: ["/passport", "/my-land", "/inventory", "/wallet"] },
];

const MORE: { title: string; items: { to: string; label: string }[] }[] = [
  { title: "LAND & MARKET", items: [
    { to: "/collections", label: "Land clubs" },
    { to: "/traits", label: "Traits" }, { to: "/history", label: "Sales history" }, { to: "/leases", label: "Leases" },
    { to: "/barter", label: "Barter" }, { to: "/ownership", label: "Verify ownership" }, { to: "/archaeology", label: "Archaeology" },
    { to: "/world-stats", label: "World stats" },
  ] },
  { title: "CREATE", items: [
    { to: "/studio", label: "Studio" }, { to: "/builds", label: "Community builds" }, { to: "/builders", label: "Builders" },
    { to: "/extenders", label: "Extenders" }, { to: "/registry", label: "3D model registry" }, { to: "/tools", label: "All tools" },
  ] },
  { title: "GUARDIANS", items: [
    { to: "/mint", label: "Mint Guardian" }, { to: "/breed", label: "Breeding lab" }, { to: "/command", label: "Command centre" },
    { to: "/codex", label: "Codex" },
  ] },
  { title: "EXPLORE", items: [
    { to: "/biternam", label: "Biternam quests" }, { to: "/play", label: "Living cards" }, { to: "/cities", label: "Cities" },
    { to: "/explore", label: "Trending" }, { to: "/stream", label: "World stream" }, { to: "/ranks", label: "Ranks" },
    { to: "/watch", label: "Toon cinema" }, { to: "/church", label: "Church of BITMAP" },
  ] },
  { title: "LEARN & BUILD", items: [
    { to: "/land-101", label: "Land 101" }, { to: "/guardians-guide", label: "Guardians guide" }, { to: "/play-guide", label: "Player guide" },
    { to: "/docs", label: "Docs & SDK" }, { to: "/dev-tools", label: "Developer tools" },
  ] },
];

const isOn = (path: string, m: string[]) => m.some((p) => path === p || path.startsWith(`${p}/`));

export function LeftRail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      <nav aria-label="Main navigation" className="fixed inset-y-0 left-0 z-[60] hidden w-20 flex-col border-r border-border bg-background lg:flex">
        <Link to="/" aria-label="Home" className="grid h-14 place-items-center border-b border-border font-display text-xs font-bold text-bitcoin">
          BW
        </Link>
        <ul className="flex flex-1 flex-col gap-1 p-2">
          {CORE.map(({ to, label, icon: I, match }) => {
            const on = isOn(path, match);
            return (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2.5 transition-colors ${on ? "border-bitcoin/50 bg-surface text-bitcoin" : "border-transparent text-muted-foreground hover:bg-surface hover:text-foreground"}`}
                >
                  <I className="size-5" strokeWidth={1.6} />
                  <span className="font-mono text-[0.55rem] tracking-wider">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`m-2 flex flex-col items-center gap-1 rounded-md border px-1 py-2.5 ${open ? "border-signal/50 text-signal" : "border-transparent text-muted-foreground hover:bg-surface hover:text-foreground"}`}
        >
          {open ? <X className="size-5" /> : <MoreHorizontal className="size-5" />}
          <span className="font-mono text-[0.55rem] tracking-wider">MORE</span>
        </button>
      </nav>

      {open && (
        <>
          <div className="fixed inset-0 z-[58] hidden bg-background/60 backdrop-blur-sm lg:block" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-20 z-[59] hidden w-80 overflow-y-auto border-r border-border bg-background p-5 lg:block">
            <div className="label text-bitcoin">MORE</div>
            <p className="mt-1 text-xs text-muted-foreground">Everything else on BitmapWin.</p>
            {MORE.map((g) => (
              <div key={g.title} className="mt-5">
                <div className="label text-[0.6rem] text-signal">{g.title}</div>
                <ul className="mt-2 grid gap-0.5">
                  {g.items.map((i) => (
                    <li key={i.to}>
                      <Link to={i.to} className={`block rounded px-2 py-1.5 text-sm ${isOn(path, [i.to]) ? "bg-surface text-bitcoin" : "text-foreground/80 hover:bg-surface hover:text-foreground"}`}>
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        </>
      )}
    </>
  );
}
