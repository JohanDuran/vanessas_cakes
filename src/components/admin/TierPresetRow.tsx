"use client";

import { useState } from "react";
import TierPresetBuilder from "./TierPresetBuilder";

type Mold = { id: number; name: string; sortOrder: number };

export type TierPresetSummary = {
  optionId: number;
  fieldId: number;
  name: string;
  priceDollars: string;
  levelCount: number;
  /** base (widest) first, top (narrowest) last */
  moldOptionIds: number[];
  breakdown: string;
  active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
  molds: Mold[];
  levelCounts: readonly number[];
  preset: TierPresetSummary;
};

export default function TierPresetRow({ action, deactivateAction, molds, levelCounts, preset }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="admin-card" style={{ marginBottom: 12 }}>
        <TierPresetBuilder
          action={action}
          molds={molds}
          levelCounts={levelCounts}
          initial={{
            id: preset.optionId,
            name: preset.name,
            priceDollars: preset.priceDollars,
            levelCount: preset.levelCount,
            moldOptionIds: preset.moldOptionIds,
          }}
          submitLabel="Save Preset"
        />
        <button
          type="button"
          className="admin-btn-sm admin-btn-sm--ghost"
          onClick={() => setIsEditing(false)}
          style={{ marginTop: 8 }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      className="admin-form-row"
      style={{ alignItems: "center", marginBottom: 8, opacity: preset.active ? 1 : 0.6 }}
    >
      <strong style={{ minWidth: 100 }}>{preset.name}</strong>
      <span style={{ minWidth: 60 }}>${preset.priceDollars}</span>
      <span style={{ minWidth: 70, color: "var(--text-soft)" }}>{preset.levelCount} tiers</span>
      <span style={{ flex: 1, color: "var(--text-soft)" }}>{preset.breakdown}</span>
      <span style={{ minWidth: 60 }}>{preset.active ? "Active" : "Inactive"}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="admin-btn-sm admin-btn-sm--ghost" onClick={() => setIsEditing(true)}>
          Edit
        </button>
        <form action={deactivateAction}>
          <input type="hidden" name="id" value={preset.optionId} />
          <input type="hidden" name="fieldId" value={preset.fieldId} />
          <input type="hidden" name="active" value={preset.active ? 0 : 1} />
          <button
            type="submit"
            className={`admin-btn-sm ${preset.active ? "admin-btn-sm--danger" : "admin-btn-sm--ghost"}`}
          >
            {preset.active ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </div>
    </div>
  );
}
