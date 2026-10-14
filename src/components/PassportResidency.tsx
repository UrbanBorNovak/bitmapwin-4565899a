import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Home } from "lucide-react";
import { getMyResidencyFn, setMyResidencyFn, setEmporiumAvatarFn } from "@/lib/residency.functions";
import { verifyEmporiumResidentFn } from "@/lib/emporium.functions";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import type { EstateLand } from "@/lib/passport-estate";

/** Residency: pick one held BITMAP as home; its sat's newest image becomes the profile picture. */
export function PassportResidency({ userId, land }: { userId: string; land: EstateLand[] }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyResidencyFn);
  const setFn = useServerFn(setMyResidencyFn);
  const residency = useQuery({ queryKey: ["my-residency", userId], queryFn: () => getFn(), staleTime: 30_000 });
  const save = useMutation({
    mutationFn: (height: number | null) => setFn({ data: { height } }),
    onSuccess: (r) => {
      qc.setQueryData(["my-residency", userId], r);
      if (r.wallet) qc.invalidateQueries({ queryKey: ["wallet-profile", r.wallet] });
      toast(r.height === null ? "RESIDENCY CLEARED" : `RESIDENT OF ${r.height}.BITMAP`, {
        description: r.avatarInscriptionId ? "PROFILE PICTURE SET FROM THE LATEST IMAGE ON ITS SAT" : "NO IMAGE FOUND ON THIS SAT",
      });
    },
    onError: (e) => toast("RESIDENCY FAILED", { description: (e as Error).message }),
  });
  const r = residency.data;
  const verifyFn = useServerFn(verifyEmporiumResidentFn);
  const avatarFn = useServerFn(setEmporiumAvatarFn);
  const emporium = useQuery({ queryKey: ["emporium-resident", r?.wallet], queryFn: () => verifyFn({ data: { address: r!.wallet! } }), enabled: Boolean(r?.wallet), staleTime: 5 * 60_000 });
  const setAvatar = useMutation({
    mutationFn: (inscriptionId: string) => avatarFn({ data: { inscriptionId } }),
    onSuccess: (x) => {
      qc.setQueryData(["my-residency", userId], (old: typeof r) => (old ? { ...old, avatarInscriptionId: x.avatarInscriptionId } : old));
      if (r?.wallet) qc.invalidateQueries({ queryKey: ["wallet-profile", r.wallet] });
      toast("EMPORIUM PORTRAIT SET AS AVATAR");
    },
    onError: (e) => toast("AVATAR FAILED", { description: (e as Error).message }),
  });

  return (
    <section className="passport-panel mt-8 p-4">
      <header className="mb-5 flex items-center justify-between border-b border-[var(--passport-line)] pb-3">
        <span className="passport-kicker">RESIDENCY / MAIN BITMAP</span>
        <Home className="size-4 text-[var(--passport-gold)]" />
      </header>
      <div className="grid gap-6 md:grid-cols-[144px_minmax(0,1fr)]">
        <div className="mx-auto size-36 overflow-hidden rounded-full border border-[var(--passport-line)] p-1.5">
          <InscriptionAvatar inscriptionId={r?.avatarInscriptionId ?? null} label={r?.height ? String(r.height) : "?"} alt="Residency profile picture" className="size-full rounded-full object-cover [image-rendering:pixelated]" fallbackClassName="text-2xl text-[var(--passport-gold)]" />
        </div>
        <div>
          {residency.isPending ? <p className="passport-code">READING RESIDENCY…</p> : !r?.wallet ? (
            <p className="passport-copy">Verify a wallet to claim residency. <Link to="/wallet" className="passport-text-link">VERIFY →</Link></p>
          ) : (
            <>
              <p className="passport-value" data-no-translate>{r.height !== null ? `${r.height}.BITMAP` : "NO RESIDENCY"}</p>
              {r.residencyName && (
                <p className="mt-2 font-mono text-lg uppercase text-[var(--passport-gold)]" data-no-translate>
                  NAME // {r.residencyName}
                </p>
              )}
              <p className="passport-code mt-2" data-no-translate>
                {r.sat !== null ? `SAT ${r.sat.toLocaleString()}` : r.height !== null ? "SAT NOT INDEXED" : "CHOOSE A BITMAP YOU HOLD"}
                {r.latestInscriptionId ? ` · LATEST ${r.latestInscriptionId.slice(0, 8)}…${r.latestInscriptionId.slice(-4)}` : ""}
              </p>
              <p className="passport-copy mt-3">
                Your profile picture is the newest image on your residency's sat.
                {r.avatarInscriptionId && r.avatarInscriptionId !== r.latestInscriptionId ? " A newer non-image inscription remains recorded above." : ""}
              </p>
              {r.residencyNameInscriptionId && (
                <p className="passport-code mt-2" data-no-translate>
                  NAME PROOF {r.residencyNameInscriptionId.slice(0, 10)}…{r.residencyNameInscriptionId.slice(-4)} · FOLLOWS RESIDENCY
                </p>
              )}
              {land.length === 0 ? <p className="passport-code mt-4">NO HELD BITMAPS FOUND</p> : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {land.slice(0, 60).map((l) => (
                    <button key={l.height} type="button" disabled={save.isPending} onClick={() => save.mutate(l.height)} data-no-translate
                      className={`passport-action ${r.height === l.height ? "border-[var(--passport-gold)] text-[var(--passport-gold)]" : ""}`}>
                      {l.height}
                    </button>
                  ))}
                  {r.height !== null && <button type="button" className="passport-action" disabled={save.isPending} onClick={() => save.mutate(null)}>CLEAR</button>}
                </div>
              )}
              {emporium.data?.portraits.length ? (
                <div className="mt-5 border-t border-[var(--passport-line)] pt-4">
                  <p className="passport-kicker">EMPORIUM RESIDENT PORTRAITS · 717328.BITMAP</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {emporium.data.portraits.map((id) => (
                      <button key={id} type="button" disabled={setAvatar.isPending} onClick={() => setAvatar.mutate(id)} title={`Use ${id.slice(0, 8)}… as avatar`}
                        className={`size-14 overflow-hidden border p-0.5 ${r.avatarInscriptionId === id ? "border-[var(--passport-gold)]" : "border-[var(--passport-line)]"}`}>
                        <img src={`https://ordinals.com/content/${id}`} alt="Emporium Resident portrait" loading="lazy" className="size-full object-cover [image-rendering:pixelated]" />
                      </button>
                    ))}
                  </div>
                  <p className="passport-code mt-2">VERIFIED ON CHAIN · TAP TO USE AS AVATAR</p>
                </div>
              ) : emporium.isPending ? <p className="passport-code mt-4">CHECKING EMPORIUM RESIDENCY…</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
