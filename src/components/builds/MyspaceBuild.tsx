import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import type { MyspaceConfig, MyspaceSkin } from "@/lib/build-sdk";
import { inscriptionImageUrl, viewStatsQuery } from "@/lib/profiles";

/**
 * Holder-authored 2006-style profile. Colours are part of the holder's build
 * content (like every build theme), so they are inline rather than site tokens.
 */
type Skin = {
  page: string;
  text: string;
  link: string;
  headBg: string;
  headText: string;
  box: string;
  border: string;
  orange: string;
  font: string;
};

const SKINS: Record<MyspaceSkin, Skin> = {
  classic: {
    page: "#e5e5e5",
    text: "#000000",
    link: "#003399",
    headBg: "#6698cb",
    headText: "#ffffff",
    box: "#ffffff",
    border: "#6698cb",
    orange: "#ff6600",
    font: "Verdana, Arial, sans-serif",
  },
  cyber: {
    page: "#05060a",
    text: "#d9f7ff",
    link: "#33e1ff",
    headBg: "#f7931a",
    headText: "#05060a",
    box: "#0d1118",
    border: "#f7931a",
    orange: "#f7931a",
    font: "'Space Mono', monospace",
  },
  glitter: {
    page: "#1a1206",
    text: "#fff5d6",
    link: "#ffd76a",
    headBg: "#c9a84c",
    headText: "#1a1206",
    box: "#2a1d0a",
    border: "#ffd76a",
    orange: "#ffb347",
    font: "Verdana, Arial, sans-serif",
  },
};

function Box({ title, skin, children }: { title: string; skin: Skin; children: ReactNode }) {
  return (
    <section style={{ border: `1px solid ${skin.border}`, background: skin.box }}>
      <h3
        style={{ background: skin.headBg, color: skin.headText }}
        className="px-2 py-1 text-xs font-bold"
      >
        {title}
      </h3>
      <div className="p-2 text-xs leading-relaxed">{children}</div>
    </section>
  );
}

export function MyspaceBuild({ config, height }: { config: MyspaceConfig; height: number }) {
  const skin = SKINS[config.skin];
  const stats = useQuery(viewStatsQuery(height));
  const name = config.displayName || `${height}.bitmap`;
  const glitter = config.skin === "glitter";
  const shell: CSSProperties = {
    background: skin.page,
    color: skin.text,
    fontFamily: skin.font,
    ...(glitter ? { boxShadow: `0 0 0 3px ${skin.border}, 0 0 24px ${skin.border}88` } : {}),
  };
  const linkStyle = { color: skin.link };
  const views = stats.data?.totalViews;

  return (
    <div className="p-3" style={shell}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* LEFT COLUMN */}
        <div className="space-y-3">
          <section style={{ border: `1px solid ${skin.border}`, background: skin.box }} className="p-2">
            <h2 className="text-lg font-bold break-words">{name}</h2>
            <div className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              {config.avatarInscriptionId ? (
                <img
                  src={inscriptionImageUrl(config.avatarInscriptionId)}
                  alt={`${name} profile picture`}
                  className="h-[110px] w-[110px] object-cover"
                  style={{ imageRendering: "pixelated", border: `1px solid ${skin.border}` }}
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-[110px] w-[110px] items-center justify-center text-center text-sm font-bold"
                  style={{ background: skin.headBg, color: skin.headText }}
                >
                  {height}
                  <br />
                  .bitmap
                </div>
              )}
              <div className="space-y-1 text-xs">
                {config.quote ? <p className="italic">"{config.quote}"</p> : null}
                <p>Bitcoin block {height.toLocaleString("en-US")}</p>
                {typeof views === "number" ? (
                  <p>
                    Profile views:{" "}
                    <span
                      className="px-1 font-mono"
                      style={{ background: "#000", color: "#33ff66" }}
                    >
                      {String(views).padStart(6, "0")}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
            {config.mood ? (
              <p className="mt-2 text-xs">
                <b>Mood:</b> {config.mood}
              </p>
            ) : null}
          </section>

          <Box title={`Contacting ${name}`} skin={skin}>
            <ul className="grid grid-cols-2 gap-1">
              <li><a href="#community" style={linkStyle}>✉ Sign Guestbook</a></li>
              <li><Link to="/oasis" style={linkStyle}>🌴 Visit in Oasis</Link></li>
              <li>
                <a href={`https://ordinals.com/search?query=${height}.bitmap`} target="_blank" rel="noreferrer" style={linkStyle}>
                  🔗 On-chain Proof
                </a>
              </li>
            </ul>
          </Box>

          {config.interests ? (
            <Box title={`${name}'s Interests`} skin={skin}>
              <p className="whitespace-pre-wrap">{config.interests}</p>
            </Box>
          ) : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3">
          <section style={{ border: `1px solid ${skin.border}`, background: skin.box }} className="p-3 text-center">
            <p className="text-sm font-bold">
              <span style={{ color: skin.orange }}>{name}</span> is in your extended network
            </p>
          </section>

          {config.songTitle || config.songInscriptionId ? (
            <Box title="♫ Profile Song" skin={skin}>
              {config.songTitle ? <p className="mb-1 font-bold">{config.songTitle}</p> : null}
              {config.songInscriptionId ? (
                <audio
                  controls
                  preload="none"
                  className="w-full"
                  src={inscriptionImageUrl(config.songInscriptionId)}
                />
              ) : null}
            </Box>
          ) : null}

          {config.aboutMe || config.wantToMeet ? (
            <Box title={`${name}'s Blurbs`} skin={skin}>
              {config.aboutMe ? (
                <>
                  <p className="font-bold" style={{ color: skin.orange }}>About me:</p>
                  <p className="mb-2 whitespace-pre-wrap">{config.aboutMe}</p>
                </>
              ) : null}
              {config.wantToMeet ? (
                <>
                  <p className="font-bold" style={{ color: skin.orange }}>Who I'd like to meet:</p>
                  <p className="whitespace-pre-wrap">{config.wantToMeet}</p>
                </>
              ) : null}
            </Box>
          ) : null}

          <Box title={`${name}'s Friend Space`} skin={skin}>
            <p className="mb-2 font-bold">
              {name} has <span style={{ color: skin.orange }}>{config.top8.length}</span> friends in the Top 8.
            </p>
            {config.top8.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {config.top8.map((f, i) => (
                  <Link
                    key={`${f.height}-${i}`}
                    to="/bitmap/$block"
                    params={{ block: String(f.height) }}
                    className="block text-center"
                    style={linkStyle}
                  >
                    <span className="block truncate text-[11px] underline">{f.nickname || `${f.height}.bitmap`}</span>
                    <span
                      className="mt-1 flex aspect-square items-center justify-center text-[11px] font-bold"
                      style={{ background: skin.headBg, color: skin.headText }}
                    >
                      {f.height}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="italic opacity-70">No friends picked yet.</p>
            )}
          </Box>

          <p className="text-center text-[11px] opacity-70">
            <a href="#community" style={linkStyle}>Leave a comment in {name}'s guestbook ↓</a>
          </p>
        </div>
      </div>
    </div>
  );
}
