"use client";

export type OptionDraft = { label: string; priceDollars: string };

type Props = {
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
};

export default function FieldOptionsEditor({ options, onChange }: Props) {
  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const addOption = () => {
    onChange([...options, { label: "", priceDollars: "0" }]);
  };

  return (
    <div className="field-options-editor">
      {options.map((opt, i) => (
        <div key={i} className="field-options-editor__row">
          <input
            placeholder="Option label"
            value={opt.label}
            onChange={(e) => updateOption(i, { label: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={opt.priceDollars}
            onChange={(e) => updateOption(i, { priceDollars: e.target.value })}
            style={{ maxWidth: 100 }}
          />
          <button
            type="button"
            className="admin-btn-sm admin-btn-sm--danger"
            onClick={() => removeOption(i)}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="admin-btn-sm admin-btn-sm--ghost" onClick={addOption}>
        + Add Option
      </button>
      {options.length === 0 && (
        <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", margin: "6px 0 0" }}>
          No options yet — add at least one.
        </p>
      )}
    </div>
  );
}
