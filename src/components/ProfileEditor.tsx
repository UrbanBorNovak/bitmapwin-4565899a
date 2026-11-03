import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  inscriptionImageUrl,
  profileQuery,
  saveProfile,
} from "@/lib/profiles";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";

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
  const [xHandle, setXHandle] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setName(profile.data?.editableDisplayName ?? "");
    setBio(profile.data?.bio ?? "");
    setXHandle(profile.data?.xHandle ?? "");
    setAvatar(profile.data?.avatarInscriptionId ?? null);
  }, [profile.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        address,
        displayName: name.trim() || null,
        bio: bio.trim() || null,
        avatarInscriptionId: avatar,
        xHandle: xHandle.trim() || null,
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["wallet-profile", address] });
      toast("PROFILE SAVED", { description: "YOUR PUBLIC PROFILE IS LIVE" });
    },
    onError: (e) => toast("PROFILE SAVE FAILED", { description: (e as Error).message }),
  });

  return (
    <section id="profile" className="profile-home mt-10 scroll-mt-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-profile-warm/20 p-5 md:px-7">
        <div>
          <p className="label text-profile-warm-muted">YOUR CORNER OF THE OASIS</p>
          <h2 className="display mt-2 text-xl text-profile-warm">MAKE IT YOURS</h2>
        </div>
        <Link
          to="/profile/$address"
          params={{ address }}
          className="label text-profile-warm-muted underline decoration-profile-warm/30 underline-offset-4 hover:text-profile-warm"
        >
          VIEW PUBLIC PROFILE →
        </Link>
      </header>

      <div className="grid gap-7 p-5 md:grid-cols-[144px_minmax(0,1fr)] md:p-7">
        <div className="mx-auto md:mx-0">
          <div className="profile-portrait size-36 overflow-hidden p-1.5">
          <InscriptionAvatar
            inscriptionId={avatar}
            label={name || "?"}
            alt="Profile inscription avatar"
            className="size-full rounded-full [image-rendering:pixelated]"
            fallbackClassName="text-2xl text-profile-warm"
          />
          </div>
          <p className="mt-4 text-center font-mono text-[9px] uppercase text-profile-warm-muted">
            ON-CHAIN PORTRAIT
          </p>
        </div>

        <div className="space-y-3">
          {profile.data?.residencyName && (
            <div className="profile-readout border-profile-warm px-3 py-3">
              <span className="label text-profile-warm-muted">VERIFIED RESIDENCY NAME</span>
              <p className="mt-2 font-mono text-sm text-profile-warm" data-no-translate>{profile.data.residencyName}</p>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground" data-no-translate>
                {profile.data.residencyNameInscriptionId?.slice(0, 10)}…{profile.data.residencyNameInscriptionId?.slice(-4)} · FOLLOWS MAIN BITMAP
              </p>
            </div>
          )}
          <label className="block">
            <span className="label text-profile-warm-muted">{profile.data?.residencyName ? "FALLBACK PROFILE NAME" : "WHAT SHOULD THE OASIS CALL YOU?"}</span>
            <input
              value={name}
              disabled={!canEdit}
              onChange={(e) => {
                setDirty(true);
                setName(e.target.value.slice(0, 48));
              }}
              placeholder="SATOSHI"
              className="profile-readout mt-2 min-h-11 w-full px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-profile-warm disabled:opacity-40"
            />
            <span className="mt-1 block text-right font-mono text-[9px] text-muted-foreground">{name.length}/48</span>
          </label>
          <label className="block">
            <span className="label text-profile-warm-muted">X (TWITTER) HANDLE</span>
            <div className="profile-readout mt-2 flex min-h-11 items-center px-3 focus-within:border-profile-warm">
              <span className="font-mono text-sm text-muted-foreground">@</span>
              <input
                value={xHandle}
                disabled={!canEdit}
                onChange={(e) => {
                  setDirty(true);
                  setXHandle(e.target.value.replace(/^@/, "").slice(0, 40));
                }}
                placeholder="yourhandle"
                data-no-translate
                className="w-full bg-transparent py-2 pl-1 font-mono text-sm text-foreground outline-none disabled:opacity-40"
              />
            </div>
            <span className="mt-1 block font-mono text-[9px] text-muted-foreground">SELF-DECLARED · SHOWN ON YOUR PUBLIC PROFILE · NOT VERIFIED BY X</span>
          </label>
          <label className="block">
            <span className="label text-profile-warm-muted">YOUR STORY</span>
            <textarea
              value={bio}
              disabled={!canEdit}
              onChange={(e) => {
                setDirty(true);
                setBio(e.target.value.slice(0, 500));
              }}
              placeholder="TELL OTHER EXPLORERS WHAT YOU BUILD, COLLECT, OR SEEK…"
              className="profile-readout mt-2 h-28 w-full resize-none px-3 py-2 font-mono text-sm leading-relaxed text-foreground outline-none focus:border-profile-warm disabled:opacity-40"
            />
            <span className="mt-1 block text-right font-mono text-[9px] text-muted-foreground">{bio.length}/500</span>
          </label>
        </div>
      </div>

      {canEdit && (
        <div className="border-t border-profile-warm/20 p-5 md:p-7">
          <span className="label text-profile-warm-muted">CHOOSE AN INSCRIPTION THAT FEELS LIKE YOU</span>
          {inscriptionIds.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              &gt; NO INSCRIPTIONS FOUND ON THIS ADDRESS<span className="blink">_</span>
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {inscriptionIds.slice(0, 40).map((id) => (
                <button
                  key={id}
                  title={id}
                  onClick={() => {
                    setDirty(true);
                    setAvatar(id === avatar ? null : id);
                  }}
                  aria-label={id === avatar ? "Remove selected profile portrait" : "Use inscription as profile portrait"}
                  className={`aspect-square w-full overflow-hidden rounded-full border p-1 ${
                    id === avatar ? "border-profile-warm bg-profile-warm/10" : "border-border hover:border-profile-warm"
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
                    className="size-full rounded-full object-cover [image-rendering:pixelated]"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="btn-term disabled:opacity-30"
              disabled={save.isPending || !dirty}
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
        <p className="border-t border-profile-warm/20 p-5 font-mono text-xs text-muted-foreground">
          &gt; SIGN IN WITH THE WALLET THAT HOLDS THIS ADDRESS (UNISAT / XVERSE) TO EDIT ITS
          PROFILE<span className="blink">_</span>
        </p>
      )}
    </section>
  );
}
