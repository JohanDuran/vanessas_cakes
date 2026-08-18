type Props = {
  shape: string | null;
  tiers: number | null;
  size?: number;
};

export default function ShapeDiagram({ shape, tiers, size = 84 }: Props) {
  const isTwoTier = (tiers ?? 1) >= 2;
  const outer = { fill: "var(--pink-200)", stroke: "var(--pink-400)", strokeWidth: 3 };
  const inner = { fill: "var(--pink-300)", stroke: "var(--pink-500)", strokeWidth: 2 };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {shape === "square" && (
        <>
          <rect x="16" y="16" width="68" height="68" rx="10" {...outer} />
          {isTwoTier && <rect x="34" y="34" width="32" height="32" rx="6" {...inner} />}
        </>
      )}
      {shape === "sheet" && <rect x="8" y="28" width="84" height="44" rx="6" {...outer} />}
      {(shape === "round" || !shape) && (
        <>
          <circle cx="50" cy="50" r="36" {...outer} />
          {isTwoTier && <circle cx="50" cy="50" r="18" {...inner} />}
        </>
      )}
    </svg>
  );
}
