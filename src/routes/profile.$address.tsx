import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { inscriptionImageUrl, profileQuery, type ParcelPage } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";
import { BUILD_KIND_LABELS, isBuildKind } from "@/lib/build-sdk";

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

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <Link to="/marketplace" className="label hover:text-foreground">
        ← BACK TO MARKETPLACE
      </Link>

      <div className="mt-6 flex flex-wrap items-start gap-6 border border-border p-6">
        <div className="size-28 shrink-0 border border-border">
          <InscriptionAvatar
            inscriptionId={profile.data?.avatarInscriptionId}
            label={profile.data?.displayName ?? address}
            alt={`Avatar inscription for ${address}`}
            className="size-full grayscale"
            fallbackClassName="text-[10px]"
          />
        </div>
        <div className="min-w-0">
          <h1 className="display text-3xl md:text-4xl">
            {profile.data?.displayName ?? shortenAddress(address)}
          </h1>
          <p className="label mt-2 break-all">{address}</p>
          {profile.data?.bio && (
            <p className="mt-4 max-w-[70ch] font-mono text-sm whitespace-pre-wrap text-muted-foreground">
              {profile.data.bio}
            </p>
          )}
          {!profile.isLoading && !profile.data && (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              &gt; NO PROFILE PUBLISHED FOR THIS ADDRESS<span className="blink">_</span>
            </p>
          )}
        </div>
      </div>

      <section className="mt-8 border border-border">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-3">
          <h2 className="display text-lg">BUILT BITMAPS</h2>
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
