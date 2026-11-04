import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { walletQuery } from "@/lib/wallet";
import { inscriptionOffersQuery } from "@/lib/offers";
import { ShopListButton } from "@/components/builds/ShopListButton";
import { inscriptionImageUrl } from "@/lib/profiles";
import { formatSats } from "@/lib/trades";
import { BuildRenderer } from "@/components/builds/BuildRenderer";
import {
  ART_PALETTES,
  BUILD_FRAMES,
  BUILD_FRAME_LABELS,
  BUILD_KINDS,
  BUILD_KIND_HINTS,
  BUILD_KIND_LABELS,
  BUILD_SURFACES,
  BUILD_SURFACE_LABELS,
  DEFAULT_CONFIGS,
  parseBuildConfig,
  presetsForKind,
  GAME3D_SCENES,
  GAME3D_SCENE_LABELS,
  ONCHAIN_ASSETS,
  AVATAR_SKINS,
  AVATAR_RIG_ID,
  type BuildFrame,
  type BuildKind,
  type BuildSurface,
  type BuildTheme,
  type Game3dModel,
  type Game2dConfig,
  type Game3dConfig,
  type GalleryConfig,
  type InfoConfig,
  type MyspaceConfig,
  MYSPACE_SKINS,
  MYSPACE_SKIN_LABELS,
  type MyspaceSkin,
  type ShopConfig,
  type ShopItem,
} from "@/lib/build-sdk";


const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary";

/** Numbered step wrapper — makes the whole flow readable at a glance. */
function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-border px-3 py-2">
        <span className="display text-xs text-primary">{String(n).padStart(2, "0")}</span>
        <span className="display text-xs">{title}</span>
        <span className="label text-muted-foreground">{hint}</span>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Collapsed drawer for power-user fields, so step 3 never looks scary. */
function Advanced({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-dashed border-border">
      <summary className="label cursor-pointer list-none px-3 py-2 hover:text-foreground">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span> {title}
      </summary>
      <div className="space-y-3 border-t border-border p-3">{children}</div>
    </details>
  );
}

/**
 * One-click artistic palettes. Works for every kind because it only writes the
 * fields that kind understands (theme, or accent/ground for worlds and shops).
 */
function PaletteStrip({
  activeAccent,
  onPick,
}: {
  activeAccent: string;
  onPick: (palette: (typeof ART_PALETTES)[number]) => void;
}) {
  return (
    <div>
      <span className="label">ARTIST PALETTES</span>
      <p className="label mt-1 text-muted-foreground">
        ONE CLICK RE-COLOURS THE WHOLE BUILD — TWEAK THE EXACT COLOURS BELOW.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ART_PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.name}
            onClick={() => onPick(p)}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
              activeAccent.toLowerCase() === p.accent.toLowerCase()
                ? "border-primary"
                : "border-border hover:border-primary"
            }`}
          >
            <span className="flex">
              <span className="h-4 w-4 rounded-l-sm" style={{ background: p.ground }} />
              <span className="h-4 w-4 rounded-r-sm" style={{ background: p.accent }} />
            </span>
            <span className="label">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The shared artistic controls for flat builds: colour, surface, frame, glow. */
function ThemeEditor({
  theme,
  onChange,
}: {
  theme: BuildTheme;
  onChange: (t: BuildTheme) => void;
}) {
  return (
    <div className="space-y-3">
      <PaletteStrip
        activeAccent={theme.accent}
        onPick={(p) => onChange({ ...theme, accent: p.accent, surface: p.surface })}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">ACCENT COLOUR</span>
          <input
            type="color"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background"
            value={theme.accent}
            onChange={(e) => onChange({ ...theme, accent: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">SURFACE</span>
          <select
            className={`mt-1 ${input}`}
            value={theme.surface}
            onChange={(e) => onChange({ ...theme, surface: e.target.value as BuildSurface })}
          >
            {BUILD_SURFACES.map((s) => (
              <option key={s} value={s}>
                {BUILD_SURFACE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">FRAMES</span>
          <select
            className={`mt-1 ${input}`}
            value={theme.frame}
            onChange={(e) => onChange({ ...theme, frame: e.target.value as BuildFrame })}
          >
            {BUILD_FRAMES.map((f) => (
              <option key={f} value={f}>
                {BUILD_FRAME_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={theme.glow}
            onChange={(e) => onChange({ ...theme, glow: e.target.checked })}
          />
          <span className="label">ACCENT GLOW</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={theme.rules}
            onChange={(e) => onChange({ ...theme, rules: e.target.checked })}
          />
          <span className="label">ACCENT RULE LINES</span>
        </label>
      </div>
    </div>
  );
}

/**
 * The SDK's authoring surface: a three-step flow (what → starting point → make
 * it yours) with a live preview pinned on top. Any config produced here
 * round-trips through `parseBuildConfig`.
 */
export function BuildEditor({
  kind,
  config,
  onKindChange,
  onConfigChange,
  walletAddress,
  height,
}: {
  kind: BuildKind;
  config: unknown;
  onKindChange: (kind: BuildKind) => void;
  onConfigChange: (config: unknown) => void;
  /** Address whose inscriptions can be imported into an asset shop. */
  walletAddress?: string | null;
  /** Block height this build sits on — used for the live preview seed. */
  height?: number;
}) {
  return (
    <div className="space-y-4">
      {typeof height === "number" ? (
        <div className="sticky top-2 z-20 rounded-md border border-primary/60 bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
            <span className="label text-primary">LIVE PREVIEW — {height}.BITMAP</span>
            <span className="label text-muted-foreground">
              UPDATES AS YOU TYPE · EXACTLY WHAT VISITORS SEE
            </span>
          </div>
          <div className="max-h-[46vh] overflow-auto p-3">
            <BuildRenderer kind={kind} config={config} height={height} />
          </div>
        </div>
      ) : null}

      <Step n={1} title="WHAT ARE YOU BUILDING?" hint="SWITCH ANY TIME — NOTHING IS PERMANENT">
        <div className="grid gap-2 sm:grid-cols-2">
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
              <span className="display block text-xs">
                {kind === k ? "▸ " : ""}
                {BUILD_KIND_LABELS[k]}
              </span>
              <span className="label mt-1 block text-muted-foreground">{BUILD_KIND_HINTS[k]}</span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="PICK A STARTING POINT" hint="A FINISHED LOOK IN ONE CLICK">
        <div className="grid gap-2 sm:grid-cols-2">
          {presetsForKind(kind).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onConfigChange(preset.config)}
              className="rounded-md border border-border px-3 py-2 text-left transition-colors hover:border-primary"
            >
              <span className="display block text-xs">[ {preset.name} ]</span>
              <span className="label mt-1 block text-muted-foreground">{preset.blurb}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onConfigChange(DEFAULT_CONFIGS[kind])}
            className="rounded-md border border-dashed border-border px-3 py-2 text-left transition-colors hover:border-primary"
          >
            <span className="display block text-xs">[ BLANK CANVAS ]</span>
            <span className="label mt-1 block text-muted-foreground">START EMPTY AND BUILD IT YOURSELF</span>
          </button>
        </div>
      </Step>

      <Step n={3} title="MAKE IT YOURS" hint="EVERY FIELD, COLOUR AND FRAME IS YOURS TO BEND">
        {kind === "info" ? (
          <InfoEditor config={parseBuildConfig("info", config)} onChange={onConfigChange} />
        ) : kind === "shop" ? (
          <ShopEditor
            config={parseBuildConfig("shop", config)}
            onChange={onConfigChange}
            walletAddress={walletAddress ?? null}
          />
        ) : kind === "gallery" ? (
          <GalleryEditor config={parseBuildConfig("gallery", config)} onChange={onConfigChange} />
        ) : kind === "myspace" ? (
          <MyspaceEditor config={parseBuildConfig("myspace", config)} onChange={onConfigChange} />
        ) : kind === "game3d" ? (
          <Game3dEditor config={parseBuildConfig("game3d", config)} onChange={onConfigChange} />
        ) : (
          <Game2dEditor config={parseBuildConfig("game2d", config)} onChange={onConfigChange} />
        )}
      </Step>
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

      <label className="block">
        <span className="label">SUBLINE / MANIFESTO</span>
        <textarea
          className={`mt-1 h-20 resize-none ${input}`}
          value={config.subline}
          placeholder="ONE OR TWO LINES ABOUT THIS PLACE"
          onChange={(e) => onChange({ ...config, subline: e.target.value.slice(0, 240) })}
        />
      </label>

      <ThemeEditor theme={config.theme} onChange={(theme) => onChange({ ...config, theme })} />

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
      <div className="grid gap-3 sm:grid-cols-2">
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
        <label className="block">
          <span className="label">IMAGE FIT</span>
          <select
            className={`mt-1 ${input}`}
            value={config.fit}
            onChange={(e) =>
              onChange({ ...config, fit: e.target.value === "cover" ? "cover" : "contain" })
            }
          >
            <option value="contain">CONTAIN — SHOW THE WHOLE ARTWORK</option>
            <option value="cover">COVER — CROP TO FILL THE FRAME</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-primary"
          checked={config.monochrome}
          onChange={(e) => onChange({ ...config, monochrome: e.target.checked })}
        />
        <span className="label">GRAYSCALE UNTIL HOVER (MUSEUM MODE)</span>
      </label>

      <ThemeEditor theme={config.theme} onChange={(theme) => onChange({ ...config, theme })} />

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
  const setModel = (index: number, patch: Partial<Game3dModel>) => {
    const models = [...config.models];
    const current = models[index];
    if (!current) return;
    models[index] = { ...current, ...patch };
    onChange({ ...config, models });
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="label">WORLD STYLE</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {GAME3D_SCENES.map((scene) => (
            <button
              key={scene}
              type="button"
              onClick={() => onChange({ ...config, scene })}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                config.scene === scene ? "border-primary bg-card" : "border-border hover:border-primary"
              }`}
            >
              <span className="display block text-xs">{GAME3D_SCENE_LABELS[scene]}</span>
            </button>
          ))}
        </div>
      </div>

      <PaletteStrip
        activeAccent={config.accent}
        onPick={(p) => onChange({ ...config, accent: p.accent, ground: p.ground })}
      />

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
          <span className="label">STRUCTURES ({config.towers})</span>
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
        <label className="block">
          <span className="label">GROUND / SKY</span>
          <input
            type="color"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background"
            value={config.ground}
            onChange={(e) => onChange({ ...config, ground: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.spin}
              className="accent-primary"
              onChange={(e) => onChange({ ...config, spin: e.target.checked })}
            />
            <span className="label">AUTO ORBIT</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.grid}
              className="accent-primary"
              onChange={(e) => onChange({ ...config, grid: e.target.checked })}
            />
            <span className="label">GRID</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.fog}
              className="accent-primary"
              onChange={(e) => onChange({ ...config, fog: e.target.checked })}
            />
            <span className="label">FOG</span>
          </label>
        </div>
      </div>

      <div>
        <span className="label">ON-CHAIN ASSET LIBRARY</span>
        <p className="label mt-1 text-muted-foreground">
          READY-MADE GLB MODELS LIVING ON BITCOIN — CLICK TO DROP ONE INTO YOUR WORLD.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ONCHAIN_ASSETS.map((asset) => {
            const count = config.models.filter(
              (m) => m.inscriptionId === asset.inscriptionId,
            ).length;
            // Skinnable avatars can be placed more than once, each with its own skin.
            const used = count > 0 && !asset.skinnable;
            const full = config.models.length >= 6;
            return (
              <button
                key={asset.inscriptionId}
                type="button"
                disabled={used || full}
                onClick={() =>
                  onChange({
                    ...config,
                    models: [
                      ...config.models,
                      {
                        inscriptionId: asset.inscriptionId,
                        label: asset.skinnable
                          ? `${asset.label} ${count + 1}`.slice(0, 60)
                          : asset.label,
                        scale: asset.scale,
                        height: asset.height,
                        spin: false,
                        textureId: asset.skinnable
                          ? (AVATAR_SKINS[count % AVATAR_SKINS.length]?.inscriptionId ?? "")
                          : "",
                      },
                    ],
                  })
                }
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  used
                    ? "border-primary bg-card opacity-60"
                    : full
                      ? "border-border opacity-40"
                      : "border-border hover:border-primary"
                }`}
              >
                <span className="display block text-xs">{asset.label}</span>
                <span className="label block text-muted-foreground">
                  {used ? "IN WORLD" : asset.skinnable && count > 0 ? `×${count} — ADD MORE` : asset.group}
                </span>
                {asset.note ? (
                  <span className="label mt-1 block text-muted-foreground">{asset.note}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">ON-CHAIN 3D MODELS (GLB / GLTF INSCRIPTIONS)</span>
        <p className="label mt-1 text-muted-foreground">
          PASTE AN INSCRIPTION ID THAT HOLDS A .GLB MODEL — IT LOADS STRAIGHT FROM{" "}
          <a
            href="https://ordinals.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            ORDINALS.COM
          </a>
          . UP TO 6 MODELS.
        </p>
        {config.models.map((model, i) => (
          <div key={i} className="mt-2 space-y-2 rounded-md border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <input
                className={input}
                placeholder="<txid>i0"
                value={model.inscriptionId}
                onChange={(e) => setModel(i, { inscriptionId: e.target.value.trim().slice(0, 120) })}
              />
              <input
                className={input}
                placeholder="LABEL"
                value={model.label}
                onChange={(e) => setModel(i, { label: e.target.value.slice(0, 60) })}
              />
              <button
                className="btn-term-ghost"
                type="button"
                onClick={() => onChange({ ...config, models: config.models.filter((_, x) => x !== i) })}
              >
                [ X ]
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="label">SCALE ({model.scale.toFixed(1)}×)</span>
                <input
                  type="range"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={model.scale}
                  className="mt-2 w-full accent-primary"
                  onChange={(e) => setModel(i, { scale: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="label">HEIGHT ({model.height})</span>
                <input
                  type="range"
                  min={-5}
                  max={20}
                  value={model.height}
                  className="mt-2 w-full accent-primary"
                  onChange={(e) => setModel(i, { height: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={model.spin}
                  className="accent-primary"
                  onChange={(e) => setModel(i, { spin: e.target.checked })}
                />
                <span className="label">ROTATE MODEL</span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <label className="block">
                <span className="label">
                  {model.inscriptionId === AVATAR_RIG_ID ? "AVATAR SKIN" : "TEXTURE SKIN"}
                </span>
                <select
                  className={`mt-1 ${input}`}
                  value={
                    AVATAR_SKINS.some((s) => s.inscriptionId === model.textureId)
                      ? model.textureId
                      : model.textureId
                        ? "custom"
                        : ""
                  }
                  onChange={(e) => {
                    if (e.target.value === "custom") return;
                    setModel(i, { textureId: e.target.value });
                  }}
                >
                  <option value="">MODEL'S OWN TEXTURE</option>
                  {AVATAR_SKINS.map((skin) => (
                    <option key={skin.inscriptionId} value={skin.inscriptionId}>
                      {skin.label}
                    </option>
                  ))}
                  <option value="custom">CUSTOM INSCRIPTION →</option>
                </select>
              </label>
              <label className="block">
                <span className="label">OR PASTE A TEXTURE INSCRIPTION ID</span>
                <input
                  className={`mt-1 ${input}`}
                  placeholder="<txid>i0"
                  value={model.textureId ?? ""}
                  onChange={(e) => setModel(i, { textureId: e.target.value.trim().slice(0, 120) })}
                />
              </label>
            </div>
          </div>
        ))}
        {config.models.length < 6 ? (
          <button
            type="button"
            className="btn-term-ghost mt-2"
            onClick={() =>
              onChange({
                ...config,
                models: [
                  ...config.models,
                  { inscriptionId: "", label: "", scale: 1, height: 0, spin: false },
                ],
              })
            }
          >
            [ + ON-CHAIN MODEL ]
          </button>
        ) : null}
      </div>
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

/**
 * Asset-shop authoring: pull the real inscriptions held by the seller's address
 * and price each one. Style (accent, layout, frame) is fully adaptable, so every
 * shop built from the same preset can still look like its owner's.
 */
function ShopEditor({
  config,
  onChange,
  walletAddress,
}: {
  config: ShopConfig;
  onChange: (c: ShopConfig) => void;
  walletAddress: string | null;
}) {
  const wallet = useQuery({
    ...walletQuery(walletAddress ?? ""),
    enabled: Boolean(walletAddress),
  });

  const held = (wallet.data?.utxos ?? []).flatMap((u) => u.inscriptions);
  const listed = new Set(config.items.map((i) => i.inscriptionId));
  const shopIds = config.items.map((i) => i.inscriptionId).filter(Boolean);
  const offers = useQuery({ ...inscriptionOffersQuery(shopIds), enabled: shopIds.length > 0 });
  const hasOffer = (id: string) => (offers.data ?? []).some((o) => o.inscriptionId === id);
  const importable = held.filter((i) => !listed.has(i.id));

  const setItem = (index: number, patch: Partial<ShopItem>) => {
    const items = [...config.items];
    const current = items[index];
    if (!current) return;
    items[index] = { ...current, ...patch };
    onChange({ ...config, items });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="label">SHOP NAME</span>
          <input
            className={`mt-1 ${input}`}
            value={config.shopName}
            placeholder="MY SHOP"
            onChange={(e) => onChange({ ...config, shopName: e.target.value.slice(0, 60) })}
          />
        </label>
        <label className="block">
          <span className="label">TAGLINE</span>
          <input
            className={`mt-1 ${input}`}
            value={config.tagline}
            placeholder="ON-CHAIN ASSETS, PRICED IN SATS"
            onChange={(e) => onChange({ ...config, tagline: e.target.value.slice(0, 140) })}
          />
        </label>
        <label className="block">
          <span className="label">CONTACT LINK (WHERE BUYERS REACH YOU)</span>
          <input
            className={`mt-1 ${input}`}
            value={config.contactUrl}
            placeholder="https://x.com/you"
            onChange={(e) => onChange({ ...config, contactUrl: e.target.value.trim().slice(0, 300) })}
          />
        </label>
        <label className="block">
          <span className="label">CONTACT BUTTON LABEL</span>
          <input
            className={`mt-1 ${input}`}
            value={config.contactLabel}
            placeholder="DM TO BUY"
            onChange={(e) => onChange({ ...config, contactLabel: e.target.value.slice(0, 40) })}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="label">LAYOUT</span>
          <select
            className={`mt-1 ${input}`}
            value={config.layout}
            onChange={(e) => onChange({ ...config, layout: e.target.value === "list" ? "list" : "grid" })}
          >
            <option value="grid">GRID</option>
            <option value="list">PRICE LIST</option>
          </select>
        </label>
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
        <label className="block">
          <span className="label">FRAMES</span>
          <select
            className={`mt-1 ${input}`}
            value={config.frame}
            onChange={(e) => onChange({ ...config, frame: e.target.value === "soft" ? "soft" : "sharp" })}
          >
            <option value="sharp">SHARP</option>
            <option value="soft">SOFT</option>
          </select>
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
      </div>

      <PaletteStrip
        activeAccent={config.accent}
        onPick={(p) => onChange({ ...config, accent: p.accent })}
      />

      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">MY WALLET ASSETS</span>
          <span className="label text-muted-foreground">
            {!walletAddress
              ? "NO ADDRESS — CONNECT YOUR WALLET"
              : wallet.isLoading
                ? "SCANNING…"
                : `${importable.length} IMPORTABLE / ${held.length} HELD`}
          </span>
        </div>
        {wallet.isError ? (
          <p className="label mt-2 text-muted-foreground">
            &gt; {(wallet.error as Error).message.toUpperCase()}
          </p>
        ) : null}
        {importable.length > 0 ? (
          <>
            <button
              type="button"
              className="btn-term-ghost mt-2"
              onClick={() =>
                onChange({
                  ...config,
                  items: [
                    ...config.items,
                    ...importable.slice(0, Math.max(0, 60 - config.items.length)).map((i) => ({
                      inscriptionId: i.id,
                      name: i.bitmapHeight !== null ? `${i.bitmapHeight}.BITMAP` : "",
                      priceSats: 0,
                      note: "",
                      sold: false,
                    })),
                  ],
                })
              }
            >
              [ IMPORT ALL ]
            </button>
            <div className="mt-2 grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {importable.slice(0, 24).map((i) => (
                <button
                  key={i.id}
                  type="button"
                  title={i.id}
                  className="border border-border p-1 text-left transition-colors hover:border-primary"
                  onClick={() =>
                    onChange({
                      ...config,
                      items: [
                        ...config.items,
                        {
                          inscriptionId: i.id,
                          name: i.bitmapHeight !== null ? `${i.bitmapHeight}.BITMAP` : "",
                          priceSats: 0,
                          note: "",
                          sold: false,
                        },
                      ].slice(0, 60),
                    })
                  }
                >
                  <img
                    src={inscriptionImageUrl(i.id)}
                    alt={i.id}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <span className="label mt-1 block truncate">
                    {i.bitmapHeight !== null ? `${i.bitmapHeight}.BITMAP` : i.id.slice(0, 8)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div>
        <span className="label">ASSETS FOR SALE — YOUR PRICE, IN SATS</span>
        {config.items.map((item, i) => (
          <div key={`${item.inscriptionId}-${i}`} className="mt-2 rounded-md border border-border p-2">
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <input
                className={input}
                placeholder="<txid>i0"
                value={item.inscriptionId}
                onChange={(e) => setItem(i, { inscriptionId: e.target.value.trim().slice(0, 120) })}
              />
              <input
                className={input}
                placeholder="NAME"
                value={item.name}
                onChange={(e) => setItem(i, { name: e.target.value.slice(0, 60) })}
              />
              <button
                type="button"
                className="btn-term-ghost"
                onClick={() => onChange({ ...config, items: config.items.filter((_, x) => x !== i) })}
              >
                [ X ]
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input
                className={input}
                type="number"
                min={0}
                placeholder="PRICE IN SATS (0 = MAKE OFFER)"
                value={item.priceSats || ""}
                onChange={(e) => setItem(i, { priceSats: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
              <input
                className={input}
                placeholder="NOTE (EDITION, RARITY, TERMS…)"
                value={item.note}
                onChange={(e) => setItem(i, { note: e.target.value.slice(0, 120) })}
              />
              <button
                type="button"
                className="btn-term-ghost"
                onClick={() => setItem(i, { sold: !item.sold })}
              >
                [ {item.sold ? "SOLD" : "FOR SALE"} ]
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label text-muted-foreground">
                {item.priceSats > 0 ? formatSats(item.priceSats) : "MAKE OFFER"}
              </span>
              {item.sold ? null : (
                <ShopListButton
                  inscriptionId={item.inscriptionId}
                  priceSats={item.priceSats}
                  alreadyListed={hasOffer(item.inscriptionId)}
                />
              )}
            </div>
          </div>
        ))}
        {config.items.length < 60 ? (
          <button
            type="button"
            className="btn-term-ghost mt-2"
            onClick={() =>
              onChange({
                ...config,
                items: [
                  ...config.items,
                  { inscriptionId: "", name: "", priceSats: 0, note: "", sold: false },
                ],
              })
            }
          >
            [ + ASSET ]
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MyspaceEditor({
  config,
  onChange,
}: {
  config: MyspaceConfig;
  onChange: (c: MyspaceConfig) => void;
}) {
  const text = (key: keyof MyspaceConfig, label: string, max: number, placeholder: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className={`mt-1 ${input}`}
        value={String(config[key])}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...config, [key]: e.target.value.slice(0, max) })}
      />
    </label>
  );
  const area = (key: keyof MyspaceConfig, label: string, max: number, placeholder: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        className={`mt-1 h-20 resize-none ${input}`}
        value={String(config[key])}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...config, [key]: e.target.value.slice(0, max) })}
      />
    </label>
  );
  const setFriend = (i: number, patch: Partial<{ height: number; nickname: string }>) =>
    onChange({ ...config, top8: config.top8.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">SKIN</span>
        <select
          className={`mt-1 ${input}`}
          value={config.skin}
          onChange={(e) => onChange({ ...config, skin: e.target.value as MyspaceSkin })}
        >
          {MYSPACE_SKINS.map((s) => (
            <option key={s} value={s}>{MYSPACE_SKIN_LABELS[s]}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("displayName", "DISPLAY NAME", 60, "LEAVE EMPTY TO SHOW <HEIGHT>.BITMAP")}
        {text("mood", "MOOD", 60, "STACKING SATS")}
        {text("quote", "QUOTE UNDER PICTURE", 140, "DON'T TRUST, VERIFY.")}
        {text("avatarInscriptionId", "PROFILE PICTURE — IMAGE INSCRIPTION ID", 120, "…i0")}
        {text("songTitle", "PROFILE SONG TITLE", 80, "GENESIS CHIPTUNE")}
        {text("songInscriptionId", "PROFILE SONG — AUDIO INSCRIPTION ID", 120, "…i0 (OPTIONAL)")}
      </div>
      {area("aboutMe", "ABOUT ME", 2000, "WHO YOU ARE, WHY THIS BLOCK")}
      {area("wantToMeet", "WHO I'D LIKE TO MEET", 2000, "BUILDERS, COLLECTORS, NEIGHBOURS")}
      {area("interests", "INTERESTS", 600, "ORDINALS, VOXELS, PIXEL ART")}
      <div>
        <span className="label">TOP 8 — BITMAPS YOU FEATURE ({config.top8.length}/8)</span>
        <div className="mt-2 space-y-2">
          {config.top8.map((f, i) => (
            <div key={i} className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
              <input
                type="number"
                min={0}
                className={input}
                value={f.height}
                aria-label={`Friend ${i + 1} block height`}
                onChange={(e) => setFriend(i, { height: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
              <input
                className={input}
                value={f.nickname}
                placeholder="NICKNAME"
                aria-label={`Friend ${i + 1} nickname`}
                onChange={(e) => setFriend(i, { nickname: e.target.value.slice(0, 24) })}
              />
              <button
                type="button"
                className="label border border-border px-2 hover:border-primary"
                onClick={() => onChange({ ...config, top8: config.top8.filter((_, j) => j !== i) })}
              >
                REMOVE
              </button>
            </div>
          ))}
          {config.top8.length < 8 ? (
            <button
              type="button"
              className="label rounded-md border border-dashed border-border px-3 py-2 hover:border-primary"
              onClick={() => onChange({ ...config, top8: [...config.top8, { height: 0, nickname: "" }] })}
            >
              + ADD FRIEND
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
