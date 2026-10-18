import { Link } from "@tanstack/react-router";
import { BitmapStreamPlayer } from "@/components/territory/BitmapStreamPlayer";
import { GENESIS_BROADCASTER as G } from "@/lib/genesis-broadcaster";

export function GenesisBroadcaster() {
  return (
    <section className="mt-8 grid gap-4 border border-border bg-card p-4 md:grid-cols-[1fr_320px]" aria-labelledby="genesis-broadcaster">
      <BitmapStreamPlayer height={G.channelHeight} />
      <div className="flex flex-col gap-3">
        <p className="label text-bitcoin">● GENESIS BROADCASTER</p>
        <h2 id="genesis-broadcaster" className="display text-3xl" data-no-translate>@{G.handle}</h2>
        <p className="text-sm text-muted-foreground">
          The first voice of bitmap.stream. His channel plays live on the Oasis Jumbotron at {G.channelHeight.toLocaleString("en-US")}.BITMAP — walk up to the screen to tune in.
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <a href={G.xUrl} target="_blank" rel="noopener noreferrer" className="btn-term">[ FOLLOW ON X ↗ ]</a>
          <a href={G.channelUrl} target="_blank" rel="noopener noreferrer" className="btn-term-ghost">[ BITMAP.STREAM ↗ ]</a>
          <Link to="/oasis" search={{ height: G.channelHeight }} className="btn-term-ghost">[ WATCH IN THE OASIS → ]</Link>
        </div>
      </div>
    </section>
  );
}
