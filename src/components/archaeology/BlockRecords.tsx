import { Link } from "@tanstack/react-router";

/** Chain-record notes sourced from @mononautical posts. Tx counts are public block facts; context is attributed commentary. */
const RECORDS = [
  { height: 367853, stat: "12,239 TX", title: "ALL-TIME TX RECORD", note: "Packed with tiny non-standard transactions cleaning up the UTXO set after the 2015 dust spam attack. The densest BITMAP ever: 12,239 parcels." },
  { height: 972161, stat: "7,929 TX", title: "2026 MEGA-DISTRICT", note: "Only 30 blocks in history ever held more transactions. Resolved live through LiveOCI." },
  { height: 963853, stat: "STALE RACE", title: "TWO BLOCKS, ONE HEIGHT", note: "Spiderpool mined two different blocks at this height. The stale one was built slightly later and held newer, higher-fee transactions." },
];

export function BlockRecords() {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs tracking-widest text-muted-foreground">BLOCK RECORDS · NOTES VIA <a className="underline" href="https://x.com/mononautical" target="_blank" rel="noreferrer">@MONONAUTICAL</a></h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {RECORDS.map((r) => (
          <Link key={r.height} to="/bitmap/$block" params={{ block: String(r.height) }} className="rounded border border-border bg-card/60 p-4 hover:border-primary">
            <div className="font-mono text-[10px] tracking-widest text-accent">{r.title}</div>
            <div className="mt-1 font-display text-xl text-primary">{r.height}.bitmap</div>
            <div className="font-mono text-sm">{r.stat}</div>
            <p className="mt-2 text-sm text-muted-foreground">{r.note}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
