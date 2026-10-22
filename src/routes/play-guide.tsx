import { GuideTrail } from "@/components/GuideTrail";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/play-guide")({
  head: () => {
    const title = "Player Guide — Controls, Devices and the Oasis — BitmapWin";
    const description =
      "How to play BitmapWin: desktop and touch controls, camera modes, what lives in the Oasis, graphics quality presets, BIT rewards, parties and clans.";
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
  component: PlayGuidePage,
});

const DESKTOP = [
  { k: "W A S D", v: "Move. Hold shift to sprint." },
  { k: "MOUSE", v: "Look around. Left click fires the equipped weapon." },
  { k: "SPACE", v: "Jump. Works on foot and while mounted." },
  { k: "C", v: "Switch camera: first person, third person, map view." },
  { k: "E", v: "Interact: mount, enter a vehicle, open a structure or shrine." },
  { k: "B", v: "Open the BUILD menu with shrine, wall, gate and camp templates." },
  { k: "M", v: "Open the base menu: scan map and nearby players." },
  { k: "ENTER", v: "Open world chat. Party chat is a separate channel." },
];

const TOUCH = [
  { k: "LEFT THUMB STICK", v: "Move and turn. Push fully forward to sprint." },
  { k: "RIGHT HALF DRAG", v: "Look around." },
  { k: "JUMP / FIRE PADS", v: "Large tap targets on the right, safe-area aware." },
  { k: "UP / DOWN PADS", v: "Climb and descend while flying or in an air ride." },
];

const WORLD = [
  {
    title: "REAL BITMAP TERRAIN",
    body: "The ground is generated from the actual Bitcoin blocks behind each BITMAP, so elevation, water and lava are the same for everyone. Nearby BITMAPs stream in as you travel.",
  },
  {
    title: "GRASS, TREES AND WEATHER",
    body: "Oasis patches, shore trees, flowers and mushrooms grow rooted to the terrain. Sun, wind and rain run on a shared clock and bend grass, push rivers and wet the world edges.",
  },
  {
    title: "RIVERS AND WATERFALLS",
    body: "Rivers start as narrow creeks, widen downhill and never move once set. You can walk near water and across shallow water; land rides stay on land.",
  },
  {
    title: "THE EDGE OF THE WORLD",
    body: "Glass walls mark the boundary. Beyond them the outside world is grayscale, with colossal inscribed towers on the horizon so the Oasis feels small.",
  },
  {
    title: "LIFE AND COMBAT",
    body: "Roaming creatures, miners, companions and other players share the world. Combat has damage, cooldown and range shown in the HUD, and a shared hit log.",
  },
  {
    title: "VEHICLES AND MOUNTS",
    body: "Tanks and air rides have their own handling, trails, hull damage and explosions. Mounts follow terrain and let you jump while riding.",
  },
  {
    title: "BUILDING",
    body: "The BUILD menu places whole templates at once and refuses placements that do not fit. Structures are stored on the server, so everyone sees them.",
  },
  {
    title: "PARTIES AND CLANS",
    body: "Three-player parties with invites, a leader and party chat. Clans are persistent, with a leader-chosen inscribed crest shown on nameplates.",
  },
];

const QUALITY = [
  { k: "AUTO", v: "Default. Picks a preset from your device and the first seconds of frame rate, and offers Low once on limited phones." },
  { k: "LOW", v: "Flat brighter ground, no shadows, fewest props and creatures, 30 frames per second. Made for phones and old machines." },
  { k: "MEDIUM", v: "Nearby districts, optional soft shadows, half the effects, 45 frames per second." },
  { k: "HIGH", v: "Full view distance, soft shadows, all props, creatures and effects, 60 frames per second." },
];

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border p-4 last:border-b-0 md:flex-row md:items-baseline md:gap-4">
      <span className="label w-56 shrink-0 text-bitcoin" data-no-translate>{k}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{v}</span>
    </div>
  );
}

function PlayGuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">PLAY · GUIDE</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">PLAYER GUIDE</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        The Oasis is a shared sandbox, not a grind. There are no levels to climb — you walk in, explore the real
        BITMAP terrain, build, trade and leave when you want. Everything below is live today.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/oasis" className="btn-term">[ ENTER THE OASIS ]</Link>
        <Link to="/character" className="btn-term-ghost">[ MAKE YOUR CHARACTER ]</Link>
        <Link to="/docs" className="btn-term-ghost">[ DOCS ]</Link>
      </div>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">FIRST FIVE MINUTES</h2>
        <div className="mt-4 border border-border">
          <Row k="01 · CHARACTER" v="Pick a body, one of the inscribed pixel skins and your gear. Everything you equip shows on the model." />
          <Row k="02 · WALK IN" v="Open the Oasis. The renderer loads only when you enter, so the rest of the site stays light." />
          <Row k="03 · FIND PEOPLE" v="Open the base menu for the scan map and the nearest players, then invite them to a party." />
          <Row k="04 · CLAIM GROUND" v="Own a BITMAP and your land appears marked in the world, ready to build on or deploy to." />
          <Row k="05 · TUNE IT" v="If it stutters, drop graphics quality to Low. Nothing about the world changes except how much is drawn." />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">CONTROLS · KEYBOARD AND MOUSE</h2>
        <div className="mt-4 border border-border">
          {DESKTOP.map((r) => <Row key={r.k} {...r} />)}
        </div>
        <h2 className="display mt-8 border-b border-border pb-2 text-xl">CONTROLS · PHONE AND TABLET</h2>
        <div className="mt-4 border border-border">
          {TOUCH.map((r) => <Row key={r.k} {...r} />)}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Touch controls appear only on touch devices, and no control depends on hovering.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">WHAT LIVES IN THE OASIS</h2>
        <div className="mt-4 grid gap-px border border-border bg-border md:grid-cols-2">
          {WORLD.map((w) => (
            <div key={w.title} className="bg-background p-5">
              <div className="display text-base">{w.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">GRAPHICS QUALITY</h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The quality control sits in the world HUD next to the map and chat buttons. Your choice is remembered on
          this device. If the frame rate drops, the world quietly lowers its resolution and raises it again when
          there is headroom.
        </p>
        <div className="mt-4 border border-border">
          {QUALITY.map((r) => <Row key={r.k} {...r} />)}
        </div>
        <div className="mt-4 border border-border p-5">
          <div className="display text-base">ADVANCED</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Open the advanced row to set resolution scale from 50% to 100%, view distance, shadows, owned-land glow,
            a 30 / 45 / 60 frame cap, and whether the world is allowed to adjust itself. Add{" "}
            <code className="font-mono text-xs" data-no-translate>?debug=1</code> to the world address for a small
            readout of frame rate, frame time, resolution and scene counts.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">EARNING AND TRADING</h2>
        <div className="mt-4 border border-border">
          <Row k="BIT" v="The in-world coin. It is earned through attention and activity, spent on leases and in-world goods, and never sold for Bitcoin by us." />
          <Row k="BITMAP MARKET" v="Buy and sell real BITMAP land. Offers are signed with your wallet and settle on Bitcoin, not on our server." />
          <Row k="LEASES" v="Rent build rights on land you do not own, priced per day in BIT. The deed never moves." />
          <Row k="TRADING POST" v="Swap in-world items and goods with other players from inside the Oasis." />
          <Row k="COLLECTIONS" v="Punk and club collections are derived from block shape and transaction counts, never from a hand-written list." />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/coins" className="btn-term-ghost">[ BIT ]</Link>
          <Link to="/leases" className="btn-term-ghost">[ LEASES ]</Link>
          <Link to="/trading-post" className="btn-term-ghost">[ TRADING POST ]</Link>
          <Link to="/collections" className="btn-term-ghost">[ COLLECTIONS ]</Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display border-b border-border pb-2 text-xl">STREAMING AND LANGUAGES</h2>
        <div className="mt-4 border border-border">
          <Row k="STREAMING" v="Capture the browser window or tab in OBS and send it to Kick, Twitch or TikTok. Use Medium or High on desktop and cap frames at 60 so encoding stays smooth." />
          <Row k="LANGUAGES" v="The site translates itself into Greek, Spanish, German, Russian and Hindi. Block numbers, addresses and inscription ids always stay untranslated." />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link to="/oasis" className="btn-term">[ PLAY NOW ]</Link>
        <Link to="/sdk" className="btn-term-ghost">[ BUILD SOMETHING ]</Link>
      </div>
      <GuideTrail current="/play-guide" />
    </div>
  );
}
