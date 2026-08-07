import { useState } from "react";
import type { DecorationOption, FillingOption, FlavorOption, SizeOption } from "./data";
import { decorations as decorationCatalog } from "./data";
import "./CakeCanvas.css";

export type DraggableItem =
  | { kind: "flavor"; id: string }
  | { kind: "filling"; id: string }
  | { kind: "decoration"; id: string };

type Props = {
  flavor: FlavorOption;
  filling: FillingOption | null;
  size: SizeOption;
  decorationIds: string[];
  onDropItem: (item: DraggableItem) => void;
  onRemoveDecoration: (index: number) => void;
};

const findDecoration = (id: string): DecorationOption | undefined =>
  decorationCatalog.find((d) => d.id === id);

export default function CakeCanvas({
  flavor,
  filling,
  size,
  decorationIds,
  onDropItem,
  onRemoveDecoration,
}: Props) {
  const [isDragOver, setDragOver] = useState(false);
  const isMarble = flavor.id === "marble";
  const twoTiers = size.tiers === 2;

  const scale = { s: 0.82, m: 0.92, l: 1, xl: 1.08 }[size.id] ?? 1;

  const handleDrop: React.DragEventHandler = (e) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as DraggableItem;
      onDropItem(item);
    } catch {
      /* ignore malformed payload */
    }
  };

  return (
    <div
      className={`cake-canvas ${isDragOver ? "cake-canvas--drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <p className="cake-canvas__hint">
        {isDragOver ? "Drop it on the cake!" : "Drag flavors, fillings & decorations here"}
      </p>

      <svg
        viewBox="0 0 320 320"
        className="cake-canvas__svg"
        style={{ transform: `scale(${scale})` }}
        role="img"
        aria-label="Your custom cake preview"
      >
        <defs>
          <linearGradient id="icing-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff5fa" />
            <stop offset="100%" stopColor="#ffd6e8" />
          </linearGradient>
          <radialGradient id="plate-grad" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3e9e0" />
          </radialGradient>
        </defs>

        <ellipse cx="160" cy="288" rx="120" ry="18" fill="rgba(107,66,38,0.14)" />
        <ellipse cx="160" cy="280" rx="112" ry="16" fill="url(#plate-grad)" />

        {twoTiers && (
          <TierGroup
            x={60}
            y={200}
            width={200}
            height={70}
            crumb={flavor.crumb}
            crumbDark={flavor.crumbDark}
            filling={filling}
            marble={isMarble}
            scallop="M60 200 Q80 184 100 200 Q120 184 140 200 Q160 184 180 200 Q200 184 220 200 Q240 184 260 200 L260 214 L60 214 Z"
            scallopLine="M60 200 Q80 184 100 200 Q120 184 140 200 Q160 184 180 200 Q200 184 220 200 Q240 184 260 200"
          />
        )}

        <TierGroup
          x={twoTiers ? 100 : 76}
          y={twoTiers ? 122 : 150}
          width={twoTiers ? 120 : 168}
          height={twoTiers ? 78 : 108}
          crumb={flavor.crumb}
          crumbDark={flavor.crumbDark}
          filling={filling}
          marble={isMarble}
          scallop={
            twoTiers
              ? "M100 122 Q112 106 124 122 Q136 106 148 122 Q160 106 172 122 Q184 106 196 122 L196 136 L100 136 Z"
              : "M76 150 Q92 128 108 150 Q124 128 140 150 Q156 128 172 150 Q188 128 204 150 Q220 128 236 150 L236 166 L76 166 Z"
          }
          scallopLine={
            twoTiers
              ? "M100 122 Q112 106 124 122 Q136 106 148 122 Q160 106 172 122 Q184 106 196 122"
              : "M76 150 Q92 128 108 150 Q124 128 140 150 Q156 128 172 150 Q188 128 204 150 Q220 128 236 150"
          }
        />

        <DecorationLayer ids={decorationIds} twoTiers={twoTiers} onRemove={onRemoveDecoration} />
      </svg>

      <p className="cake-canvas__caption">
        {flavor.name} · {filling ? filling.name : "No filling yet"} · {size.name}
      </p>
    </div>
  );
}

function TierGroup({
  x,
  y,
  width,
  height,
  crumb,
  crumbDark,
  filling,
  marble,
  scallop,
  scallopLine,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  crumb: string;
  crumbDark: string;
  filling: FillingOption | null;
  marble: boolean;
  scallop: string;
  scallopLine: string;
}) {
  const fillingY = y + height * 0.48;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="14" fill={crumb} />
      {marble && (
        <path
          d={`M${x + 6} ${y + height * 0.35} Q${x + width * 0.3} ${y + height * 0.15} ${x + width * 0.55} ${
            y + height * 0.4
          } T${x + width - 6} ${y + height * 0.3}`}
          stroke={crumbDark}
          strokeWidth="5"
          fill="none"
          opacity="0.55"
          strokeLinecap="round"
        />
      )}
      {filling && (
        <rect x={x + 2} y={fillingY} width={width - 4} height="12" fill={filling.color} />
      )}
      <rect x={x} y={y} width={width} height="12" rx="6" fill={crumbDark} opacity="0.4" />
      <path d={scallop} fill="url(#icing-grad)" />
      <path d={scallopLine} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" />
    </g>
  );
}

function DecorationLayer({
  ids,
  twoTiers,
  onRemove,
}: {
  ids: string[];
  twoTiers: boolean;
  onRemove: (index: number) => void;
}) {
  const topY = twoTiers ? 112 : 140;
  const centerX = 160;
  const spacing = 26;

  return (
    <g>
      {ids.map((id, i) => {
        const deco = findDecoration(id);
        if (!deco) return null;
        const offset = (i - (ids.length - 1) / 2) * spacing;
        const wobble = i % 2 === 0 ? -4 : 4;
        return (
          <text
            key={`${id}-${i}`}
            x={centerX + offset}
            y={topY + wobble}
            fontSize="26"
            textAnchor="middle"
            className="cake-canvas__deco"
            onClick={() => onRemove(i)}
          >
            <title>{`${deco.name} — click to remove`}</title>
            {deco.emoji}
          </text>
        );
      })}
    </g>
  );
}
