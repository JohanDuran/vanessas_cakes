"use client";

import { useMemo, useState } from "react";
import { AXES, AXIS_LABELS, type Axis } from "../../lib/axes";
import { computeStandardPriceCents, formatCents } from "../../lib/pricing";
import { saveDesign, deleteDesignPhoto, setPrimaryPhoto } from "../../app/admin/(protected)/designs/actions";

type Item = { id: number; axis: string; name: string; priceCents: number; active: boolean };
type Photo = { id: number; path: string; isPrimary: boolean };

type Props = {
  items: Item[];
  design?: {
    id: number;
    name: string;
    description: string | null;
    chargedPriceCents: number;
    published: boolean;
    recipe: Partial<Record<Axis, number>>;
    photos: Photo[];
  };
};

export default function DesignForm({ items, design }: Props) {
  const [selections, setSelections] = useState<Partial<Record<Axis, number>>>(
    design?.recipe ?? {}
  );
  const [chargedDollars, setChargedDollars] = useState(
    design ? (design.chargedPriceCents / 100).toFixed(2) : ""
  );

  const itemsByAxis = useMemo(() => {
    const map = new Map<Axis, Item[]>();
    for (const axis of AXES) {
      map.set(
        axis,
        items.filter((i) => i.axis === axis).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    return map;
  }, [items]);

  const standardPriceCents = useMemo(
    () => computeStandardPriceCents(selections, items),
    [selections, items]
  );

  const chargedCents = Math.round(Number(chargedDollars || "0") * 100);
  const premiumCents = Number.isFinite(chargedCents) ? chargedCents - standardPriceCents : 0;
  const allSelected = AXES.every((axis) => selections[axis] != null);

  return (
    <>
    <form action={saveDesign} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {design && <input type="hidden" name="id" value={design.id} />}

      <div className="admin-form-row">
        <div className="admin-field" style={{ flex: 1, minWidth: 240 }}>
          <label>Design name</label>
          <input name="name" defaultValue={design?.name} required style={{ width: "100%" }} />
        </div>
        <div className="admin-field" style={{ flex: 2, minWidth: 300 }}>
          <label>Description</label>
          <input name="description" defaultValue={design?.description ?? ""} style={{ width: "100%" }} />
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>Recipe (quote tool)</h3>
        <p style={{ color: "var(--text-soft)", marginBottom: 14, fontSize: "0.9rem" }}>
          Pick the exact combination used to make this design. The standard price below is the sum
          of these items&apos; catalog prices.
        </p>
        <div className="admin-form-row">
          {AXES.map((axis) => (
            <div className="admin-field" key={axis}>
              <label>{AXIS_LABELS[axis]}</label>
              <select
                name={`recipe_${axis}`}
                required
                value={selections[axis] ?? ""}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [axis]: Number(e.target.value) || undefined }))
                }
                style={{ minWidth: 160 }}
              >
                <option value="" disabled>
                  Select…
                </option>
                {itemsByAxis.get(axis)?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {!item.active ? " (inactive)" : ""} — {formatCents(item.priceCents)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-form-row" style={{ alignItems: "flex-end" }}>
        <div className="admin-field">
          <label>Standard price (sum of recipe items)</label>
          <div style={{ padding: "9px 0", fontWeight: 600 }}>{formatCents(standardPriceCents)}</div>
        </div>
        <div className="admin-field">
          <label>Charged price ($)</label>
          <input
            name="chargedPriceDollars"
            type="number"
            step="0.01"
            required
            value={chargedDollars}
            onChange={(e) => setChargedDollars(e.target.value)}
            style={{ minWidth: 110 }}
          />
        </div>
        <div className="admin-field">
          <label>Design premium (computed)</label>
          <div style={{ padding: "9px 0", fontWeight: 600, color: "var(--pink-600)" }}>
            {formatCents(premiumCents)}
          </div>
        </div>
      </div>

      <div className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="published" name="published" value="1" defaultChecked={design?.published} />
        <label htmlFor="published" style={{ margin: 0 }}>
          Published (visible to customers)
        </label>
      </div>

      <div className="admin-field">
        <label>{design ? "Add more photos" : "Photos"}</label>
        <input type="file" name="photos" accept="image/*" multiple />
      </div>

      <div>
        <button type="submit" className="btn btn-primary" disabled={!allSelected}>
          {design ? "Save Design" : "Create Design"}
        </button>
      </div>
    </form>

    {design && (
      <div className="admin-card">
        <h3 style={{ marginBottom: 12 }}>Photos</h3>
        {design.photos.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {design.photos.map((photo) => (
              <div key={photo.id} style={{ textAlign: "center" }}>
                <img
                  src={`/uploads/${photo.path}`}
                  alt=""
                  width={120}
                  height={120}
                  style={{
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                    border: photo.isPrimary ? "3px solid var(--pink-500)" : "3px solid transparent",
                  }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "center" }}>
                  {!photo.isPrimary && (
                    <form action={setPrimaryPhoto}>
                      <input type="hidden" name="id" value={photo.id} />
                      <input type="hidden" name="designId" value={design.id} />
                      <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                        Primary
                      </button>
                    </form>
                  )}
                  <form action={deleteDesignPhoto}>
                    <input type="hidden" name="id" value={photo.id} />
                    <input type="hidden" name="designId" value={design.id} />
                    <button type="submit" className="admin-btn-sm admin-btn-sm--danger">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-soft)" }}>No photos yet.</p>
        )}
      </div>
    )}
    </>
  );
}
