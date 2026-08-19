"use client";

import { useMemo, useState } from "react";
import { FIELD_TYPE_LABELS, fieldHasOptions, type FieldType } from "../../lib/fields";
import { computeStandardPriceCents, formatCents, type Answers } from "../../lib/pricing";
import { saveDesign, deleteDesignPhoto, setPrimaryPhoto } from "../../app/admin/(protected)/designs/actions";
import QuickAddFieldModal from "./QuickAddFieldModal";

export type FieldOptionSummary = { id: number; name: string; priceCents: number; active: boolean };

export type FieldSummary = {
  id: number;
  slug: string;
  name: string;
  type: FieldType;
  isBase: boolean;
  active: boolean;
  options: FieldOptionSummary[];
};

type Photo = { id: number; path: string; isPrimary: boolean };

type Props = {
  fields: FieldSummary[];
  design?: {
    id: number;
    name: string;
    description: string | null;
    chargedPriceCents: number;
    published: boolean;
    fieldValues: Answers;
    lockedFieldIds: number[];
    excludedOptionIds: number[];
    photos: Photo[];
  };
};

type Draft = { optionIds: number[]; text: string; number: string };

function draftFromAnswer(answer: Answers[number] | undefined): Draft {
  return {
    optionIds: answer?.type === "options" ? answer.optionIds : [],
    text: answer?.type === "text" ? answer.value : "",
    number: answer?.type === "number" ? String(answer.value) : "",
  };
}

export default function DesignForm({ fields, design }: Props) {
  const [chargedDollars, setChargedDollars] = useState(
    design ? (design.chargedPriceCents / 100).toFixed(2) : ""
  );
  const [availableFields, setAvailableFields] = useState<FieldSummary[]>(fields);
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const init: Record<number, Draft> = {};
    for (const f of fields) init[f.id] = draftFromAnswer(design?.fieldValues[f.id]);
    return init;
  });
  const [includedCustomFieldIds, setIncludedCustomFieldIds] = useState<Set<number>>(
    () => new Set(fields.filter((f) => !f.isBase && design?.fieldValues[f.id] != null).map((f) => f.id))
  );
  const [lockedFieldIds, setLockedFieldIds] = useState<Set<number>>(new Set(design?.lockedFieldIds ?? []));
  const [excludedOptionIds, setExcludedOptionIds] = useState<Set<number>>(
    new Set(design?.excludedOptionIds ?? [])
  );
  const [showFieldModal, setShowFieldModal] = useState(false);

  const setDraft = (fieldId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [fieldId]: { ...prev[fieldId], ...patch } }));
  };

  const toggleLocked = (fieldId: number) => {
    setLockedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const toggleExcluded = (optionId: number) => {
    setExcludedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const toggleIncluded = (fieldId: number) => {
    setIncludedCustomFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  // selecting a new default option for a field can't leave that same option
  // sitting in the "hide this option" list for the same field
  const selectSingleOption = (fieldId: number, optionId: number | undefined) => {
    setDraft(fieldId, { optionIds: optionId != null ? [optionId] : [] });
    if (optionId != null) {
      setExcludedOptionIds((prev) => {
        if (!prev.has(optionId)) return prev;
        const next = new Set(prev);
        next.delete(optionId);
        return next;
      });
    }
  };

  const currentAnswers: Answers = useMemo(() => {
    const answers: Answers = {};
    for (const f of availableFields) {
      const included = f.isBase || includedCustomFieldIds.has(f.id);
      if (!included) continue;
      const draft = drafts[f.id];
      if (!draft) continue;
      if (f.type === "single_select" || f.type === "multi_select") {
        if (draft.optionIds.length > 0) answers[f.id] = { type: "options", optionIds: draft.optionIds };
      } else if (f.type === "text") {
        if (draft.text) answers[f.id] = { type: "text", value: draft.text };
      } else if (f.type === "number") {
        if (draft.number !== "") answers[f.id] = { type: "number", value: Number(draft.number) };
      }
    }
    return answers;
  }, [availableFields, drafts, includedCustomFieldIds]);

  const allOptionsFlat = useMemo(
    () => availableFields.flatMap((f) => f.options.map((o) => ({ id: o.id, fieldId: f.id, priceCents: o.priceCents }))),
    [availableFields]
  );

  const standardPriceCents = useMemo(
    () => computeStandardPriceCents(currentAnswers, allOptionsFlat),
    [currentAnswers, allOptionsFlat]
  );

  const chargedCents = Math.round(Number(chargedDollars || "0") * 100);
  const premiumCents = Number.isFinite(chargedCents) ? chargedCents - standardPriceCents : 0;

  const allBaseAnswered = availableFields.filter((f) => f.isBase).every((f) => currentAnswers[f.id] != null);

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Fields (quote tool)</h3>
              <p style={{ color: "var(--text-soft)", marginTop: 4, fontSize: "0.9rem" }}>
                Every built-in field needs a default — the standard price below is the sum of these
                values&apos; catalog prices. Custom fields are optional; include the ones this design
                uses. You can lock any field so customers can&apos;t change it, or hide specific
                options just for this design.
              </p>
            </div>
            <button type="button" className="admin-btn-sm admin-btn-sm--ghost" onClick={() => setShowFieldModal(true)}>
              + Add Field
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {availableFields.map((field) => {
              const isIncluded = field.isBase || includedCustomFieldIds.has(field.id);
              const isLocked = lockedFieldIds.has(field.id);
              const draft = drafts[field.id] ?? { optionIds: [], text: "", number: "" };
              const hasOptions = fieldHasOptions(field.type);
              const hideableOptions = field.options.filter((opt) => !draft.optionIds.includes(opt.id));

              return (
                <div className="recipe-axis-row" key={field.id}>
                  <div className="recipe-axis-row__main">
                    <label>
                      {field.name}
                      {!field.isBase && <span className="field-type-tag">{FIELD_TYPE_LABELS[field.type]}</span>}
                      {!field.active && " (inactive)"}
                    </label>

                    {!field.isBase && (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          name="includedFieldIds"
                          value={field.id}
                          checked={isIncluded}
                          onChange={() => toggleIncluded(field.id)}
                        />
                        Include in this design
                      </label>
                    )}

                    {isIncluded && field.type === "single_select" && (
                      <select
                        name={`option_${field.id}`}
                        required
                        value={draft.optionIds[0] ?? ""}
                        onChange={(e) => selectSingleOption(field.id, e.target.value ? Number(e.target.value) : undefined)}
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {field.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                            {!opt.active ? " (inactive)" : ""} — {formatCents(opt.priceCents)}
                          </option>
                        ))}
                      </select>
                    )}

                    {isIncluded && field.type === "text" && (
                      <input
                        name={`text_${field.id}`}
                        value={draft.text}
                        onChange={(e) => setDraft(field.id, { text: e.target.value })}
                        placeholder="Default text"
                        style={{ flex: 1, minWidth: 200 }}
                      />
                    )}

                    {isIncluded && field.type === "number" && (
                      <input
                        name={`number_${field.id}`}
                        type="number"
                        value={draft.number}
                        onChange={(e) => setDraft(field.id, { number: e.target.value })}
                        placeholder="Default value"
                        style={{ minWidth: 120 }}
                      />
                    )}
                  </div>

                  {isIncluded && field.type === "multi_select" && (
                    <div className="recipe-axis-row__exclude">
                      <span className="recipe-axis-row__exclude-label">Default selection:</span>
                      <div className="recipe-axis-row__exclude-list">
                        {field.options.map((opt) => (
                          <label key={opt.id}>
                            <input
                              type="checkbox"
                              name={`options_${field.id}`}
                              value={opt.id}
                              checked={draft.optionIds.includes(opt.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...draft.optionIds, opt.id]
                                  : draft.optionIds.filter((id) => id !== opt.id);
                                setDraft(field.id, { optionIds: next });
                              }}
                            />
                            {opt.name} — {formatCents(opt.priceCents)}
                          </label>
                        ))}
                        {field.options.length === 0 && (
                          <span style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
                            No options yet — add some from Catalog.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isIncluded && (
                    <label className="recipe-axis-row__lock">
                      <input
                        type="checkbox"
                        name="lockedFieldIds"
                        value={field.id}
                        checked={isLocked}
                        onChange={() => toggleLocked(field.id)}
                      />
                      🔒 Lock — customers can&apos;t change this
                    </label>
                  )}

                  {isIncluded && !isLocked && hasOptions && (
                    <div className="recipe-axis-row__exclude">
                      <span className="recipe-axis-row__exclude-label">Hide specific options for this design:</span>
                      <div className="recipe-axis-row__exclude-list">
                        {hideableOptions.map((opt) => (
                          <label key={opt.id}>
                            <input
                              type="checkbox"
                              name="excludedOptionIds"
                              value={opt.id}
                              checked={excludedOptionIds.has(opt.id)}
                              onChange={() => toggleExcluded(opt.id)}
                            />
                            {opt.name}
                          </label>
                        ))}
                        {hideableOptions.length === 0 && (
                          <span style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
                            No other options to hide.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {availableFields.length === 0 && (
              <p style={{ color: "var(--text-soft)" }}>No fields defined yet — add one above.</p>
            )}
          </div>
        </div>

        <div className="admin-form-row" style={{ alignItems: "flex-end" }}>
          <div className="admin-field">
            <label>Standard price (sum of field values)</label>
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
          <button type="submit" className="btn btn-primary" disabled={!allBaseAnswered}>
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

      {showFieldModal && (
        <QuickAddFieldModal
          onClose={() => setShowFieldModal(false)}
          onCreated={(field) => {
            setAvailableFields((prev) => [...prev, field]);
            setDrafts((prev) => ({ ...prev, [field.id]: { optionIds: [], text: "", number: "" } }));
            setIncludedCustomFieldIds((prev) => new Set(prev).add(field.id));
            setShowFieldModal(false);
          }}
        />
      )}
    </>
  );
}
