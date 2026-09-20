import { useMemo, useState } from "react";
import {
  BLUEPRINT_GRID,
  BLUEPRINT_MAX_PIECES,
  BLUEPRINT_PIECES,
  blueprintSummary,
  pieceSpec,
  type Blueprint,
  type BlueprintPiece,
  type BlueprintPieceKind,
} from "@/lib/blueprint";

/**
 * BLUEPRINT EDITOR — draw a place on the 10x10 stride grid of one BITMAP tile.
 * Everything here edits a plain `Blueprint`; the Studio compiles it to SDK code.
 */

const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315];

function newId(kind: string): string {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BlueprintEditor({
  blueprint,
  onChange,
}: {
  blueprint: Blueprint;
  onChange: (next: Blueprint) => void;
}) {
  const [tool, setTool] = useState<BlueprintPieceKind | "erase">("floor");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [inscriptionId, setInscriptionId] = useState("");

  const cellIndex = useMemo(() => {
    const map = new Map<string, BlueprintPiece[]>();
    for (const piece of blueprint.pieces) {
      const key = `${piece.gx}:${piece.gz}`;
      map.set(key, [...(map.get(key) ?? []), piece]);
    }
    return map;
  }, [blueprint.pieces]);

  const selected = blueprint.pieces.find((p) => p.id === selectedId) ?? null;

  function update(next: Partial<Blueprint>) {
    onChange({ ...blueprint, ...next });
  }

  function paint(gx: number, gz: number) {
    const stack = cellIndex.get(`${gx}:${gz}`) ?? [];
    if (tool === "erase") {
      const top = stack[stack.length - 1];
      if (!top) return;
      update({ pieces: blueprint.pieces.filter((p) => p.id !== top.id) });
      if (selectedId === top.id) setSelectedId(null);
      return;
    }
    const existingSame = stack.find((p) => p.kind === tool);
    if (existingSame) {
      setSelectedId(existingSame.id);
      return;
    }
    if (blueprint.pieces.length >= BLUEPRINT_MAX_PIECES) return;
    const piece: BlueprintPiece = {
      id: newId(tool),
      kind: tool,
      gx,
      gz,
      rotationY: rotation,
      scale,
      color: null,
      label: null,
      inscriptionId: tool === "model" ? inscriptionId.trim() || null : null,
    };
    update({ pieces: [...blueprint.pieces, piece] });
    setSelectedId(piece.id);
  }

  function patchSelected(patch: Partial<BlueprintPiece>) {
    if (!selected) return;
    update({ pieces: blueprint.pieces.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)) });
  }

  const cells: { gx: number; gz: number }[] = [];
  for (let gz = 0; gz < BLUEPRINT_GRID; gz += 1) {
    for (let gx = 0; gx < BLUEPRINT_GRID; gx += 1) cells.push({ gx, gz });
  }

  return (
    <div className="border border-bitcoin/50 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label text-bitcoin">2 · DRAW THE BLUEPRINT</div>
        <span className="font-mono text-[10px] text-muted-foreground" data-no-translate>
          {blueprint.pieces.length} / {BLUEPRINT_MAX_PIECES} PIECES
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {BLUEPRINT_PIECES.map((spec) => (
          <button
            key={spec.kind}
            type="button"
            title={spec.note}
            onClick={() => setTool(spec.kind)}
            className={`flex items-center gap-1 border px-2 py-1.5 font-mono text-[10px] ${
              tool === spec.kind ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden data-no-translate>{spec.glyph}</span>
            {spec.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTool("erase")}
          className={`border px-2 py-1.5 font-mono text-[10px] ${
            tool === "erase" ? "border-destructive text-destructive" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          ✕ ERASE
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          FACING
          <select
            value={rotation}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRotation(next);
              if (selected) patchSelected({ rotationY: next });
            }}
            className="border border-border bg-background px-2 py-1 font-mono text-[10px] outline-none focus:border-bitcoin"
            data-no-translate
          >
            {ROTATIONS.map((r) => (
              <option key={r} value={r}>{r}°</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          SIZE
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={scale}
            onChange={(e) => {
              const next = Number(e.target.value);
              setScale(next);
              if (selected) patchSelected({ scale: next });
            }}
          />
          <span data-no-translate>{scale.toFixed(1)}×</span>
        </label>
        {tool === "model" ? (
          <input
            value={inscriptionId}
            onChange={(e) => setInscriptionId(e.target.value)}
            placeholder="Model inscription id"
            className="w-56 border border-border bg-background px-2 py-1 font-mono text-[10px] outline-none focus:border-bitcoin"
            data-no-translate
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            update({ pieces: [] });
            setSelectedId(null);
          }}
          className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          [ CLEAR PLAN ]
        </button>
      </div>

      <div className="mt-4 border border-border bg-background p-2">
        <svg viewBox={`0 0 ${BLUEPRINT_GRID} ${BLUEPRINT_GRID}`} className="h-auto w-full touch-manipulation">
          <rect x={0} y={0} width={BLUEPRINT_GRID} height={BLUEPRINT_GRID} fill="#0c0d10" />
          {cells.map(({ gx, gz }) => {
            const stack = cellIndex.get(`${gx}:${gz}`) ?? [];
            const top = stack[stack.length - 1];
            const spec = top ? pieceSpec(top.kind) : null;
            return (
              <g key={`${gx}:${gz}`} onClick={() => paint(gx, gz)} className="cursor-pointer">
                <rect
                  x={gx}
                  y={gz}
                  width={1}
                  height={1}
                  fill={top ? (top.color ?? spec?.color ?? "#57504a") : "transparent"}
                  fillOpacity={top ? 0.85 : 1}
                  stroke={top?.id === selectedId ? "#f7931a" : "#20232a"}
                  strokeWidth={top?.id === selectedId ? 0.12 : 0.03}
                />
                {spec ? (
                  <text
                    x={gx + 0.5}
                    y={gz + 0.72}
                    textAnchor="middle"
                    fontSize={0.55}
                    fill="#0c0d10"
                    data-no-translate
                  >
                    {spec.glyph}
                  </text>
                ) : null}
                {stack.length > 1 ? (
                  <text x={gx + 0.9} y={gz + 0.28} textAnchor="end" fontSize={0.28} fill="#00e0ff" data-no-translate>
                    {stack.length}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={BLUEPRINT_GRID / 2} y1={0} x2={BLUEPRINT_GRID / 2} y2={BLUEPRINT_GRID} stroke="#f7931a" strokeWidth={0.02} strokeOpacity={0.4} />
          <line x1={0} y1={BLUEPRINT_GRID / 2} x2={BLUEPRINT_GRID} y2={BLUEPRINT_GRID / 2} stroke="#f7931a" strokeWidth={0.02} strokeOpacity={0.4} />
        </svg>
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        TAP A SQUARE TO PLACE · TAP AN EXISTING PIECE OF THE SAME KIND TO SELECT IT · ERASE REMOVES THE TOP PIECE
      </p>

      {selected ? (
        <div className="mt-3 border border-border p-3">
          <div className="label text-bitcoin" data-no-translate>
            SELECTED · {pieceSpec(selected.kind).label}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={selected.label ?? ""}
              onChange={(e) => patchSelected({ label: e.target.value.slice(0, 40) || null })}
              placeholder="Label shown in the world"
              className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selected.color ?? pieceSpec(selected.kind).color}
                onChange={(e) => patchSelected({ color: e.target.value })}
                className="h-8 w-12 border border-border bg-background"
                aria-label="Piece colour"
              />
              <button
                type="button"
                onClick={() => patchSelected({ color: null })}
                className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                [ DEFAULT COLOUR ]
              </button>
            </div>
            {selected.kind === "model" ? (
              <input
                value={selected.inscriptionId ?? ""}
                onChange={(e) => patchSelected({ inscriptionId: e.target.value.trim() || null })}
                placeholder="Model inscription id"
                className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin sm:col-span-2"
                data-no-translate
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              update({ pieces: blueprint.pieces.filter((p) => p.id !== selected.id) });
              setSelectedId(null);
            }}
            className="btn-term-ghost mt-2"
          >
            [ REMOVE PIECE ]
          </button>
        </div>
      ) : null}

      <QuestPlanner blueprint={blueprint} onChange={onChange} />

      {blueprint.pieces.length > 0 ? (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground" data-no-translate>
          {blueprintSummary(blueprint)}
        </p>
      ) : null}
    </div>
  );
}

function QuestPlanner({ blueprint, onChange }: { blueprint: Blueprint; onChange: (next: Blueprint) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [reward, setReward] = useState("");

  return (
    <div className="mt-3 border border-border p-3">
      <div className="label">SOMETHING TO DO HERE</div>
      {blueprint.quests.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {blueprint.quests.map((quest) => (
            <li key={quest.id} className="flex items-center justify-between gap-2 border border-border px-2 py-1.5 font-mono text-[11px]">
              <span>{quest.title}</span>
              <button
                type="button"
                onClick={() => onChange({ ...blueprint, quests: blueprint.quests.filter((q) => q.id !== quest.id) })}
                className="text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quest title"
          className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin"
        />
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="What the visitor must do"
          className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin"
        />
        <input
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          placeholder="Reward text"
          className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-bitcoin"
        />
      </div>
      <button
        type="button"
        className="btn-term-ghost mt-2"
        onClick={() => {
          const clean = title.trim();
          if (clean.length < 2 || blueprint.quests.length >= 8) return;
          onChange({
            ...blueprint,
            quests: [
              ...blueprint.quests,
              {
                id: `${clean.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").slice(0, 24)}-${blueprint.quests.length + 1}`,
                title: clean,
                detail: detail.trim(),
                reward: reward.trim(),
              },
            ],
          });
          setTitle("");
          setDetail("");
          setReward("");
        }}
      >
        [ ADD QUEST ]
      </button>
    </div>
  );
}
