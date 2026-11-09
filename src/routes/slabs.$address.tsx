import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { slabAlbumFn } from "@/lib/slab-album.functions";
import { nostrNote } from "@/lib/slab-cert";

export const Route = createFileRoute("/slabs/$address")({
  component: AlbumPage,
  head: ({ params }) => ({
    meta: [
      { title: `Slab Album · ${params.address.slice(0, 10)}… | BitmapWIN` },
      { name: "description", content: "Graded BITMAP land slabs held by this address, read live from Bitcoin." },
      { property: "og:title", content: "BITMAP Slab Album" },
      { property: "og:description", content: "Graded BITMAP certificates held by this address, each an on-chain child of its BITMAP." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

type Nostr = { signEvent: (e: object) => Promise<object> };

async function publishNostr(content: string): Promise<number> {
  const n = (window as unknown as { nostr?: Nostr }).nostr;
  if (!n) throw new Error("NO NOSTR EXTENSION FOUND · NOTE COPIED INSTEAD");
  const ev = await n.signEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [["t", "bitmap"], ["t", "landslab"]], content });
  const sent = await Promise.all(
    RELAYS.map(
      (url) =>
        new Promise<boolean>((res) => {
          try {
            const ws = new WebSocket(url);
            const t = setTimeout(() => { ws.close(); res(false); }, 6000);
            ws.onopen = () => ws.send(JSON.stringify(["EVENT", ev]));
            ws.onmessage = (m) => { clearTimeout(t); ws.close(); res(String(m.data).includes('"OK"') && String(m.data).includes("true")); };
            ws.onerror = () => { clearTimeout(t); res(false); };
          } catch { res(false); }
        }),
    ),
  );
  return sent.filter(Boolean).length;
}

function AlbumPage() {
  const { address } = Route.useParams();
  const album = useServerFn(slabAlbumFn);
  const q = useQuery({ queryKey: ["slab-album", address], queryFn: () => album({ data: { address } }), staleTime: 60_000 });
  const [busy, setBusy] = useState(false);
  const slabs = q.data?.slabs ?? [];
  const proven = slabs.filter((s) => s.parentProven);

  const share = async () => {
    const text = nostrNote(proven, `https://bitmapwin.app/slabs/${address}`);
    await navigator.clipboard.writeText(text).catch(() => {});
    setBusy(true);
    try {
      const n = await publishNostr(text);
      toast.success(n ? `POSTED TO ${n} NOSTR RELAY${n > 1 ? "S" : ""}` : "RELAYS DID NOT CONFIRM · NOTE COPIED");
    } catch (e) {
      toast.message((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">BW-SLAB-1 · ALBUM</p>
      <h1 className="font-display text-3xl font-bold break-all">{address.slice(0, 12)}…{address.slice(-6)}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || proven.length === 0} onClick={share} className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground disabled:opacity-40">
          SHARE ON NOSTR
        </button>
        <Link to="/slab" className="rounded-md border border-border px-4 py-2 font-mono text-sm">GRADE MORE</Link>
      </div>
      {q.isPending ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">READING FROM CHAIN…</p>
      ) : !q.data?.ok ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">COULD NOT READ THIS ADDRESS RIGHT NOW</p>
      ) : slabs.length === 0 ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">NO GRADED SLABS HELD HERE YET</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {slabs.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-3">
              <Link to="/slab" search={{ b: s.h }} className="block">
                <div className="font-display text-lg font-bold">{s.h}.BITMAP</div>
                <div className="font-display text-2xl font-bold text-primary">{s.name} {s.grade}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{s.cert}</div>
              </Link>
              <div className={`mt-2 font-mono text-[11px] ${s.parentProven ? "text-accent" : "text-muted-foreground"}`}>
                {s.parentProven ? "CHILD OF THIS BITMAP · PROVEN" : "PARENT NOT PROVEN"}
              </div>
              <a href={`https://ordinals.com/inscription/${s.id}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] underline">ORDINALS.COM</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
