type Props = {
  shape: string | null;
  tiers: number | null;
  diameterIn: number | null;
  widthIn: number | null;
  lengthIn: number | null;
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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

/** Same tick-and-line dimension marker as DimensionLine, rotated 90° for a
 *  rectangle's second (vertical) side — so width and length each get their
 *  own real dimension line instead of being glued into one label. */
function VerticalDimensionLine({ y1, y2, x, label }: { y1: number; y2: number; x: number; label: string }) {
  const midY = (y1 + y2) / 2;
  const textX = x + 8;
  return (
    <g stroke="var(--text-soft)" strokeWidth={1}>
      <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} />
      <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} />
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <text
        x={textX}
        y={midY}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--choco-900)"
        stroke="none"
        style={{ fontFamily: "var(--font-heading)" }}
        transform={`rotate(90 ${textX} ${midY})`}
      >
        {label}
      </text>
    </g>
  );
}

export default function ShapeDiagram({
  shape,
  tiers,
  diameterIn,
  widthIn,
  lengthIn,
  servesMin,
  servesMax,
  size = 84,
}: Props) {
  const isTwoTier = (tiers ?? 1) >= 2;
  const outer = { fill: "var(--pink-200)", stroke: "var(--pink-400)", strokeWidth: 3 };
  const inner = { fill: "var(--pink-300)", stroke: "var(--pink-500)", strokeWidth: 2 };
  const cuts = { stroke: "var(--pink-500)", strokeWidth: 1, opacity: 0.55 };
  const n = sliceCount(servesMin, servesMax);

  let content: React.ReactNode;

  if (shape === "square" || shape === "rectangle") {
    // real width:length aspect ratio (clamped so an extreme sheet size
    // doesn't collapse into an illegible sliver at icon size), fit inside a
    // reserved area that still leaves room for a horizontal dimension line
    // under the shape and a vertical one to its right
    const w0 = widthIn ?? lengthIn ?? 1;
    const l0 = lengthIn ?? widthIn ?? 1;
    const ratio = clamp(w0 / l0, 0.35, 2.8);
    const areaX0 = 10;
    const areaY0 = 12;
    const maxBoxW = 58;
    const maxBoxH = 68;
    let w = maxBoxW;
    let h = w / ratio;
    if (h > maxBoxH) {
      h = maxBoxH;
      w = h * ratio;
    }
    const x0 = round2(areaX0 + (maxBoxW - w) / 2);
    const y0 = round2(areaY0 + (maxBoxH - h) / 2);
    w = round2(w);
    h = round2(h);

    const cols = Math.ceil(Math.sqrt(n * (w / h)));
    const rows = Math.ceil(n / cols);
    const vLines = Array.from({ length: cols - 1 }, (_, i) => x0 + ((i + 1) * w) / cols);
    const hLines = Array.from({ length: rows - 1 }, (_, i) => y0 + ((i + 1) * h) / rows);

    const innerW = round2(w * 0.47);
    const innerH = round2(h * 0.47);

    content = (
      <>
        <rect x={x0} y={y0} width={w} height={h} rx={shape === "square" ? 10 : 6} {...outer} />
        {vLines.map((x) => (
          <line key={x} x1={x} y1={y0} x2={x} y2={y0 + h} {...cuts} />
        ))}
        {hLines.map((y) => (
          <line key={y} x1={x0} y1={y} x2={x0 + w} y2={y} {...cuts} />
        ))}
        {isTwoTier && (
          <rect
            x={round2(x0 + (w - innerW) / 2)}
            y={round2(y0 + (h - innerH) / 2)}
            width={innerW}
            height={innerH}
            rx={shape === "square" ? 6 : 4}
            {...inner}
          />
        )}
        {widthIn != null && <DimensionLine x1={x0} x2={x0 + w} y={y0 + h + 10} label={`${widthIn}"`} />}
        {lengthIn != null && <VerticalDimensionLine y1={y0} y2={y0 + h} x={x0 + w + 8} label={`${lengthIn}"`} />}
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
        {diameterIn != null && (
          <DimensionLine x1={cx - r} x2={cx + r} y={92} label={`${diameterIn}"`} />
        )}
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
