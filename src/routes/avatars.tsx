import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PIXELS } from "@/lib/bitmap-pixels-catalog";
import { PixelFace } from "@/components/game/PixelFace";
import { setAvatarSkinInscription } from "@/lib/map-identity";
import { useWalletSession } from "@/lib/wallet-session";
import { useAuthSession } from "@/lib/auth";
import { myWalletLinksQuery, verifiedWalletAddress } from "@/lib/wallet-links";
import { profileQuery, saveProfile } from "@/lib/profiles";

/** Urban's on-chain BITMAP Pixels avatar showcase (2D faces + animated 3D rigs). */
const SHOWCASE = "9a6079abef889db19cc785980de5cc3376a3062487fb260d9c9ab85d96c62351i0";
const DEFAULT_ID = "b95af2eeed5175622f49c992305cc02b790c20d834a965b20a040f59a3bab227i0";
const ID = /^[0-9a-f]{64}i\d+$/;

export const Route = createFileRoute("/avatars")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s["id"] === "string" ? (s["id"] as string) : undefined }),
  head: () => {
    const title = "Avatar Studio — On-Chain BITMAP Pixels Avatars";
    const description = "Preview BITMAP Pixels avatars as 2D faces and animated 3D rigs from an on-chain showcase, then wear one in the Oasis or set it as your profile picture.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: AvatarsPage,
});

function AvatarsPage() {
  const search = Route.useSearch();
  const [id, setId] = useState(search.id && ID.test(search.id) ? search.id : DEFAULT_ID);
  const [q, setQ] = useState("");
  const name = PIXELS.find((p) => p.id === id)?.name ?? "Custom inscription";
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? PIXELS.filter((p) => p.name.toLowerCase().includes(n) || p.id.includes(n) || p.artist.toLowerCase().includes(n)) : PIXELS).slice(0, 48);
  }, [q]);

  const wallet = useWalletSession();
  const { session } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = verifiedWalletAddress(links.data, wallet?.ordinalsAddress);
  const profile = useQuery(profileQuery(address));
  const qc = useQueryClient();
  const pfp = useMutation({
    mutationFn: () => saveProfile({
      address,
      displayName: profile.data?.editableDisplayName ?? null,
      bio: profile.data?.bio ?? null,
      avatarInscriptionId: id,
      xHandle: profile.data?.xHandle ?? null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet-profile", address] }); toast("PROFILE PICTURE SET", { description: name }); },
    onError: (e) => toast("COULD NOT SET PROFILE PICTURE", { description: (e as Error).message }),
  });

  const wear = () => { setAvatarSkinInscription(id); toast("NOW WEARING IN THE OASIS", { description: name }); };

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 md:px-8">
      <p className="label text-bitcoin">IDENTITY · AVATAR STUDIO</p>
      <h1 className="display mt-3 text-3xl md:text-5xl">PICK YOUR FACE</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        The viewer below is an inscription on Bitcoin by Urban: every BITMAP Pixels avatar as a 2D face and an animated 3D rig.
        Choose one, then wear it in the Oasis or make it your profile picture.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden border border-border bg-background/60">
          <ClientOnly fallback={<div className="h-[78vh] p-4 font-mono text-xs text-muted-foreground">&gt; LOADING ON-CHAIN SHOWCASE…</div>}>
            <iframe
              key={id}
              src={`https://ordinals.com/content/${SHOWCASE}#${id}`}
              title="BITMAP Pixels avatar showcase (on-chain)"
              sandbox="allow-scripts allow-downloads"
              className="h-[78vh] w-full border-0"
            />
          </ClientOnly>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border p-3 font-mono text-[10px] text-muted-foreground">
            <span>INSCRIPTION {SHOWCASE.slice(0, 10)}…i0 · BY URBAN</span>
            <a href={`https://ordinals.com/inscription/${SHOWCASE}`} target="_blank" rel="noreferrer" className="text-signal hover:underline">VIEW ON ORDINALS.COM</a>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <PixelFace inscriptionId={id} label={name} className="h-16 w-16" />
              <div className="min-w-0">
                <div className="display truncate text-lg">{name}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{id}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={wear} className="btn-term">[ WEAR IN THE OASIS ]</button>
              {address ? (
                <button type="button" disabled={pfp.isPending} onClick={() => pfp.mutate()} className="btn-term">
                  {pfp.isPending ? "SAVING…" : profile.data?.avatarInscriptionId === id ? "✓ YOUR PROFILE PICTURE" : "[ SET AS PROFILE PICTURE ]"}
                </button>
              ) : (
                <Link to="/auth" search={{ next: "/avatars" }} className="btn-term-ghost text-center">SIGN IN WITH YOUR WALLET TO SET A PROFILE PICTURE</Link>
              )}
              <Link to="/character" className="label mt-1 underline">OPEN CHARACTER SHEET →</Link>
            </div>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, series or id"
              className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin" />
            <div className="mt-3 grid max-h-[48vh] grid-cols-4 gap-2 overflow-y-auto">
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => setId(p.id)} title={p.name}
                  className={`border p-1 ${p.id === id ? "border-bitcoin" : "border-border hover:border-foreground"}`}>
                  <PixelFace inscriptionId={p.id} label={p.name} className="aspect-square w-full" />
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">SHOWING {list.length} OF {PIXELS.length.toLocaleString("en-US")}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
