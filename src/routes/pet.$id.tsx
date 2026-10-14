import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { allGuardiansQuery, guardianDnaQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { onchainGenome } from "@/lib/onchain-guardian";
import { breedPet, hueOf, type PetParent } from "@/lib/guardian-genetics";
import { readCbor } from "@/lib/forge-delegate";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { PetPortrait } from "@/components/bitmon/PetPortrait";

type PetMeta = { p: string; v?: number; g?: number; sire: string; dam: string; sh?: string; ra?: string };
const ID_RE = /^[0-9a-f]{64}i\d+$/i;

const petMetaQuery = (id: string) =>
  queryOptions({
    queryKey: ["pet-meta", id],
    queryFn: async (): Promise<PetMeta | null> => {
      const r = await fetch(`https://ordinals.com/r/metadata/${id}`);
      if (!r.ok) return null;
      const hex = String(await r.json()).replace(/[^0-9a-f]/gi, "");
      const b = new Uint8Array(hex.length / 2);
      for (let k = 0; k < b.length; k++) b[k] = parseInt(hex.substr(k * 2, 2), 16);
      const m = readCbor(b) as Partial<PetMeta> | null;
      if (!m || m.p !== "BITMAPWIN-PET" || typeof m.sire !== "string" || typeof m.dam !== "string") return null;
      return m as PetMeta;
    },
    staleTime: Infinity,
    retry: 1,
  });

export const Route = createFileRoute("/pet/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Guardian Pet ${params.id.slice(0, 8)}… — pedigree | bitmapwin` },
      { name: "description", content: "On-chain Guardian pet: verified parents, inherited traits and links back to both parent Guardians." },
      { property: "og:title", content: "Guardian Pet Pedigree — bitmapwin" },
      { property: "og:description", content: "A pet inscription whose parents and traits anyone can re-derive from Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PetPage,
});

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

function useParent(g: AwakeGuardian | undefined, id: string): PetParent | null {
  const q = useQuery({ ...guardianDnaQuery(g?.height ?? 0), enabled: !!g });
  return useMemo(() => (g && q.data ? { inscriptionId: id, height: g.height, genome: onchainGenome(q.data) } : null), [g, q.data, id]);
}

function ParentCard({ role, g, id, parent }: { role: string; g: AwakeGuardian | undefined; id: string; parent: PetParent | null }) {
  return (
    <section className="bg-card/60 backdrop-blur rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="label text-primary">{role}</h2>
        <span className={`label ${g ? "text-signal" : "text-destructive"}`}>{g ? "✓ INSCRIBED GUARDIAN" : "NOT A KNOWN GUARDIAN"}</span>
      </div>
      {g ? (
        <div className="flex items-center gap-3">
          <GuardianPortrait height={g.height} size={96} />
          <div className="space-y-1 text-xs">
            <p className="font-display text-lg">{g.height}.BITMAP</p>
            <p className="label">{g.rarity} · {g.species}</p>
            {parent && <p className="font-mono text-muted-foreground">{parent.genome.sh.toUpperCase()} · {parent.genome.wing ? "WINGS" : "NO WINGS"} · {parent.genome.spine ? "SPINES" : "NO SPINES"}</p>}
          </div>
        </div>
      ) : null}
      <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="block font-mono text-xs text-muted-foreground hover:text-signal">{short(id)} ↗</a>
      {g && (
        <div className="flex flex-wrap gap-2">
          <Link to="/collections/guardians/$height" params={{ height: String(g.height) }} className="rounded-md border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10">GUARDIAN PAGE →</Link>
          <Link to="/bitmap/$block" params={{ block: String(g.height) }} className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-primary">BITMAP →</Link>
        </div>
      )}
    </section>
  );
}

function PetPage() {
  const { id } = Route.useParams();
  const valid = ID_RE.test(id);
  const meta = useQuery({ ...petMetaQuery(id), enabled: valid });
  const all = useQuery(allGuardiansQuery());
  const m = meta.data;
  const sireG = (all.data ?? []).find((g) => g.inscriptionId === m?.sire);
  const damG = (all.data ?? []).find((g) => g.inscriptionId === m?.dam);
  const sire = useParent(sireG, m?.sire ?? "");
  const dam = useParent(damG, m?.dam ?? "");
  const pet = useMemo(() => (sire && dam ? breedPet(sire, dam) : null), [sire, dam]);
  const matches = !!pet && !!m && (m.g === undefined || m.g === pet.gen) && (!m.ra || m.ra === pet.ra) && (!m.sh || m.sh === pet.sh);

  const from = (pick: (p: PetParent) => unknown, val: unknown) =>
    !sire || !dam ? "—" : pick(sire) === val && pick(dam) === val ? "BOTH PARENTS" : pick(sire) === val ? "SIRE" : pick(dam) === val ? "DAM" : "MUTATION";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="label text-signal">GUARDIAN PET · ON-CHAIN PEDIGREE</p>
        <h1 className="font-display text-3xl">{pet ? `Gen ${pet.gen} ${pet.ra} Pet` : "Guardian Pet"}</h1>
        <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted-foreground hover:text-signal">{id} ↗</a>
      </header>

      {!valid && <p className="label text-destructive">THIS IS NOT A VALID INSCRIPTION ID</p>}
      {valid && meta.isLoading && <p className="label text-muted-foreground">READING THE PET'S METADATA FROM BITCOIN…</p>}
      {valid && !meta.isLoading && !m && <p className="label text-destructive">NO BITMAPWIN PET METADATA FOUND ON THIS INSCRIPTION</p>}

      {m && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
            <ParentCard role="SIRE" g={sireG} id={m.sire} parent={sire} />
            <section className="bg-card/60 backdrop-blur flex flex-col items-center rounded-lg border border-border p-4">
              <div className="flex w-full items-center justify-between">
                <h2 className="label text-primary">COMPANION</h2>
                {pet && <span className={`label ${matches ? "text-signal" : "text-destructive"}`}>{matches ? "✓ PEDIGREE VERIFIED" : "✗ TRAITS DON'T MATCH PARENTS"}</span>}
              </div>
              {pet ? <PetPortrait genome={pet} size={260} /> : <p className="label my-16 text-muted-foreground">RE-DERIVING FROM PARENTS…</p>}
              <iframe title="Inscribed pet" src={`https://ordinals.com/content/${id}`} sandbox="allow-scripts" className="mt-2 h-40 w-full rounded border border-border" />
              <p className="label mt-1 text-muted-foreground">ABOVE: RE-DERIVED · BELOW: THE INSCRIPTION ITSELF</p>
            </section>
            <ParentCard role="DAM" g={damG} id={m.dam} parent={dam} />
          </div>

          {pet && sire && dam && (
            <section className="bg-card/60 backdrop-blur rounded-lg border border-border p-4">
              <h2 className="label text-signal mb-3">INHERITED TRAITS</h2>
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-2 font-mono text-xs">
                <span className="text-muted-foreground">BODY PLAN</span><span>{pet.sh.toUpperCase()}</span><span className="text-signal">{pet.chimera ? "CHIMERA" : from((p) => p.genome.sh, pet.sh)}</span>
                <span className="text-muted-foreground">WINGS</span><span>{pet.wing ? "YES" : "NO"}</span><span className="text-signal">{from((p) => p.genome.wing, pet.wing)}</span>
                <span className="text-muted-foreground">SPINES</span><span>{pet.spine ? "YES" : "NO"}</span><span className="text-signal">{from((p) => p.genome.spine, pet.spine)}</span>
                <span className="text-muted-foreground">MARKINGS</span><span>{pet.pat ? "YES" : "NO"}</span><span className="text-signal">{from((p) => p.genome.pat, pet.pat)}</span>
                <span className="text-muted-foreground">HORNS</span><span>CLASS {pet.horn}</span><span className="text-signal">{from((p) => p.genome.horn, pet.horn)}</span>
                <span className="text-muted-foreground">RARITY</span><span>{pet.ra}</span><span className="text-signal">{from((p) => p.genome.ra, pet.ra)}</span>
                <span className="text-muted-foreground">BODY HUE</span><span>{pet.hue}°</span><span className="text-signal">BLEND {hueOf(sire.genome.body)}° × {hueOf(dam.genome.body)}°</span>
                <span className="text-muted-foreground">PURITY</span><span>{pet.purity}%</span><span />
              </div>
              {pet.mutations.length > 0 && <p className="label mt-3 text-primary">MUTATIONS · {pet.mutations.join(" · ")}</p>}
              <Link to="/breed" search={{ sire: sire.height, dam: dam.height }} className="mt-4 inline-block font-mono text-xs text-primary">OPEN THIS PAIR IN THE BREEDING LAB →</Link>
            </section>
          )}
        </>
      )}
    </main>
  );
}
