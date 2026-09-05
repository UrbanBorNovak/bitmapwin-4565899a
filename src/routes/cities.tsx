import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DataBadge } from "@/components/extenders/DataBadge";
import { citiesQuery, slugify } from "@/lib/extenders";
import { foundCityFn, joinCityFn } from "@/lib/extenders.functions";
import { useAuthSession } from "@/lib/auth";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/cities")({
  head: () => {
    const title = "Cities — Bitmaps That Build Together";
    const description =
      "Cities are groups of neighbouring BITMAPs run as one place: shared identity, shared extenders and a shared front door into the 3D world.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CitiesPage,
});

function CitiesPage() {
  const cities = useQuery(citiesQuery());
  const { session } = useAuthSession();
  const list = cities.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">BEDROCK · SETTLEMENTS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">CITIES</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        A city is a voluntary alliance of BITMAPs. Each tile stays individually owned and permanent — the city only adds
        a shared name, a shared entrance and shared systems on top.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="FOUNDING & MEMBERSHIP" />
        <DataBadge kind="soon" note="GOVERNANCE & TREASURY" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {cities.isPending ? (
            <p className="font-mono text-sm text-muted-foreground">&gt; READING SETTLEMENTS…</p>
          ) : list.length === 0 ? (
            <div className="border border-border bg-surface p-6">
              <div className="display text-xl">NO CITIES FOUNDED YET</div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Found the first one with a BITMAP you hold. Neighbours can then join with their own tiles.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((city) => (
                <li key={city.id} className="border border-border bg-surface p-4">
                  <div className="display text-lg">{city.name}</div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {city.description || "NO DESCRIPTION"}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[10px]">
                    <div>
                      <dt className="text-muted-foreground">BITMAPS</dt>
                      <dd data-no-translate>{city.heights.length}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">FOUNDER</dt>
                      <dd data-no-translate>{shortenAddress(city.founderAddress)}</dd>
                    </div>
                  </dl>
                  {city.heights.length ? (
                    <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                      {city.heights.slice(0, 6).map((h) => (
                        <Link
                          key={h}
                          to="/bitmap/$block"
                          params={{ block: String(h) }}
                          className="border border-border px-1.5 py-0.5 hover:border-bitcoin hover:text-bitcoin"
                          data-no-translate
                        >
                          {h}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {session ? <JoinCity cityId={city.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside>
          {session ? (
            <FoundCityForm />
          ) : (
            <div className="border border-border bg-surface p-4">
              <div className="label text-bitcoin">FOUND A CITY</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in and connect the wallet holding the BITMAP you want to found on.
              </p>
              <Link to="/auth" className="btn-term-ghost mt-4 inline-flex w-full justify-center">[ SIGN IN ]</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FoundCityForm() {
  const found = useServerFn(foundCityFn);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [height, setHeight] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      const block = Number(height);
      if (trimmed.length < 2) throw new Error("NAME THE CITY");
      if (!Number.isInteger(block) || block < 0) throw new Error("ENTER A BITMAP YOU HOLD");
      return found({ data: { slug: slugify(trimmed), name: trimmed, description: description.trim(), height: block } });
    },
    onSuccess: () => {
      toast("CITY FOUNDED");
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      setName("");
      setDescription("");
      setHeight("");
    },
    onError: (error) => toast("COULD NOT FOUND CITY", { description: (error as Error).message }),
  });

  return (
    <div className="border border-border bg-surface p-4">
      <div className="label text-bitcoin">FOUND A CITY</div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="City name"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <input
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="Founding BITMAP, e.g. 840000"
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this city is for"
          rows={3}
          className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
        />
        <button type="button" className="btn-term w-full" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "[ VERIFYING OWNERSHIP… ]" : "[ FOUND CITY ]"}
        </button>
      </div>
    </div>
  );
}

function JoinCity({ cityId }: { cityId: string }) {
  const join = useServerFn(joinCityFn);
  const queryClient = useQueryClient();
  const [height, setHeight] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const block = Number(height);
      if (!Number.isInteger(block) || block < 0) throw new Error("ENTER A BITMAP YOU HOLD");
      return join({ data: { cityId, height: block } });
    },
    onSuccess: () => {
      toast("BITMAP JOINED THE CITY");
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      setHeight("");
    },
    onError: (error) => toast("COULD NOT JOIN", { description: (error as Error).message }),
  });

  return (
    <div className="mt-4 flex gap-2 border-t border-border pt-3">
      <input
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        placeholder="Your BITMAP"
        className="min-w-0 flex-1 border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin"
      />
      <button type="button" className="btn-term-ghost shrink-0" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "[ … ]" : "[ JOIN ]"}
      </button>
    </div>
  );
}
