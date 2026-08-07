import type { SizeOption } from "./data";
import "./SizePicker.css";

type Props = {
  sizes: SizeOption[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function SizePicker({ sizes, selectedId, onSelect }: Props) {
  return (
    <div className="size-picker">
      <div className="option-palette__head">
        <h4>Size</h4>
        <span>Reference: slices per cake</span>
      </div>
      <div className="size-picker__grid">
        {sizes.map((size) => (
          <button
            key={size.id}
            type="button"
            className={`size-card ${selectedId === size.id ? "size-card--selected" : ""}`}
            onClick={() => onSelect(size.id)}
          >
            <SliceDiagram slices={size.serves} />
            <strong>{size.name}</strong>
            <span>{size.diameter} · serves {size.serves}</span>
            <span className="size-card__price">${size.price}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SliceDiagram({ slices }: { slices: number }) {
  const r = 34;
  const cx = 40;
  const cy = 40;
  const lines = Array.from({ length: slices }).map((_, i) => {
    const angle = (i / slices) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--pink-300)" strokeWidth="1.4" />;
  });

  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="#fff5fa" stroke="var(--pink-400)" strokeWidth="2" />
      {lines}
      <circle cx={cx} cy={cy} r="3" fill="var(--pink-500)" />
    </svg>
  );
}
