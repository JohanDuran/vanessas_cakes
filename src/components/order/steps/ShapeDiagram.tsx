type Props = {
  shape: string | null;
  tiers: number | null;
  diameterIn: string | null;
  servesMin: number | null;
  servesMax: number | null;
  size?: number;
};

const VB_W = 100;
const VB_H = 112;

/** How many cut lines to draw — a visual stand-in for "recommended portions,"
 *  capped so the lines stay legible at icon size instead of turning into a
 *  starburst for a 30+ serving cake. */
function sliceCount(servesMin: number | null, servesMax: number | null): number {
  const avg =
    servesMin != null && servesMax != null
      ? Math.round((servesMin + servesMax) / 2)
      : servesMax ?? servesMin ?? 8;
  return Math.max(4, Math.min(12, avg));
}

// Math.cos/Math.sin can differ in their last bit between the server's V8 and
// the browser's, which is enough to make React flag a hydration mismatch on
// the resulting SVG coordinates — round away the noise before rendering.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function DimensionLine({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g stroke="var(--text-soft)" strokeWidth={1}>
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <text
        x={(x1 + x2) / 2}
        y={y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--choco-900)"
        stroke="none"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </text>
    </g>
  );
}

export default function ShapeDiagram({ shape, tiers, diameterIn, servesMin, servesMax, size = 84 }: Props) {
  const isTwoTier = (tiers ?? 1) >= 2;
  const outer = { fill: "var(--pink-200)", stroke: "var(--pink-400)", strokeWidth: 3 };
  const inner = { fill: "var(--pink-300)", stroke: "var(--pink-500)", strokeWidth: 2 };
  const cuts = { stroke: "var(--pink-500)", strokeWidth: 1, opacity: 0.55 };
  const n = sliceCount(servesMin, servesMax);

  let content: React.ReactNode;

  if (shape === "square") {
    const x0 = 16;
    const y0 = 12;
    const w = 68;
    const h = 68;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const vLines = Array.from({ length: cols - 1 }, (_, i) => x0 + ((i + 1) * w) / cols);
    const hLines = Array.from({ length: rows - 1 }, (_, i) => y0 + ((i + 1) * h) / rows);

    content = (
      <>
        <rect x={x0} y={y0} width={w} height={h} rx="10" {...outer} />
        {vLines.map((x) => (
          <line key={x} x1={x} y1={y0} x2={x} y2={y0 + h} {...cuts} />
        ))}
        {hLines.map((y) => (
          <line key={y} x1={x0} y1={y} x2={x0 + w} y2={y} {...cuts} />
        ))}
        {isTwoTier && <rect x="34" y="30" width="32" height="32" rx="6" {...inner} />}
        {diameterIn && <DimensionLine x1={x0} x2={x0 + w} y={92} label={diameterIn} />}
      </>
    );
  } else if (shape === "sheet") {
    const x0 = 8;
    const y0 = 20;
    const w = 84;
    const h = 44;
    const cols = Math.ceil(Math.sqrt(n * (w / h)));
    const rows = Math.ceil(n / cols);
    const vLines = Array.from({ length: cols - 1 }, (_, i) => x0 + ((i + 1) * w) / cols);
    const hLines = Array.from({ length: rows - 1 }, (_, i) => y0 + ((i + 1) * h) / rows);

    content = (
      <>
        <rect x={x0} y={y0} width={w} height={h} rx="6" {...outer} />
        {vLines.map((x) => (
          <line key={x} x1={x} y1={y0} x2={x} y2={y0 + h} {...cuts} />
        ))}
        {hLines.map((y) => (
          <line key={y} x1={x0} y1={y} x2={x0 + w} y2={y} {...cuts} />
        ))}
        {diameterIn && <DimensionLine x1={x0} x2={x0 + w} y={92} label={diameterIn} />}
      </>
    );
  } else {
    const cx = 50;
    const cy = 46;
    const r = 34;
    const slices = Array.from({ length: n }, (_, i) => {
      const angle = (i * 2 * Math.PI) / n;
      return { x: round2(cx + r * Math.cos(angle)), y: round2(cy + r * Math.sin(angle)) };
    });

    content = (
      <>
        <circle cx={cx} cy={cy} r={r} {...outer} />
        {slices.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} {...cuts} />
        ))}
        {isTwoTier && <circle cx={cx} cy={cy} r={17} {...inner} />}
        {diameterIn && <DimensionLine x1={cx - r} x2={cx + r} y={92} label={diameterIn} />}
      </>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={(size * VB_H) / VB_W}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
