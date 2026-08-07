import type { DecorationOption, FillingOption, FlavorOption } from "./data";
import type { DraggableItem } from "./CakeCanvas";
import "./OptionPalette.css";

type AnyOption = FlavorOption | FillingOption | DecorationOption;

type Props = {
  title: string;
  hint: string;
  options: AnyOption[];
  selectedId?: string | null;
  onSelect: (item: DraggableItem) => void;
  countFor?: (id: string) => number;
};

export default function OptionPalette({ title, hint, options, selectedId, onSelect, countFor }: Props) {
  return (
    <div className="option-palette">
      <div className="option-palette__head">
        <h4>{title}</h4>
        <span>{hint}</span>
      </div>
      <div className="option-palette__chips">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const count = countFor?.(opt.id) ?? 0;
          return (
            <button
              key={opt.id}
              type="button"
              className={`option-chip ${isSelected ? "option-chip--selected" : ""}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ kind: opt.kind, id: opt.id })
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onSelect({ kind: opt.kind, id: opt.id } as DraggableItem)}
            >
              <span className="option-chip__swatch" style={{ background: swatchFor(opt) }}>
                {"emoji" in opt ? opt.emoji : ""}
              </span>
              <span className="option-chip__label">{opt.name}</span>
              {opt.price > 0 && <span className="option-chip__price">+${opt.price}</span>}
              {count > 0 && <span className="option-chip__count">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function swatchFor(opt: AnyOption): string {
  if ("swatch" in opt) return opt.swatch;
  if ("color" in opt) return opt.color;
  return "var(--pink-100)";
}
