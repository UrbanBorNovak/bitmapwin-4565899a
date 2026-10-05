import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getGenesisRanksFn } from "@/lib/genesis-ranks.functions";

export const Route = createFileRoute("/genesis-ranks")({
  head: () => ({
    meta: [
      { title: "Genesis Ranks — The 224 Vanguard Inscribers — BITMAPWIN" },
      { name: "description", content: "Every wallet that inscribed a BITMAP in the Vanguard era (before block 793,500), ranked by how many they minted and how many they still hold — read from Bitcoin's ledger." },
      { property: "og:title", content: "Genesis Ranks — The 224 Vanguard Inscribers — BITMAPWIN" },
      { property: "og:description", content: "The original BITMAP inscribers, ranked by minted and still-held count. Chain-verified from genesis mint transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GenesisRanksPage,
});

function short(addr: string) {
  return addr.length > 20 ? `${addr.slice(0, 12)}…${addr.slice(-6)}` : addr;
}

function GenesisRanksPage() {
  const q = useQuery({
    queryKey: ["genesis-ranks"],
    queryFn: () => getGenesisRanksFn(),
    staleTime: 10 * 60_000,
  });

  const ranks = q.data?.ranks ?? [];
  const totalMinted = ranks.reduce((s, r) => s + r.minted, 0);
  const totalHeld = ranks.reduce((s, r) => s + r.held, 0);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/archaeology" className="label hover:text-bitcoin">← ARCHAEOLOGY</Link>
      <header className="mt-6 border-l-2 border-bitcoin pl-5">
        <p className="label text-signal">BITMAP ARCHAEOLOGY · GENESIS LEDGER</p>
        <h1 className="display mt-2 text-3xl md:text-5xl">GENESIS RANKS</h1>
        <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
          The wallets that inscribed BITMAPs in the Vanguard era — before block 793,500, in the first days of the standard.
          Each minter is read from the genesis mint transaction on Bitcoin, never from a marketplace or a claim.
          "Still holds" means the inscription has never left the minting wallet.
        </p>
      </header>

      <section className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-5">
          <p className="label text-muted-foreground">VANGUARD BITMAPS</p>
          <p className="display mt-2 text-3xl text-bitcoin">{q.data ? q.data.total.toLocaleString("en-US") : "—"}</p>
        </div>
        <div className="bg-card p-5">
          <p className="label text-muted-foreground">MINTERS IDENTIFIED</p>
          <p className="display mt-2 text-3xl text-signal">{q.data ? ranks.length.toLocaleString("en-US") : "—"}</p>
          {q.data && q.data.resolved < q.data.total && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {q.data.resolved}/{q.data.total} RESOLVED — REFRESH TO CONTINUE THE DIG
            </p>
          )}
        </div>
        <div className="bg-card p-5">
          <p className="label text-muted-foreground">NEVER MOVED</p>
          <p className="display mt-2 text-3xl">{q.data ? `${totalHeld}/${totalMinted}` : "—"}</p>
        </div>
      </section>

      <section className="mt-12">
        <p className="label text-bitcoin">01 · THE INSCRIBERS</p>
        <h2 className="display mt-2 text-xl md:text-2xl">RANKED BY MINTED COUNT</h2>

        {q.isLoading && <p className="mt-6 font-mono text-xs text-muted-foreground">DIGGING THROUGH THE GENESIS TRANSACTIONS…</p>}
        {q.isError && <p className="mt-6 font-mono text-xs text-bitcoin">THE DIG FAILED — TRY REFRESHING.</p>}

        {ranks.length > 0 && (
          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[720px] border-collapse bg-card">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label p-3 text-muted-foreground">#</th>
                  <th className="label p-3 text-muted-foreground">MINTER</th>
                  <th className="label p-3 text-right text-muted-foreground">MINTED</th>
                  <th className="label p-3 text-right text-muted-foreground">STILL HOLDS</th>
                  <th className="label p-3 text-muted-foreground">BLOCKS</th>
                </tr>
              </thead>
              <tbody>
                {ranks.map((r, i) => (
                  <tr key={r.minter} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    <td className="p-3">
                      <Link to="/profile/$address" params={{ address: r.minter }} className="font-mono text-xs text-signal hover:text-bitcoin">
                        {short(r.minter)}
                      </Link>
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-bitcoin">{r.minted}</td>
                    <td className="p-3 text-right font-mono text-xs">
                      {r.held === r.minted ? <span className="text-signal">{r.held} · DIAMOND</span> : r.held}
                    </td>
                    <td className="p-3">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {r.blocks.slice(0, 8).map((b) => (
                          <Link key={b} to="/bitmap/$block" params={{ block: String(b) }} className="font-mono text-[10px] text-muted-foreground hover:text-bitcoin">
                            {b.toLocaleString("en-US")}
                          </Link>
                        ))}
                        {r.blocks.length > 8 && <span className="font-mono text-[10px] text-muted-foreground">+{r.blocks.length - 8}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 max-w-3xl font-mono text-[10px] leading-relaxed text-muted-foreground">
        METHOD: for each Vanguard BITMAP we read its genesis reveal transaction on Bitcoin and take the first output's
        address as the inscriber. Still-held compares that address to the inscription's current owner. A BITMAP that
        moved through any transfer, swap or sale — recorded or not — no longer counts as held by its minter.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/archaeology" className="btn-term-ghost">ARCHAEOLOGY →</Link>
        <Link to="/ranks" className="btn-term-ghost">PLAYER RANKS →</Link>
      </div>
    </main>
  );
}
