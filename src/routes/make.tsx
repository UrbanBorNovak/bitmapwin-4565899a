import { createFileRoute, Link } from "@tanstack/react-router";
import { ExperienceFlow } from "@/components/studio/ExperienceFlow";

export const Route = createFileRoute("/make")({
  head: () => {
    const title = "Make an Experience — Describe, Test, Publish, Deploy | BITMAPWIN Studio";
    const description =
      "One path from idea to a live place on your BITMAP: describe it in plain words, edit and test it, publish it, then deploy it on land you hold.";
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
  component: MakePage,
});

const STEPS = [
  { n: "1", title: "DESCRIBE", body: "Say what should stand on your tile. AI writes working world code you can keep or change.", link: <Link to="/create" className="btn-term w-full justify-center">[ DESCRIBE A PLACE ]</Link> },
  { n: "2", title: "EDIT & TEST", body: "Open it in the Extender Studio: blueprint editor or code, run on a test tile in the same sandbox the world uses.", link: <Link to="/studio" search={{ tool: "extenders" }} className="btn-term-ghost w-full justify-center">[ OPEN EDITOR ]</Link> },
  { n: "3", title: "PUBLISH", body: "Publish a version to the public registry under your account. Unpublish any time.", link: <Link to="/studio" search={{ tool: "extenders" }} className="btn-term-ghost w-full justify-center">[ MY EXTENDERS ]</Link> },
  { n: "4", title: "DEPLOY", body: "Put it on a BITMAP you hold. Ownership is checked live on Bitcoin before it goes up.", link: <Link to="/extend" className="btn-term-ghost w-full justify-center">[ DEPLOY ON LAND ]</Link> },
];

function MakePage() {
  return (
    <div className="mx-auto max-w-[1300px] px-4 py-10 md:px-8 md:py-14">
      <ExperienceFlow current="describe" />
      <div className="label text-bitcoin">STUDIO · EXPERIENCES</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">MAKE AN EXPERIENCE</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Four steps from an idea to a live place on your land. Each step is its own page, so you can jump in anywhere —
        already have code? Start at step 2.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="flex flex-col border border-border bg-surface p-5">
            <span className="font-mono text-[10px] text-signal" data-no-translate>STEP {s.n}</span>
            <h2 className="display mt-2 text-xl">{s.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            <div className="mt-4">{s.link}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Link to="/sdk" className="border border-border bg-surface p-4 hover:border-bitcoin"><div className="label">SDK GUIDE</div><p className="mt-2 text-sm text-muted-foreground">Every world call, limit and permission.</p></Link>
        <Link to="/sdk-playground" className="border border-border bg-surface p-4 hover:border-bitcoin"><div className="label">PLAYGROUND</div><p className="mt-2 text-sm text-muted-foreground">Run code live without creating anything.</p></Link>
        <Link to="/extenders" className="border border-border bg-surface p-4 hover:border-bitcoin"><div className="label">PUBLISHED EXTENDERS</div><p className="mt-2 text-sm text-muted-foreground">Deploy something someone else already built.</p></Link>
      </div>
    </div>
  );
}
