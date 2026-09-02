import { themePanelStyle, themeShellStyle, type InfoConfig } from "@/lib/build-sdk";
import { safeExternalUrl } from "@/lib/safe-url";

export function InfoBuild({ config }: { config: InfoConfig }) {
  const empty =
    !config.headline && !config.subline && config.fields.length === 0 && config.links.length === 0;
  if (empty) return null;
  const theme = config.theme;
  return (
    <div className="space-y-4 border p-5" style={themeShellStyle(theme)}>
      {config.headline ? (
        <p className="display text-lg" style={{ color: theme.accent }}>
          {config.headline}
        </p>
      ) : null}
      {theme.rules ? (
        <hr className="border-0" style={{ height: "1px", background: `${theme.accent}55` }} />
      ) : null}
      {config.subline ? (
        <p className="max-w-[62ch] font-mono text-sm whitespace-pre-wrap opacity-80">
          {config.subline}
        </p>
      ) : null}
      {config.fields.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {config.fields.map((f, i) => (
            <div
              key={`${f.label}-${i}`}
              className="border px-3 py-2"
              style={themePanelStyle(theme)}
            >
              <dt className="label" style={{ color: theme.accent }}>
                {f.label.toUpperCase()}
              </dt>
              <dd className="mt-1 font-mono text-xs break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {config.links.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {config.links.filter((l) => safeExternalUrl(l.url)).map((l, i) => (
            <li key={`${l.url}-${i}`}>
              <a
                href={safeExternalUrl(l.url)!}
                target="_blank"
                rel="noreferrer nofollow"
                className="inline-block border px-3 py-1.5 font-mono text-xs transition-opacity hover:opacity-70"
                style={{ ...themePanelStyle(theme), color: theme.accent }}
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
