import { useQuery } from "@tanstack/react-query";
import { reinscriptionsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";
import { InscriptionContent } from "@/components/InscriptionContent";

/**
 * When the district's claim sat carries later inscriptions, label the district
 * as REINSCRIBED and render each reinscription beside the original in a
 * slightly smaller window.
 */
export function DistrictReinscriptions({
  height,
  districtInscriptionId,
}: {
  height: number;
  districtInscriptionId: string | null;
}) {
  const scan = useQuery(reinscriptionsQuery(districtInscriptionId));
  const list = scan.data?.reinscriptions ?? [];

  if (!districtInscriptionId || list.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-3">
        <span className="label">
          REINSCRIBED — {height}.BITMAP CARRIES {list.length.toLocaleString("en-US")} LATER INSCRIPTION
          {list.length === 1 ? "" : "S"}
        </span>
        <span className="label text-muted-foreground">
          {scan.data?.sat !== null && scan.data?.sat !== undefined
            ? `SAT ${scan.data.sat.toLocaleString("en-US")}`
            : "SAT —"}
        </span>
      </header>

      <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-start">
        <div className="w-full md:w-56 shrink-0">
          <span className="label block">ORIGINAL CLAIM</span>
          <InscriptionContent
            inscriptionId={districtInscriptionId}
            className="mt-2 aspect-square w-full border border-border"
            title={`${height}.bitmap`}
          />
          <span className="label mt-2 block text-muted-foreground">
            {shortId(districtInscriptionId)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <span className="label block">REINSCRIPTIONS</span>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {list.map((r) => (
              <div key={r.inscriptionId} className="w-36 shrink-0 rounded border border-border">
                <InscriptionContent
                  inscriptionId={r.inscriptionId}
                  contentType={r.contentType}
                  interactive
                  className="aspect-square w-full border-b border-border"
                  title={`Reinscription of ${height}.bitmap`}
                />
                <div className="px-2 py-1.5">
                  <span className="display block truncate text-[11px]">
                    {shortId(r.inscriptionId)}
                  </span>
                  <a
                    className="label block truncate text-muted-foreground hover:text-primary"
                    href={`https://ordinals.com/inscription/${r.inscriptionId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {(r.contentType ?? "UNKNOWN").split(";")[0]!.toUpperCase()} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
