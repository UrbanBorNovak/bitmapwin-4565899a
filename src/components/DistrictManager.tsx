import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addBitmapToDistrict,
  createDistrict,
  deleteDistrict,
  districtsByOwnerQuery,
  removeBitmapFromDistrict,
} from "@/lib/districts";
import { useAuthSession } from "@/lib/auth";
import { isLinked, myWalletLinksQuery } from "@/lib/wallet-links";

/**
 * Lets a holder group the bitmaps they control into named districts. Writes go
 * straight to the database under RLS, so a verified wallet link is required.
 */
export function DistrictManager({
  address,
  heldHeights,
}: {
  address: string | null;
  heldHeights: number[];
}) {
  const queryClient = useQueryClient();
  const districts = useQuery(districtsByOwnerQuery(address));
  const { session } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const canWrite = Boolean(address) && isLinked(links.data, address);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<Record<string, string>>({});

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["districts"] });

  const create = useMutation({
    mutationFn: () =>
      createDistrict({
        ownerAddress: address as string,
        name: name.trim(),
        description: description.trim() || null,
        accent: null,
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      toast.success("DISTRICT CREATED");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "COULD NOT CREATE DISTRICT"),
  });

  const addBitmap = useMutation({
    mutationFn: ({ id, height }: { id: string; height: number }) => addBitmapToDistrict(id, height),
    onSuccess: () => {
      toast.success("BITMAP ADDED");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "COULD NOT ADD BITMAP"),
  });

  const removeBitmap = useMutation({
    mutationFn: ({ id, height }: { id: string; height: number }) =>
      removeBitmapFromDistrict(id, height),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDistrict(id),
    onSuccess: () => {
      toast.success("DISTRICT DELETED");
      invalidate();
    },
  });

  if (!address) {
    return (
      <div className="rounded-lg border border-dashed border-border p-5">
        <span className="label text-muted-foreground">CONNECT A WALLET TO BUILD DISTRICTS</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-base">MY DISTRICTS</h3>
        <span className="label">GROUP THE BITMAPS YOU HOLD INTO NEIGHBORHOODS</span>
      </div>

      {!canWrite ? (
        <p className="label mt-3 text-primary">
          VERIFY THIS WALLET (SIGN IN + LINK) TO CREATE DISTRICTS
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input
          className="border border-border bg-background px-3 py-2 font-mono text-xs"
          placeholder="DISTRICT NAME"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border border-border bg-background px-3 py-2 font-mono text-xs"
          placeholder="WHAT IS THIS NEIGHBORHOOD?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          className="btn-term"
          disabled={!canWrite || !name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          [ {create.isPending ? "CREATING…" : "CREATE"} ]
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {(districts.data ?? []).map((d) => (
          <div key={d.id} className="border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to="/district/$slug" params={{ slug: d.slug }} className="display text-sm hover:text-primary">
                {d.name.toUpperCase()}
              </Link>
              <div className="flex items-center gap-2">
                <span className="label">{d.heights.length} BITMAPS</span>
                <button
                  className="btn-term-ghost"
                  disabled={!canWrite}
                  onClick={() => remove.mutate(d.id)}
                >
                  [ DELETE ]
                </button>
              </div>
            </div>

            {d.heights.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.heights.map((h) => (
                  <button
                    key={h}
                    className="border border-border px-2 py-1 font-mono text-[11px] hover:border-primary hover:text-primary"
                    disabled={!canWrite}
                    title="Remove from district"
                    onClick={() => removeBitmap.mutate({ id: d.id, height: h })}
                  >
                    {h} ×
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className="border border-border bg-background px-2 py-1 font-mono text-[11px]"
                value={pending[d.id] ?? ""}
                onChange={(e) => setPending((p) => ({ ...p, [d.id]: e.target.value }))}
              >
                <option value="">SELECT A BITMAP YOU HOLD…</option>
                {heldHeights
                  .filter((h) => !d.heights.includes(h))
                  .map((h) => (
                    <option key={h} value={String(h)}>
                      {h}.bitmap
                    </option>
                  ))}
              </select>
              <button
                className="btn-term-ghost"
                disabled={!canWrite || !pending[d.id]}
                onClick={() => {
                  const height = Number(pending[d.id]);
                  if (!Number.isFinite(height)) return;
                  addBitmap.mutate({ id: d.id, height });
                  setPending((p) => ({ ...p, [d.id]: "" }));
                }}
              >
                [ ADD TO DISTRICT ]
              </button>
            </div>
          </div>
        ))}

        {districts.data && districts.data.length === 0 ? (
          <span className="label text-muted-foreground">NO DISTRICTS YET</span>
        ) : null}
      </div>
    </div>
  );
}
