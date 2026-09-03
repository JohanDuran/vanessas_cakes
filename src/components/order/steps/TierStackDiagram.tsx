type Level = { shape: string | null; diameterIn: number | null; widthIn: number | null; lengthIn: number | null };

type Props = {
  /** base (position 1) first, top (narrowest) last */
  levels: Level[];
  size?: number;
};

const VB_W = 100;
const VB_H = 112;

const FILLS = ["var(--pink-200)", "var(--pink-300)"];
const STROKES = ["var(--pink-400)", "var(--pink-500)"];

/** Side-view stacked-tier silhouette, generalizing ShapeDiagram's single
 *  nested inner shape to N tiers with real relative widths (base widest,
 *  tapering to the top), one rect per level rather than one shape total. */
export default function TierStackDiagram({ levels, size = 84 }: Props) {
  const n = Math.max(levels.length, 1);
  const stackTop = 10;
  const stackBottom = 96;
  const tierH = (stackBottom - stackTop) / n;
  const maxW = 74;
  const minW = 30;
  const cx = VB_W / 2;

  const tiers = levels.map((level, i) => {
    const width = n > 1 ? maxW - ((maxW - minW) * i) / (n - 1) : maxW;
    return {
      x: cx - width / 2,
      y: stackBottom - tierH * (i + 1),
      width,
      height: tierH,
      rx: level.shape === "square" || level.shape === "rectangle" ? 6 : tierH / 2.4,
    };
  });

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width={size} height={(size * VB_H) / VB_W} aria-hidden="true">
      {tiers.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width={t.width}
          height={t.height}
          rx={t.rx}
          fill={FILLS[i % FILLS.length]}
          stroke={STROKES[i % STROKES.length]}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
