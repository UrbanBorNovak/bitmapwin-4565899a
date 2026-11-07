import { useEffect as useEffectPlay, useState as useStatePlay } from "react";
import { PlayStatsPanel } from "@/components/play/PlayStatsPanel";
import { ownerKey, readProfileFor } from "@/lib/game/worldState";
import { fetchRemotePlayProfile, pickRicher } from "@/lib/game/cloudSync";
import type { PlayProfile } from "@/lib/game/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { profileQuery, type ParcelPage } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";
import { BUILD_KIND_LABELS, isBuildKind } from "@/lib/build-sdk";
import { membershipBadgeQuery } from "@/lib/membership";
import { followerCountsQuery } from "@/lib/follows";
import { formatBit } from "@/lib/coins";
import { baseValueOf, playerStockQuery, shareHoldersQuery, sharePrice } from "@/lib/player-stock";
import { rankPlayerByWalletQuery } from "@/lib/ranks";
import { PassportSummary } from "@/components/PassportSummary";
import { StampCard } from "@/components/StampCard";
import { publicPassportQuery } from "@/lib/provenance-stream";
import { ParcelClubBadges } from "@/components/ParcelClubBadges";
import { MemberRibbon } from "@/components/MemberRibbon";
import { TraitHolderBadge } from "@/components/TraitHolderBadge";
import { traitHolderBadgesQuery } from "@/lib/trait-collections";

export const Route = createFileRoute("/profile/$address")({
  head: ({ params }) => {
    const title = `${shortenAddress(params.address)} — Bitmap Land Profile`;
    const description = `Public profile, bio and built bitmaps for the Bitcoin address ${params.address} on the Bitmap land layer.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ProfilePage,
});

const ownerPagesQuery = (address: string) =>
  queryOptions({
    queryKey: ["parcel-pages-by-owner", address],
    queryFn: async (): Promise<ParcelPage[]> => {
      const { data, error } = await supabase
        .from("parcel_pages")
        .select("bitmap_height, owner_address, title, description, link_url, banner_inscription_id, build_kind, build_config, updated_at")
        .eq("owner_address", address)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        bitmapHeight: Number(row.bitmap_height),
        ownerAddress: row.owner_address,
        title: row.title,
        description: row.description,
        linkUrl: row.link_url,
        bannerInscriptionId: row.banner_inscription_id,
        buildKind: isBuildKind(row.build_kind) ? row.build_kind : "info",
        buildConfig: row.build_config,
        updatedAt: row.updated_at,
      }));
    },
    staleTime: 60_000,
  });

function ProfilePage() {
  const { address } = Route.useParams();
  const profile = useQuery(profileQuery(address));
  const pages = useQuery(ownerPagesQuery(address));
  const membership = useQuery(membershipBadgeQuery(address));
  const traitHolders = useQuery(traitHolderBadgesQuery([address]));
  const followers = useQuery(followerCountsQuery([address]));
  const ranked = useQuery(rankPlayerByWalletQuery(address));
  const stock = useQuery(playerStockQuery(ranked.data?.id ?? null));
  const holders = useQuery(shareHoldersQuery(ranked.data?.id ?? null));
  const passport = useQuery(publicPassportQuery(address));
  const isMember = membership.data === true;
  const followerCount = followers.data?.get(address) ?? 0;
  const displayName = profile.data?.displayName ?? shortenAddress(address);

  const base = ranked.data ? baseValueOf(ranked.data) : 25;
  const issued = stock.data?.sharesIssued ?? 0;
  const shareVal = sharePrice(base, issued);
  const holderCount = (holders.data ?? []).length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <Link to="/marketplace" className="label hover:text-profile-warm">
        ← BACK TO MARKETPLACE
      </Link>

      <div className="profile-home mt-6">
        <div className="grid items-center gap-7 p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:p-8">
        <div className="profile-portrait mx-auto size-32 shrink-0 overflow-hidden p-1.5 md:mx-0">
          <InscriptionAvatar
            inscriptionId={profile.data?.avatarInscriptionId}
            label={displayName}
            alt={`Avatar inscription for ${address}`}
            className="size-full rounded-full [image-rendering:pixelated]"
            fallbackClassName="text-2xl text-profile-warm"
          />
        </div>
        <div className="min-w-0 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <h1 className="display text-3xl text-profile-warm md:text-4xl">
              {displayName}
            </h1>
            {isMember && (
              <MemberRibbon />
            )}
            {traitHolders.data?.get(address.toLowerCase()) && <TraitHolderBadge traits={traitHolders.data.get(address.toLowerCase())!.traitIds} />}
          </div>
          <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{address}</p>
          <ParcelClubBadges address={address} className="mt-3 justify-center md:justify-start" />
          {profile.data?.xHandle && (
            <a
              href={profile.data.xVerifiedTweetId ? `https://x.com/${profile.data.xHandle}/status/${profile.data.xVerifiedTweetId}` : `https://x.com/${profile.data.xHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              title={profile.data.xVerifiedTweetId ? "Verified by a public tweet naming this address" : "Self-declared by the wallet owner; not verified by X"}
              className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-profile-warm underline decoration-profile-warm/30 underline-offset-4 hover:text-foreground"
              data-no-translate
            >
              𝕏 @{profile.data.xHandle} {profile.data.xVerifiedTweetId ? <span className="text-[9px] text-signal no-underline">VERIFIED ✓</span> : <span className="text-[9px] text-muted-foreground no-underline">SELF-DECLARED</span>}
            </a>
          )}
          {profile.data?.bio && (
            <p className="mt-5 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {profile.data.bio}
            </p>
          )}
          {!profile.isLoading && !profile.data && (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              &gt; NO PROFILE PUBLISHED FOR THIS ADDRESS<span className="blink">_</span>
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-1">
          <div className="profile-readout min-w-28 p-3 text-center"><p className="label">BUILT BITMAPS</p><p className="mt-1 font-mono font-bold text-profile-warm">{pages.data?.length ?? 0}</p></div>
          <div className="profile-readout min-w-28 p-3 text-center"><p className="label">FOLLOWERS</p><p className="mt-1 font-mono font-bold text-profile-warm">{followerCount}</p></div>
        </div>
        </div>
        <div className="border-t border-profile-warm/20 bg-background/30 px-6 py-3 font-mono text-[10px] text-profile-warm-muted md:px-8">● A HOME BUILT ON BITCOIN</div>
      </div>

      <ProfilePlayStats address={address} />
      {passport.data && (passport.data.stamps.length > 0 || passport.data.events.length > 0) ? <div className="mt-8 space-y-3"><PassportSummary passport={passport.data} publicView /><div className="grid gap-3 md:grid-cols-2">{passport.data.stamps.slice(0, 4).map((item) => <StampCard key={item.id} stamp={item} />)}</div></div> : null}

      {ranked.data && (
        <section className="profile-home mt-8" aria-label="Share book">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-3">
            <div>
              <p className="label text-profile-warm-muted">THEIR STAKE IN THE OASIS</p>
              <h2 className="display mt-2 text-lg text-profile-warm">SHARE BOOK</h2>
            </div>
            <Link
              to="/ranks/player/$id"
              params={{ id: ranked.data.id }}
              className="label text-bitcoin hover:underline"
            >
              [ CHARACTER RECORD ]
            </Link>
          </header>
          <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            <div className="profile-readout bg-background p-4 text-center">
              <p className="label">SHARE PRICE</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-profile-warm">{formatBit(shareVal)}</p>
            </div>
            <div className="profile-readout bg-background p-4 text-center">
              <p className="label">SHARES ISSUED</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-profile-warm">{issued.toLocaleString("en-US")}</p>
            </div>
            <div className="profile-readout bg-background p-4 text-center">
              <p className="label">SHARE HOLDERS</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-profile-warm">{holderCount.toLocaleString("en-US")}</p>
            </div>
            <div className="profile-readout bg-background p-4 text-center">
              <p className="label">DIVIDENDS PAID</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-profile-warm">{formatBit(stock.data?.dividendsPaid ?? 0)}</p>
            </div>
          </div>
          <p className="border-t border-profile-warm/20 px-6 py-2 font-mono text-[10px] text-profile-warm-muted">
            HOLDING A SHARE OF THIS SOUL PAYS A TENTH OF EVERY BIT THEY EARN.
          </p>
        </section>
      )}

      <section className="profile-home mt-8">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-3">
          <div><p className="label text-profile-warm-muted">THEIR MARK ON THE OASIS</p><h2 className="display mt-2 text-lg text-profile-warm">BUILT BITMAPS</h2></div>
          <span className="label">{pages.data?.length ?? 0} PAGE(S)</span>
        </header>
        {pages.isLoading ? (
          <p className="px-6 py-6 font-mono text-xs text-muted-foreground">
            &gt; READING BITMAP PAGES<span className="blink">_</span>
          </p>
        ) : (pages.data?.length ?? 0) === 0 ? (
          <p className="px-6 py-6 font-mono text-xs text-muted-foreground">
            &gt; NOTHING BUILT FROM THIS ADDRESS YET<span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pages.data!.map((p) => (
              <li key={p.bitmapHeight} className="px-6 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(p.bitmapHeight) }}
                    className="display text-sm underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    {p.bitmapHeight}.BITMAP{p.title ? ` — ${p.title}` : ""}
                  </Link>
                  <span className="label">
                    {BUILD_KIND_LABELS[p.buildKind]}
                    {p.updatedAt ? ` · ${timeAgo(p.updatedAt)}` : ""}
                  </span>
                </div>
                {p.description && (
                  <p className="mt-2 line-clamp-2 font-mono text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProfilePlayStats({ address }: { address: string }) {
  const [play, setPlay] = useStatePlay<PlayProfile | null>(null);
  useEffectPlay(() => {
    let live = true;
    const local = readProfileFor(address);
    setPlay(local);
    void fetchRemotePlayProfile(ownerKey(address)).then((remote) => {
      if (live) setPlay(pickRicher(local, remote));
    });
    return () => {
      live = false;
    };
  }, [address]);
  if (!play || play.stats.matches === 0) return null;
  return (
    <div className="mt-8">
      <PlayStatsPanel profile={play} title="PLAY" />
    </div>
  );
}
