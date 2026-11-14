import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { resolveWallet } from "@/components/BuyButton";
import { useWalletSession } from "@/lib/wallet-session";
import { slabAlbumFn } from "@/lib/slab-album.functions";
import { driveContentsFn, type DriveFile } from "@/lib/block-drive.functions";
import { checkDriveFile, driveContentType, driveKind, DRIVE_MAX_BYTES } from "@/lib/block-drive";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

export const Route = createFileRoute("/drive")({
  validateSearch: z.object({ b: z.number().int().min(0).optional() }),
  component: DrivePage,
  head: () => ({
    meta: [
      { title: "Block Drive · Keep files on your BITMAP's own sat · BitmapWIN" },
      { name: "description", content: "Drop a journal, photo, avatar or 3D model and reinscribe it onto your BITMAP's own sat on Bitcoin. See every file already stored there." },
      { property: "og:title", content: "Block Drive: files that live on your BITMAP" },
      { property: "og:description", content: "Reinscribe journals, photos, VRM avatars and 3D models onto your BITMAP's sat. Public, permanent, read straight from Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Staged = { name: string; type: string; bytes: Uint8Array; digest: string };

async function digestOf(bytes: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(h.slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
}

const KIND_LABEL = { journal: "JOURNAL", image: "PHOTO", model: "3D MODEL", avatar: "AVATAR", page: "PAGE", text: "TEXT", other: "FILE" } as const;

function DrivePage() {
  const { b } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [lookup, setLookup] = useState(b != null ? String(b) : "");
  const height = b ?? null;

  const session = useWalletSession();
  const address = session?.ordinalsAddress ?? null;
  const album = useServerFn(slabAlbumFn);
  const held = useQuery({ queryKey: ["slab-album", address], queryFn: () => album({ data: { address: address! } }), enabled: !!address, staleTime: 60_000 });
  const mine = held.data?.bitmaps ?? [];
  const [filter, setFilter] = useState("");
  const shown = (filter ? mine.filter((x) => String(x.h).includes(filter)) : mine).slice(0, 60);
  const ownsIt = height != null && mine.some((x) => x.h === height);

  const contents = useServerFn(driveContentsFn);
  const listing = useQuery({ queryKey: ["drive", height], queryFn: () => contents({ data: { height: height! } }), enabled: height != null, staleTime: 60_000 });

  const open = (h: number) => navigate({ search: { b: h } });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">BLOCK DRIVE · BITFS</p>
        <h1 className="font-display text-3xl">Files that live on your BITMAP</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every BITMAP sits on one satoshi. Drop in a journal, a photo, an avatar or a 3D model and it is reinscribed onto that same sat. It stays on Bitcoin with no server to switch off. Anyone can read it, so don't store anything private.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-3">
        <input value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, ""))} placeholder="Any block, e.g. 840000" inputMode="numeric"
          className="w-48 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" aria-label="Block number" />
        <button onClick={() => lookup && open(Number(lookup))} className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:border-primary">OPEN DRIVE</button>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {address ? `${mine.length.toLocaleString("en-US")} BITMAPS IN YOUR WALLET` : ""}
        </span>
        {!address && (
          <button onClick={() => resolveWallet().catch((e) => toast.error((e as Error).message))} className="ml-auto rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground">CONNECT WALLET</button>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">MY BITMAPS</p>
          {!address ? <p className="text-sm text-muted-foreground">Connect to add files to your own BITMAPs. Anyone's drive can be read without a wallet.</p>
            : held.isPending ? <p className="font-mono text-xs text-muted-foreground">READING YOUR WALLET…</p>
            : mine.length === 0 ? <p className="font-mono text-xs text-muted-foreground">NO BITMAPS FOUND IN THIS WALLET</p>
            : (<>
              <input value={filter} onChange={(e) => setFilter(e.target.value.replace(/\D/g, ""))} placeholder="Search" className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs" />
              <ul className="max-h-[420px] space-y-1 overflow-auto">
                {shown.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => open(x.h)} className={`w-full rounded border px-2 py-1 text-left font-mono text-sm ${x.h === height ? "border-primary text-primary" : "border-border hover:border-primary"}`}>
                      {x.h.toLocaleString("en-US")}.bitmap
                    </button>
                  </li>
                ))}
                {shown.length === 0 && <li className="font-mono text-xs text-muted-foreground">NO MATCH</li>}
              </ul>
            </>)}
        </aside>

        <section className="space-y-4">
          {height == null ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">Pick one of your BITMAPs, or open any block to see what's stored on it.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl text-primary">{height.toLocaleString("en-US")}.bitmap</h2>
                <Link to="/bitmap/$block" params={{ block: String(height) }} className="font-mono text-xs text-accent underline">BITMAP PAGE</Link>
              </div>
              {ownsIt ? <Uploader key={height} height={height} onDone={() => void listing.refetch()} />
                : address && !held.isPending ? <p className="text-sm text-muted-foreground">This BITMAP isn't in your connected wallet, so you can read its drive but not add to it.</p> : null}
              <Listing state={listing.data} pending={listing.isPending} onRetry={() => void listing.refetch()} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Listing({ state, pending, onRetry }: { state: Awaited<ReturnType<typeof driveContentsFn>> | undefined; pending: boolean; onRetry: () => void }) {
  if (pending) return <p className="font-mono text-xs text-muted-foreground">READING THE SAT FROM BITCOIN…</p>;
  if (!state) return null;
  if (!state.ok) return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
      <span className="text-muted-foreground">{state.error}</span>
      <button onClick={onRetry} className="rounded border border-border px-2 py-1 font-mono text-xs hover:border-primary">TRY AGAIN</button>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-muted-foreground">
        ON THIS SAT · {state.files.length} FILE{state.files.length === 1 ? "" : "S"} BESIDE THE BITMAP ITSELF{state.more ? " · SHOWING NEWEST 40" : ""}
      </p>
      {state.files.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing has been reinscribed on this BITMAP yet.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.files.map((f) => <FileCard key={f.id} f={f} />)}
        </ul>
      )}
    </div>
  );
}

function FileCard({ f }: { f: DriveFile }) {
  const kind = driveKind(f.contentType ?? "");
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex aspect-square items-center justify-center bg-background">
        {kind === "image" ? <img src={`https://ordinals.com/content/${f.id}`} alt="Inscribed file" loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated]" />
          : <span className="font-mono text-sm text-muted-foreground">{KIND_LABEL[kind]}</span>}
      </div>
      <div className="space-y-1 p-2 font-mono text-[11px]">
        <p className="truncate text-accent">{f.number != null ? `#${f.number.toLocaleString("en-US")}` : f.id.slice(0, 12)}</p>
        <p className="truncate text-muted-foreground">{f.contentType ?? "unknown"} · {f.length != null ? `${f.length.toLocaleString("en-US")} B` : "?"}</p>
        {f.timestamp && <p className="text-muted-foreground">{new Date(f.timestamp * 1000).toISOString().slice(0, 10)}</p>}
        <a href={`https://ordinals.com/inscription/${f.id}`} target="_blank" rel="noreferrer" className="underline">OPEN ↗</a>
      </div>
    </li>
  );
}

function Uploader({ height, onDone }: { height: number; onDone: () => void }) {
  const [staged, setStaged] = useState<Staged | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [over, setOver] = useState(false);
  const [journal, setJournal] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const initialFile = useMemo(() => (staged ? { type: staged.type, bytes: staged.bytes } : undefined), [staged]);

  const stage = async (name: string, type: string, bytes: Uint8Array) => {
    const c = checkDriveFile(bytes.length);
    if (!c.ok) { toast.error(c.reason); return; }
    setAgreed(false); setDone(null);
    setStaged({ name, type, bytes, digest: await digestOf(bytes) });
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    await stage(f.name, driveContentType(f.name, f.type), new Uint8Array(await f.arrayBuffer()));
  };
  const journalBytes = new TextEncoder().encode(journal).length;

  if (done) return (
    <div className="rounded-lg border border-primary/40 p-4 text-sm">
      <p>Sent to Bitcoin. It shows up here once it's mined. <a className="underline" href={`https://mempool.space/tx/${done}`} target="_blank" rel="noreferrer">Follow the transaction ↗</a></p>
      <button onClick={() => { setDone(null); setStaged(null); onDone(); }} className="mt-2 rounded border border-border px-2 py-1 font-mono text-xs">ADD ANOTHER</button>
    </div>
  );

  if (!staged) return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void onFile(e.dataTransfer.files[0]); }}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center ${over ? "border-primary" : "border-border"}`}
      >
        <span className="font-display text-lg">Drop a file here</span>
        <span className="text-xs text-muted-foreground">Photo, .md journal, .vrm avatar, .glb model, HTML page · up to {DRIVE_MAX_BYTES.toLocaleString("en-US")} bytes</span>
        <input type="file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <span className="font-mono text-xs text-muted-foreground">OR WRITE A JOURNAL ENTRY (MARKDOWN)</span>
        <textarea value={journal} onChange={(e) => setJournal(e.target.value)} rows={5} placeholder={"# Today\nWhat happened on this block…"} className="flex-1 rounded border border-border bg-background p-2 font-mono text-xs" />
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>{journalBytes.toLocaleString("en-US")} BYTES</span>
          <button disabled={!journal.trim()} onClick={() => void stage("journal.md", "text/markdown;charset=utf-8", new TextEncoder().encode(journal))} className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-40">USE THIS ENTRY</button>
        </div>
      </div>
    </div>
  );

  if (!agreed) return (
    <div className="space-y-2 rounded-lg border border-border p-4 font-mono text-xs">
      <p className="uppercase tracking-widest">Before your wallet opens</p>
      <ul className="space-y-1">
        <li className="flex justify-between gap-2"><span>FILE</span><span className="truncate">{staged.name} · {KIND_LABEL[driveKind(staged.type, staged.name)]}</span></li>
        <li className="flex justify-between"><span>TYPE</span><span>{staged.type}</span></li>
        <li className="flex justify-between"><span>SIZE ON CHAIN</span><span>{staged.bytes.length.toLocaleString("en-US")} bytes</span></li>
        <li className="flex justify-between"><span>SITE FEE</span><span>0 sats</span></li>
        <li className="flex justify-between"><span>POSTAGE</span><span>0 sats (stamped on your BITMAP's own sat)</span></li>
        <li className="flex justify-between"><span>MINER FEE</span><span>shown in the next step, set by your fee rate</span></li>
      </ul>
      <p className="text-muted-foreground">This is public and permanent: it can't be edited or deleted later. Your BITMAP returns to you in the same transaction. Some outside viewers show only the newest file on a sat.</p>
      <div className="flex gap-2">
        <button onClick={() => setAgreed(true)} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">I UNDERSTAND · CONTINUE</button>
        <button onClick={() => setStaged(null)} className="rounded-md border border-border px-4 py-2">CANCEL</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <ShadowInscriber
        key={staged.digest}
        slug="block-drive"
        height={height}
        index={0}
        digest={`bw-drive-${height}-${staged.digest}`}
        claimParentsForHeight={height}
        reinscribeOnBitmap
        allowUpload={false}
        initialFile={initialFile}
        artifactLabel={`${staged.name.toUpperCase()} → ${height}.BITMAP'S OWN SAT`}
        actionLabel="STORE ON MY BITMAP"
        artifactVariants={[{ key: "file", label: "FILE", contentType: staged.type, source: "", postage: 0 }]}
        onRevealed={(txid) => setDone(txid)}
      />
      <button onClick={() => setStaged(null)} className="font-mono text-xs text-muted-foreground underline">CHOOSE A DIFFERENT FILE</button>
    </div>
  );
}
