import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BlockMosaic } from "@/components/BlockMosaic";
import { ClubBadge } from "@/components/ClubBadge";
import { districtBySlugQuery } from "@/lib/districts";
import { shortenAddress } from "@/lib/registry";
import { profileQuery } from "@/lib/profiles";

export const Route = createFileRoute("/district/$slug")({
  head: ({ params }) => {
    const title = `District ${params.slug} — Bitmap Neighborhood`;
    const description = `A bitmap district: the blocks one holder groups together as a single neighborhood on the map.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: DistrictPage,
});

function DistrictPage() {
  const { slug } = Route.useParams();
  const district = useQuery(districtBySlugQuery(slug));
  const owner = useQuery(profileQuery(district.data?.ownerAddress ?? ""));

  if (district.isPending) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
        <span className="label">SYNC DISTRICT…</span>
      </div>
    );
  }

  if (!district.data) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
        <h1 className="display text-3xl">DISTRICT NOT FOUND</h1>
        <Link to="/builds" className="btn-term mt-6 inline-block">
          [ ALL BUILDS ]
        </Link>
      </div>
    );
  }

  const d = district.data;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">{d.name.toUpperCase()}</h1>
      <p className="label mt-3">
        DISTRICT OF {owner.data?.displayName?.toUpperCase() ?? shortenAddress(d.ownerAddress)} ·{" "}
        {d.heights.length} BITMAP{d.heights.length === 1 ? "" : "S"}
      </p>
      {d.description ? (
        <p className="mt-4 max-w-[60ch] font-mono text-xs text-muted-foreground">{d.description}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/profile/$address"
          params={{ address: d.ownerAddress }}
          className="btn-term-ghost"
        >
          [ OWNER PROFILE ]
        </Link>
        <Link to="/builds" className="btn-term-ghost">
          [ ALL BUILDS ]
        </Link>
      </div>

      {d.heights.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {d.heights.map((height) => (
            <Link
              key={height}
              to="/bitmap/$block"
              params={{ block: String(height) }}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
            >
              <div className="border border-border">
                <BlockMosaic height={height} />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="display text-xs">{height}</span>
                <ClubBadge height={height} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-border p-6">
          <span className="label text-muted-foreground">NO BITMAPS ADDED TO THIS DISTRICT YET</span>
        </div>
      )}
    </div>
  );
}
