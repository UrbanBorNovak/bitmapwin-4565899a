import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  inscriptionImageUrl,
  parcelPageQuery,
  profileQuery,
  recordBitmapView,
  saveParcelPage,
  viewStatsQuery,
} from "@/lib/profiles";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";
import { useAuthSession } from "@/lib/auth";
import { isLinked, myWalletLinksQuery } from "@/lib/wallet-links";
import { BuildDelegates } from "@/components/BuildDelegates";
import { buildInscriptionPayload, delegatesQuery, downloadJson } from "@/lib/builds";
import { districtForHeightQuery } from "@/lib/districts";
import { safeExternalUrl } from "@/lib/safe-url";
import { recordPassportVisitFn } from "@/lib/views.functions";
import { BuildEditor } from "@/components/builds/BuildEditor";
import { PublicBuildViewer } from "@/components/builds/PublicBuildViewer";
import { BuildRaffles } from "@/components/coins/BuildRaffles";
import { LiveBitmapPresence } from "@/components/LiveBitmapPresence";
import { BitmapModelPlacement } from "@/components/BitmapModelPlacement";
import {
  BUILD_KIND_LABELS,
  DEFAULT_CONFIGS,
  presetsForKind,
  type BuildKind,
} from "@/lib/build-sdk";

/** Zero-decision entry points shown before anything is built on a bitmap. */
const QUICK_STARTS: { kind: BuildKind; label: string }[] = [
  { kind: "info", label: "HOLDER PAGE" },
  { kind: "gallery", label: "GALLERY" },
  { kind: "shop", label: "SHOP" },
  { kind: "game3d", label: "3D WORLD" },
  { kind: "game2d", label: "ARCADE" },
];

/**
 * Visitor counter + owner-built page for a parcel: banner, title, description
 * and a link. Editing unlocks when the connected wallet holds the parcel.
 */
export function ParcelPagePanel({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const wallet = useWalletSession();
  const page = useQuery(parcelPageQuery(height));
  const stats = useQuery(viewStatsQuery(height));
  const ownerProfile = useQuery(profileQuery(ownerAddress ?? ""));
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const recordPassportVisit = useServerFn(recordPassportVisitFn);
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  // Editing needs both wallet control in the UI and a server-verified link, so
  // the write actually passes the ownership policy.
  const delegates = useQuery(delegatesQuery(height));
  const district = useQuery(districtForHeightQuery(height));
  const isHolder = walletControls(wallet, ownerAddress) && isLinked(links.data, ownerAddress);
  // A delegate the holder granted can build too (RLS mirrors this check).
  const isDelegate = (delegates.data ?? []).some(
    (d) =>
      (d.delegateAddress === wallet?.ordinalsAddress ||
        d.delegateAddress === wallet?.paymentAddress) &&
      isLinked(links.data, d.delegateAddress),
  );
  const canEdit = isHolder || isDelegate;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [banner, setBanner] = useState("");
  const [buildKind, setBuildKind] = useState<BuildKind>("info");
  const [buildConfig, setBuildConfig] = useState<unknown>(DEFAULT_CONFIGS.info);

  // Log the visit once per mount; the DB counts unique visitors by device key.
  useEffect(() => {
    let cancelled = false;
    const viewer = wallet?.ordinalsAddress ?? null;
    recordBitmapView(height, viewer)
      .then(() => {
        if (!cancelled) queryClient.invalidateQueries({ queryKey: ["view-stats", height] });
        if (session) void recordPassportVisit({ data: { height } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [height, wallet?.ordinalsAddress, queryClient, recordPassportVisit, session]);

  function startEditing() {
    setTitle(page.data?.title ?? "");
    setDescription(page.data?.description ?? "");
    setLinkUrl(page.data?.linkUrl ?? "");
    setBanner(page.data?.bannerInscriptionId ?? "");
    const kind = page.data?.buildKind ?? "info";
    setBuildKind(kind);
    setBuildConfig(page.data?.buildConfig ?? DEFAULT_CONFIGS[kind]);
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: () => {
      if (!ownerAddress) throw new Error("NO OWNER RESOLVED FOR THIS BITMAP");
      return saveParcelPage({
        bitmapHeight: height,
        ownerAddress,
        title: title.trim() || null,
        description: description.trim() || null,
        linkUrl: linkUrl.trim() || null,
        bannerInscriptionId: banner.trim() || null,
        buildKind,
        buildConfig,
      });
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["parcel-page", height] });
      toast(`${height}.BITMAP`, { description: "BITMAP PAGE UPDATED" });
    },
    onError: (e) => toast("BITMAP PAGE SAVE FAILED", { description: (e as Error).message }),
  });

  const built = page.data;

  return (
    <section id="world" className="border-x border-b border-border scroll-mt-20">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <span className="label text-signal">LIVE TERRITORY — {height}.BITMAP</span>
        <span className="label">
          {stats.data
            ? `${stats.data.totalViews.toLocaleString("en-US")} VIEWS · ${stats.data.uniqueVisitors.toLocaleString("en-US")} VISITORS`
            : "COUNTING VISITS…"}
        </span>
      </header>

      {built?.bannerInscriptionId && (
        <img
          src={inscriptionImageUrl(built.bannerInscriptionId)}
          alt={`${height}.bitmap parcel banner`}
          loading="lazy"
          className="h-48 w-full border-b border-border object-cover grayscale md:h-64"
        />
      )}

      <LiveBitmapPresence height={height} placeName={built?.title || `${height}.BITMAP`} />

      <div className="space-y-4 px-4 py-5 md:px-6 md:py-7">
        {built ? (
          <>
            {built.title && <h2 className="display text-2xl md:text-4xl">{built.title}</h2>}
            {built.description && (
              <p className="max-w-[70ch] font-mono text-sm whitespace-pre-wrap text-muted-foreground">
                {built.description}
              </p>
            )}
            {safeExternalUrl(built.linkUrl) && (
              <a
                href={safeExternalUrl(built.linkUrl)!}
                target="_blank"
                rel="noreferrer nofollow"
                className="block break-all font-mono text-xs underline decoration-border underline-offset-4 hover:text-foreground"
              >
                {safeExternalUrl(built.linkUrl)}
              </a>
            )}

            <p className="label">
              BUILT BY{" "}
              <Link
                to="/profile/$address"
                params={{ address: built.ownerAddress }}
                className="underline decoration-border underline-offset-4 hover:text-foreground"
              >
                {ownerProfile.data?.displayName ?? shortenAddress(built.ownerAddress)}
              </Link>
              {built.updatedAt ? ` · ${timeAgo(built.updatedAt)}` : ""}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; NOTHING BUILT ON THIS BITMAP YET
            {canEdit ? (isHolder ? " — IT'S YOURS, BUILD IT" : " — YOU ARE A DELEGATE, BUILD IT") : ""}
            <span className="blink">_</span>
          </p>
        )}

        {built && (
          <div className="pt-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="label text-bitcoin">{BUILD_KIND_LABELS[built.buildKind]}</p>
              <span className="label hidden text-signal sm:block">INTERACTIVE · PUBLIC</span>
            </div>
            <PublicBuildViewer
              page={built}
              district={district.data ? { name: district.data.name, slug: district.data.slug } : null}
            />
            <BuildRaffles height={height} />
          </div>
        )}

        {district.data && (
          <p className="label">
            ZONE{" "}
            <Link
              to="/district/$slug"
              params={{ slug: district.data.slug }}
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {district.data.name.toUpperCase()}
            </Link>
          </p>
        )}

        {stats.data?.lastViewedAt && (
          <p className="label">LAST VISIT {timeAgo(stats.data.lastViewedAt)}</p>
        )}

        {built && (
          <button
            className="btn-term-ghost"
            onClick={() =>
              downloadJson(
                `${height}.bitmap-build.json`,
                buildInscriptionPayload(
                  built,
                  district.data ? { name: district.data.name, slug: district.data.slug } : null,
                ),
              )
            }
          >
            [ EXPORT BUILD FOR INSCRIBING ]
          </button>
        )}

        <BuildDelegates height={height} ownerAddress={ownerAddress} />
        <BitmapModelPlacement height={height} canEdit={isHolder} />
      </div>

      {canEdit && !editing && (
        <div className="space-y-3 border-t border-border px-6 py-4">
          <button className="btn-term" onClick={startEditing}>
            {built ? "[ EDIT BITMAP PAGE ]" : "[ BUILD ON THIS BITMAP ]"}
          </button>
          {!built && (
            <div>
              <span className="label">OR START IN ONE CLICK</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_STARTS.map((quick) => {
                  const preset = presetsForKind(quick.kind)[0];
                  return (
                    <button
                      key={quick.label}
                      className="btn-term-ghost"
                      onClick={() => {
                        startEditing();
                        setBuildKind(quick.kind);
                        setBuildConfig(preset ? preset.config : DEFAULT_CONFIGS[quick.kind]);
                      }}
                    >
                      [ {quick.label} ]
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {canEdit && editing && (
        <div className="space-y-3 border-t border-border px-6 py-5">
          <label className="block">
            <span className="label">TITLE</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="THE CITADEL"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="label">DESCRIPTION</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="WHAT STANDS ON THIS BLOCK OF DIGITAL LAND"
              className="mt-1 h-24 w-full resize-none border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="label">LINK</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value.slice(0, 300))}
              placeholder="https://"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="label">BANNER INSCRIPTION ID</span>
            <input
              value={banner}
              onChange={(e) => setBanner(e.target.value.trim().slice(0, 120))}
              placeholder="<txid>i0"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
            />
          </label>
          <BuildEditor
            kind={buildKind}
            config={buildConfig}
            onKindChange={setBuildKind}
            onConfigChange={setBuildConfig}
            walletAddress={wallet?.ordinalsAddress ?? ownerAddress}
            height={height}
          />


          <div className="flex flex-wrap gap-3">
            <button
              className="btn-term disabled:opacity-30"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "[ SAVING… ]" : "[ SAVE PAGE ]"}
            </button>
            <button className="btn-term-ghost" onClick={() => setEditing(false)}>
              [ CANCEL ]
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
