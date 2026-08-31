import {
  BUILD_KINDS,
  BUILD_KIND_HINTS,
  BUILD_KIND_LABELS,
  DEFAULT_CONFIGS,
  parseBuildConfig,
  presetsForKind,
  type BuildKind,
  type Game2dConfig,
  type Game3dConfig,
  type GalleryConfig,
  type InfoConfig,
} from "@/lib/build-sdk";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary";

/**
 * The SDK's authoring surface: pick a build kind, then edit the typed config for
 * that kind. Any config produced here round-trips through `parseBuildConfig`.
 */
export function BuildEditor({
  kind,
  config,
  onKindChange,
  onConfigChange,
}: {
  kind: BuildKind;
  config: unknown;
  onKindChange: (kind: BuildKind) => void;
  onConfigChange: (config: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <span className="label">BUILD TYPE</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {BUILD_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onKindChange(k);
                onConfigChange(DEFAULT_CONFIGS[k]);
              }}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                kind === k ? "border-primary bg-card" : "border-border hover:border-primary"
              }`}
            >
              <span className="display block text-xs">{BUILD_KIND_LABELS[k]}</span>
              <span className="label mt-1 block text-muted-foreground">{BUILD_KIND_HINTS[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {kind === "info" ? (
        <InfoEditor
          config={parseBuildConfig("info", config)}
          onChange={onConfigChange}
        />
      ) : kind === "gallery" ? (
        <GalleryEditor config={parseBuildConfig("gallery", config)} onChange={onConfigChange} />
      ) : kind === "game3d" ? (
        <Game3dEditor config={parseBuildConfig("game3d", config)} onChange={onConfigChange} />
      ) : (
        <Game2dEditor config={parseBuildConfig("game2d", config)} onChange={onConfigChange} />
      )}
    </div>
  );
}

function InfoEditor({
  config,
  onChange,
}: {
  config: InfoConfig;
  onChange: (c: InfoConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">HEADLINE</span>
        <input
          className={`mt-1 ${input}`}
          value={config.headline}
          placeholder="BITCOIN BUILDER, ORDINALS MAXI"
          onChange={(e) => onChange({ ...config, headline: e.target.value.slice(0, 120) })}
        />
      </label>

      <div>
        <span className="label">INFO FIELDS</span>
        {config.fields.map((f, i) => (
          <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              className={input}
              placeholder="LABEL"
              value={f.label}
              onChange={(e) => {
                const fields = [...config.fields];
                fields[i] = { ...f, label: e.target.value.slice(0, 40) };
                onChange({ ...config, fields });
              }}
            />
            <input
              className={input}
              placeholder="VALUE"
              value={f.value}
              onChange={(e) => {
                const fields = [...config.fields];
                fields[i] = { ...f, value: e.target.value.slice(0, 200) };
                onChange({ ...config, fields });
              }}
            />
            <button
              className="btn-term-ghost"
              type="button"
              onClick={() => onChange({ ...config, fields: config.fields.filter((_, x) => x !== i) })}
            >
              [ X ]
            </button>
          </div>
        ))}
        {config.fields.length < 12 ? (
          <button
            type="button"
            className="btn-term-ghost mt-2"
            onClick={() => onChange({ ...config, fields: [...config.fields, { label: "", value: "" }] })}
          >
            [ + FIELD ]
          </button>
        ) : null}
      </div>

      <div>
        <span className="label">LINKS</span>
        {config.links.map((l, i) => (
          <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              className={input}
              placeholder="LABEL"
              value={l.label}
              onChange={(e) => {
                const links = [...config.links];
                links[i] = { ...l, label: e.target.value.slice(0, 40) };
                onChange({ ...config, links });
              }}
            />
            <input
              className={input}
              placeholder="https://"
              value={l.url}
              onChange={(e) => {
                const links = [...config.links];
                links[i] = { ...l, url: e.target.value.slice(0, 300) };
                onChange({ ...config, links });
              }}
            />
            <button
              className="btn-term-ghost"
              type="button"
              onClick={() => onChange({ ...config, links: config.links.filter((_, x) => x !== i) })}
            >
              [ X ]
            </button>
          </div>
        ))}
        {config.links.length < 12 ? (
          <button
            type="button"
            className="btn-term-ghost mt-2"
            onClick={() => onChange({ ...config, links: [...config.links, { label: "", url: "" }] })}
          >
            [ + LINK ]
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GalleryEditor({
  config,
  onChange,
}: {
  config: GalleryConfig;
  onChange: (c: GalleryConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">COLUMNS</span>
        <select
          className={`mt-1 ${input}`}
          value={config.columns}
          onChange={(e) => onChange({ ...config, columns: Number(e.target.value) as 2 | 3 | 4 })}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <div>
        <span className="label">INSCRIPTIONS TO SHOWCASE</span>
        {config.items.map((item, i) => (
          <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <input
              className={input}
              placeholder="<txid>i0"
              value={item.inscriptionId}
              onChange={(e) => {
                const items = [...config.items];
                items[i] = { ...item, inscriptionId: e.target.value.trim().slice(0, 120) };
                onChange({ ...config, items });
              }}
            />
            <input
              className={input}
              placeholder="CAPTION"
              value={item.caption}
              onChange={(e) => {
                const items = [...config.items];
                items[i] = { ...item, caption: e.target.value.slice(0, 80) };
                onChange({ ...config, items });
              }}
            />
            <button
              className="btn-term-ghost"
              type="button"
              onClick={() => onChange({ ...config, items: config.items.filter((_, x) => x !== i) })}
            >
              [ X ]
            </button>
          </div>
        ))}
        {config.items.length < 48 ? (
          <button
            type="button"
            className="btn-term-ghost mt-2"
            onClick={() =>
              onChange({ ...config, items: [...config.items, { inscriptionId: "", caption: "" }] })
            }
          >
            [ + INSCRIPTION ]
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Game3dEditor({
  config,
  onChange,
}: {
  config: Game3dConfig;
  onChange: (c: Game3dConfig) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">WORLD NAME</span>
        <input
          className={`mt-1 ${input}`}
          value={config.worldName}
          onChange={(e) => onChange({ ...config, worldName: e.target.value.slice(0, 60) })}
        />
      </label>
      <label className="block">
        <span className="label">TOWERS ({config.towers})</span>
        <input
          type="range"
          min={4}
          max={64}
          value={config.towers}
          className="mt-3 w-full accent-primary"
          onChange={(e) => onChange({ ...config, towers: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        <span className="label">ACCENT</span>
        <input
          type="color"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background"
          value={config.accent}
          onChange={(e) => onChange({ ...config, accent: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 pt-6">
        <input
          type="checkbox"
          checked={config.spin}
          className="accent-primary"
          onChange={(e) => onChange({ ...config, spin: e.target.checked })}
        />
        <span className="label">AUTO ORBIT</span>
      </label>
    </div>
  );
}

function Game2dEditor({
  config,
  onChange,
}: {
  config: Game2dConfig;
  onChange: (c: Game2dConfig) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">GAME TITLE</span>
        <input
          className={`mt-1 ${input}`}
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value.slice(0, 60) })}
        />
      </label>
      <label className="block">
        <span className="label">COINS ({config.coins})</span>
        <input
          type="range"
          min={3}
          max={40}
          value={config.coins}
          className="mt-3 w-full accent-primary"
          onChange={(e) => onChange({ ...config, coins: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        <span className="label">WALL DENSITY ({config.walls}%)</span>
        <input
          type="range"
          min={0}
          max={60}
          value={config.walls}
          className="mt-3 w-full accent-primary"
          onChange={(e) => onChange({ ...config, walls: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        <span className="label">SPEED ({config.speed})</span>
        <input
          type="range"
          min={1}
          max={10}
          value={config.speed}
          className="mt-3 w-full accent-primary"
          onChange={(e) => onChange({ ...config, speed: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
