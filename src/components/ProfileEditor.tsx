import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  inscriptionImageUrl,
  profileQuery,
  saveProfile,
} from "@/lib/profiles";

/**
 * Profile editor for the connected wallet: display name, bio and an avatar
 * picked from the inscriptions the address holds.
 */
export function ProfileEditor({
  address,
  canEdit,
  inscriptionIds,
}: {
  address: string;
  canEdit: boolean;
  inscriptionIds: string[];
}) {
  const profile = useQuery(profileQuery(address));
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setName(profile.data?.displayName ?? "");
    setBio(profile.data?.bio ?? "");
    setAvatar(profile.data?.avatarInscriptionId ?? null);
  }, [profile.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        address,
        displayName: name.trim() || null,
        bio: bio.trim() || null,
        avatarInscriptionId: avatar,
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["wallet-profile", address] });
      toast("PROFILE SAVED", { description: "YOUR PUBLIC PROFILE IS LIVE" });
    },
    onError: (e) => toast("PROFILE SAVE FAILED", { description: (e as Error).message }),
  });

  return (
    <section id="profile" className="mt-10 scroll-mt-24 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
        <h2 className="display text-xl">PROFILE</h2>
        <Link
          to="/profile/$address"
          params={{ address }}
          className="label underline decoration-border underline-offset-4 hover:text-foreground"
        >
          VIEW PUBLIC PROFILE →
        </Link>
      </header>

      <div className="grid gap-5 p-5 md:grid-cols-[120px_minmax(0,1fr)]">
        <div className="size-[120px] border border-border">
          <InscriptionAvatar
            inscriptionId={avatar}
            label={name || "?"}
            alt="Profile inscription avatar"
            className="size-full grayscale"
            fallbackClassName="text-[10px]"
          />
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="label">DISPLAY NAME</span>
            <input
              value={name}
              disabled={!canEdit}
              onChange={(e) => {
                setDirty(true);
                setName(e.target.value.slice(0, 48));
              }}
              placeholder="SATOSHI"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground disabled:opacity-40"
            />
          </label>
          <label className="block">
            <span className="label">BIO</span>
            <textarea
              value={bio}
              disabled={!canEdit}
              onChange={(e) => {
                setDirty(true);
                setBio(e.target.value.slice(0, 500));
              }}
              placeholder="LAND COLLECTOR SINCE BLOCK 840000"
              className="mt-1 h-20 w-full resize-none border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground disabled:opacity-40"
            />
          </label>
        </div>
      </div>

      {canEdit && (
        <div className="border-t border-border p-5">
          <span className="label">PFP — PICK AN INSCRIPTION YOU HOLD</span>
          {inscriptionIds.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              &gt; NO INSCRIPTIONS FOUND ON THIS ADDRESS<span className="blink">_</span>
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {inscriptionIds.slice(0, 40).map((id) => (
                <button
                  key={id}
                  title={id}
                  onClick={() => {
                    setDirty(true);
                    setAvatar(id === avatar ? null : id);
                  }}
                  className={`size-16 border ${
                    id === avatar ? "border-foreground" : "border-border hover:border-primary"
                  }`}
                >
                  <img
                    src={inscriptionImageUrl(id)}
                    alt="Owned inscription"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement?.classList.add(
                        "flex",
                        "items-center",
                        "justify-center",
                      );
                    }}
                    className="size-full object-cover grayscale"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="btn-term disabled:opacity-30"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "[ SAVING… ]" : "[ SAVE PROFILE ]"}
            </button>
            {avatar && (
              <button
                className="btn-term-ghost"
                onClick={() => {
                  setDirty(true);
                  setAvatar(null);
                }}
              >
                [ CLEAR PFP ]
              </button>
            )}
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="border-t border-border p-5 font-mono text-xs text-muted-foreground">
          &gt; SIGN IN WITH THE WALLET THAT HOLDS THIS ADDRESS (UNISAT / XVERSE) TO EDIT ITS
          PROFILE<span className="blink">_</span>
        </p>
      )}
    </section>
  );
}
