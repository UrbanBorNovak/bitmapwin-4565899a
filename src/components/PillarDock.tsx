import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Globe, Grid3x3, Puzzle, Fingerprint, Hammer, Search, Sparkles, Swords, Store, Compass } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

const PILLARS = [
  { to: "/oasis", label: "WORLD", icon: Globe },
  { to: "/map", label: "LAND", icon: Grid3x3 },
  { to: "/extenders", label: "EXPERIENCES", icon: Puzzle },
  { to: "/passport", label: "IDENTITY", icon: Fingerprint },
  { to: "/create", label: "CREATION", icon: Hammer },
] as const;

const JUMPS = [
  { to: "/forge", label: "Land Forge (voxel builder)", icon: Hammer },
  { to: "/mint", label: "Summon a Guardian", icon: Sparkles },
  { to: "/command", label: "Guardian Command", icon: Swords },
  { to: "/marketplace", label: "Marketplace", icon: Store },
  { to: "/collections", label: "Collections", icon: Compass },
  { to: "/ownership", label: "Sovereign Value Loop", icon: Compass },
] as const;

/** Floating five-pillar dock + ⌘K command bar. Hidden inside the immersive Oasis. */
export function PillarDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const immersive = path.startsWith("/oasis");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const block = useMemo(() => {
    const m = q.trim().replace(/\.bitmap$/i, "").match(/^\d{1,7}$/);
    return m ? Number(m[0]) : null;
  }, [q]);

  const go = (to: string) => { setOpen(false); setQ(""); navigate({ to }); };

  return (
    <>
      {!immersive && (
        <nav
          aria-label="Pillars"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border/60 bg-background/70 p-1 shadow-lg backdrop-blur-md"
        >
          {PILLARS.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[10px] tracking-widest transition-colors ${
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border/60" />
          <button
            onClick={() => setOpen(true)}
            title="Search (Ctrl/⌘ K)"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[10px] text-muted-foreground hover:text-accent"
          >
            <Search className="h-4 w-4" />
            <kbd className="hidden md:inline">⌘K</kbd>
          </button>
        </nav>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Block number, BITMAP or page…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>No match.</CommandEmpty>
          {block !== null && (
            <CommandGroup heading="BITMAP">
              <CommandItem value={`bitmap ${block}`} onSelect={() => go(`/bitmap/${block}`)}>
                <Grid3x3 className="mr-2 h-4 w-4" /> Open {block}.bitmap
              </CommandItem>
              <CommandItem value={`guardian ${block}`} onSelect={() => go(`/collections/guardians/${block}`)}>
                <Sparkles className="mr-2 h-4 w-4" /> Guardian of {block}.bitmap
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Pillars">
            {PILLARS.map(({ to, label, icon: Icon }) => (
              <CommandItem key={to} value={label} onSelect={() => go(to)}>
                <Icon className="mr-2 h-4 w-4" /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Jump to">
            {JUMPS.map(({ to, label, icon: Icon }) => (
              <CommandItem key={to} value={label} onSelect={() => go(to)}>
                <Icon className="mr-2 h-4 w-4" /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
