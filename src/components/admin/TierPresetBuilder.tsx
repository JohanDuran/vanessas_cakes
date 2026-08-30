"use client";

import { useState } from "react";

type Mold = { id: number; name: string; sortOrder: number };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  molds: Mold[];
  levelCounts: readonly number[];
  initial?: {
    id: number;
    name: string;
    priceDollars: string;
    levelCount: number;
    /** base (widest) first, top (narrowest) last */
    moldOptionIds: number[];
  };
  submitLabel: string;
};

export default function TierPresetBuilder({ action, molds, levelCounts, initial, submitLabel }: Props) {
  const sortedMolds = [...molds].sort((a, b) => b.sortOrder - a.sortOrder);
  const [levelCount, setLevelCount] = useState(initial?.levelCount ?? levelCounts[0]);
  const [moldIds, setMoldIds] = useState<number[]>(
    initial?.moldOptionIds ?? Array.from({ length: levelCounts[0] }, () => sortedMolds[0]?.id ?? 0)
  );

  const handleLevelCountChange = (next: number) => {
    setLevelCount(next);
    setMoldIds((prev) => {
      const copy = prev.slice(0, next);
      while (copy.length < next) copy.push(sortedMolds[0]?.id ?? 0);
      return copy;
    });
  };

  return (
    <form action={action} className="admin-form-row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="admin-field">
        <label>Name</label>
        <input name="name" defaultValue={initial?.name} style={{ minWidth: 140 }} />
      </div>
      <div className="admin-field">
        <label>Price ($)</label>
        <input
          name="priceDollars"
          type="number"
          step="0.01"
          defaultValue={initial?.priceDollars ?? "0"}
          style={{ minWidth: 90 }}
        />
      </div>
      <div className="admin-field">
        <label>Levels</label>
        <select
          name="levelCount"
          value={levelCount}
          onChange={(e) => handleLevelCountChange(Number(e.target.value))}
          style={{ minWidth: 90 }}
        >
          {levelCounts.map((n) => (
            <option key={n} value={n}>
              {n} Tiers
            </option>
          ))}
        </select>
      </div>
      {Array.from({ length: levelCount }, (_, i) => (
        <div className="admin-field" key={i}>
          <label>{i === 0 ? "Base" : i === levelCount - 1 ? "Top" : `Tier ${i + 1}`}</label>
          <select
            name="moldOptionIds"
            value={moldIds[i] ?? sortedMolds[0]?.id ?? ""}
            onChange={(e) => {
              const value = Number(e.target.value);
              setMoldIds((prev) => {
                const copy = [...prev];
                copy[i] = value;
                return copy;
              });
            }}
            style={{ minWidth: 110 }}
          >
            {sortedMolds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px" }}>
        {submitLabel}
      </button>
    </form>
  );
}
