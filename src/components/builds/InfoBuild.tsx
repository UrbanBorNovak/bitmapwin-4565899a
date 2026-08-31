import type { InfoConfig } from "@/lib/build-sdk";

export function InfoBuild({ config }: { config: InfoConfig }) {
  const empty = !config.headline && config.fields.length === 0 && config.links.length === 0;
  if (empty) return null;
  return (
    <div className="space-y-4">
      {config.headline ? <p className="display text-lg">{config.headline}</p> : null}
      {config.fields.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {config.fields.map((f, i) => (
            <div key={`${f.label}-${i}`} className="rounded-md border border-border px-3 py-2">
              <dt className="label">{f.label.toUpperCase()}</dt>
              <dd className="mt-1 font-mono text-xs break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {config.links.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {config.links.map((l, i) => (
            <li key={`${l.url}-${i}`}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer nofollow"
                className="btn-term-ghost inline-block"
              >
                [ {(l.label || l.url).toUpperCase()} ]
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
