"use client";

import { useEffect, useMemo, useState } from "react";
import { CAKE_STYLE_FIELD_SLUG, FIELD_TYPE_LABELS, SIZE_FIELD_SLUG, fieldHasOptions, type CakeStyleKind, type DesignKind, type FieldType, type TierLevelCount } from "../../lib/fields";
import { applyCakeStyleRules, buildCakeStyleContext, currentStyleKind } from "../../lib/cakeStyle";
import { computeStandardPriceCents, formatCents, type Answers, type PriceableField } from "../../lib/pricing";
import { saveDesign, deleteDesignPhoto, setPrimaryPhoto } from "../../app/admin/(protected)/designs/actions";
import type { DesignTierPresetSummary } from "../../app/admin/(protected)/designs/tierPresetSummary";
import QuickAddFieldModal from "./QuickAddFieldModal";

export type FieldOptionSummary = {
  id: number;
  name: string;
  priceCents: number;
  active: boolean;
  styleKind?: CakeStyleKind | null;
  tierLevelCount?: TierLevelCount | null;
};

export type FieldSummary = {
  id: number;
  slug: string;
  name: string;
  type: FieldType;
  isBase: boolean;
  active: boolean;
  required: boolean;
  additionalPriceCents: number;
  options: FieldOptionSummary[];
};

type Photo = { id: number; path: string; isPrimary: boolean };

export type CategorySummary = { id: number; name: string };

type Props = {
  fields: FieldSummary[];
  tierPresets?: DesignTierPresetSummary[];
  categories?: CategorySummary[];
  /** set when this design is being created from Portfolio's "Configure" button —
   *  its photo becomes this design's photo on save (see saveDesign). Ignored once
   *  a design already exists (editing never re-seeds from a portfolio photo). */
  portfolioPhoto?: { id: number; path: string } | null;
  design?: {
    id: number;
    name: string;
    description: string | null;
    /** catalog | custom | custom_portfolio — immutable after creation; the
     *  two non-catalog kinds are seeded once, never created via this form. */
    kind: DesignKind;
    chargedPriceCents: number;
    published: boolean;
    fieldValues: Answers;
    lockedFieldIds: number[];
    excludedOptionIds: number[];
    categoryIds: number[];
    /** every field this design uses, whether or not a default value was
     *  given — see DesignSummaryDTO.includedFieldIds */
    includedFieldIds: number[];
    photos: Photo[];
  };
};

/** cake_style and size must be included/excluded together — cakeStyle.ts's
 *  tier-preset logic and the Size step's style filtering assume either both
 *  are present on a design or neither is. Enforced here (linked checkboxes)
 *  and mirrored server-side in saveDesign, not as a DB constraint. */
const PAIRED_INCLUSION_SLUGS = new Set<string>([CAKE_STYLE_FIELD_SLUG, SIZE_FIELD_SLUG]);

type Draft = { optionIds: number[]; text: string; number: string };

function draftFromAnswer(answer: Answers[number] | undefined): Draft {
  return {
    optionIds: answer?.type === "options" ? answer.optionIds : [],
    text: answer?.type === "text" ? answer.value : "",
    number: answer?.type === "number" ? String(answer.value) : "",
  };
}

export default function DesignForm({ fields, tierPresets = [], categories = [], portfolioPhoto, design }: Props) {
  // new designs are always catalog — the two quote-kind designs are seeded
  // once and only ever reached through their own edit pages, never created here
  const isCatalog = !design || design.kind === "catalog";
  const [chargedDollars, setChargedDollars] = useState(
    design ? (design.chargedPriceCents / 100).toFixed(2) : ""
  );
  const [availableFields, setAvailableFields] = useState<FieldSummary[]>(fields);
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const init: Record<number, Draft> = {};
    for (const f of fields) init[f.id] = draftFromAnswer(design?.fieldValues[f.id]);
    return init;
  });
  // a brand-new design starts with every base field pre-checked (matching
  // the old always-included behavior, admin can uncheck from there); an
  // existing design's checked set is whatever it actually includes
  const [includedFieldIds, setIncludedFieldIds] = useState<Set<number>>(
    () => new Set(fields.filter((f) => (design ? design.includedFieldIds.includes(f.id) : f.isBase)).map((f) => f.id))
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
    const field = availableFields.find((f) => f.id === fieldId);
    setIncludedFieldIds((prev) => {
      const next = new Set(prev);
      const nowIncluded = !next.has(fieldId);
      if (nowIncluded) next.add(fieldId);
      else next.delete(fieldId);

      // cake_style and size move together — see PAIRED_INCLUSION_SLUGS
      if (field && PAIRED_INCLUSION_SLUGS.has(field.slug)) {
        const partner = availableFields.find((f) => f.id !== fieldId && PAIRED_INCLUSION_SLUGS.has(f.slug));
        if (partner) {
          if (nowIncluded) next.add(partner.id);
          else next.delete(partner.id);
        }
      }
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
      if (!includedFieldIds.has(f.id)) continue;
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
  }, [availableFields, drafts, includedFieldIds]);

  const allOptionsFlat = useMemo(
    () => availableFields.flatMap((f) => f.options.map((o) => ({ id: o.id, fieldId: f.id, priceCents: o.priceCents }))),
    [availableFields]
  );

  // `size`'s available options depend on the drafted cake_style answer
  const cakeStyleCtx = useMemo(() => {
    const fieldDTOs = availableFields.map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      type: f.type,
      isBase: f.isBase,
      sortOrder: 0,
      hasShapeDiagram: false,
      required: f.required,
      additionalPriceCents: f.additionalPriceCents,
    }));
    const optionDTOs = availableFields.flatMap((f) =>
      f.options.map((o) => ({
        id: o.id,
        fieldId: f.id,
        name: o.name,
        priceCents: o.priceCents,
        dimensions: null,
        styleKind: o.styleKind ?? null,
        tierLevelCount: o.tierLevelCount ?? null,
      }))
    );
    const presetDTOs = tierPresets.map((p) => ({
      fieldOptionId: p.fieldOptionId,
      levelCount: p.levelCount,
      levels: p.levels.map((l, i) => ({
        position: i + 1,
        moldOptionId: 0,
        moldName: l.moldName,
        diameterIn: null,
        shape: null,
        servesMin: null,
        servesMax: null,
      })),
    }));
    return buildCakeStyleContext(fieldDTOs, optionDTOs, presetDTOs);
  }, [availableFields, tierPresets]);

  const styleKind = cakeStyleCtx ? currentStyleKind(currentAnswers, cakeStyleCtx) : undefined;
  const presetsByOptionId = useMemo(() => new Map(tierPresets.map((p) => [p.fieldOptionId, p])), [tierPresets]);

  // mirrors the order wizard's resolveAll: a `size` default left over from a
  // different cake_style (picked before a later style change, or inherited
  // from stale data) must not linger in the draft — otherwise it silently
  // fails missingRequiredDefaults below with nothing on screen explaining
  // why Save is disabled. Clearing it here keeps the visible dropdown, the
  // drafted state, and the validation all in agreement.
  useEffect(() => {
    if (!cakeStyleCtx) return;
    const sizeDraft = drafts[cakeStyleCtx.sizeFieldId];
    const optionId = sizeDraft?.optionIds[0];
    if (optionId == null) return;
    if (cakeStyleCtx.styleKindByOptionId.get(optionId) === styleKind) return;
    setDraft(cakeStyleCtx.sizeFieldId, { optionIds: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKind, cakeStyleCtx]);

  // drops the drafted `size` answer once it no longer belongs to the drafted
  // style (e.g. a Tiered preset pick left over from before switching back to
  // Standard) — same rule the order wizard applies, so the price preview
  // below never double-counts a stale, no-longer-selectable size option
  const effectiveAnswers: Answers = useMemo(
    () => (cakeStyleCtx ? applyCakeStyleRules(currentAnswers, cakeStyleCtx) : currentAnswers),
    [currentAnswers, cakeStyleCtx]
  );

  // Catalog designs price themselves off each included option field's
  // default (standardPriceCents below), so every included single/multi
  // select field needs one — an included priced option left without a
  // default would silently inflate the customer's eventual total past
  // chargedPriceCents once they pick something for it in the wizard. Quote
  // designs (custom / custom_portfolio) have no fixed price to protect, so
  // nothing is required there — the customer just picks freely.
  const missingRequiredDefaults = isCatalog
    ? availableFields.filter(
        (f) => includedFieldIds.has(f.id) && fieldHasOptions(f.type) && effectiveAnswers[f.id] == null
      )
    : [];
  const missingRequiredDefaultIds = new Set(missingRequiredDefaults.map((f) => f.id));

  const allFieldsFlat: PriceableField[] = useMemo(
    () => availableFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents })),
    [availableFields]
  );

  const standardPriceCents = useMemo(
    () => computeStandardPriceCents(effectiveAnswers, allOptionsFlat, allFieldsFlat),
    [effectiveAnswers, allOptionsFlat, allFieldsFlat]
  );

  const chargedCents = Math.round(Number(chargedDollars || "0") * 100);
  const premiumCents = Number.isFinite(chargedCents) ? chargedCents - standardPriceCents : 0;

  return (
    <>
      <form action={saveDesign} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {design && <input type="hidden" name="id" value={design.id} />}
        {!design && portfolioPhoto && (
          <input type="hidden" name="portfolioPhotoId" value={portfolioPhoto.id} />
        )}

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

        <div className="admin-field">
          <label>Cake categories</label>
          <p style={{ color: "var(--text-soft)", marginTop: 4, marginBottom: 8, fontSize: "0.9rem" }}>
            Pick zero, one, or many — these power the filter chips customers see above the design
            picker. Not shown to customers by themselves.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
            {categories.map((category) => (
              <label key={category.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={design?.categoryIds.includes(category.id) ?? false}
                />
                {category.name}
              </label>
            ))}
            {categories.length === 0 && (
              <span style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
                No categories yet — add some from Categories.
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Fields (quote tool)</h3>
              <p style={{ color: "var(--text-soft)", marginTop: 4, fontSize: "0.9rem" }}>
                {isCatalog
                  ? "Include the fields this design uses, and give each included option field a default — the standard price below is the sum of those defaults' catalog prices. You can lock any field so customers can't change it, or hide specific options just for this design."
                  : "Include the fields this quote flow should ask about — no default value is required, the customer picks freely (or leaves it blank). You can still lock a field to force one answer, or hide specific options."}
              </p>
            </div>
            <button type="button" className="admin-btn-sm admin-btn-sm--ghost" onClick={() => setShowFieldModal(true)}>
              + Add Field
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {availableFields.map((field) => {
              const isIncluded = includedFieldIds.has(field.id);
              const isLocked = lockedFieldIds.has(field.id);
              const isPaired = PAIRED_INCLUSION_SLUGS.has(field.slug);
              const draft = drafts[field.id] ?? { optionIds: [], text: "", number: "" };
              const hasOptions = fieldHasOptions(field.type);
              const isSizeField = field.slug === SIZE_FIELD_SLUG;
              const hideableOptions = field.options
                .filter((opt) => !draft.optionIds.includes(opt.id))
                .map((opt) => ({
                  ...opt,
                  label: isSizeField && opt.styleKind ? `${opt.name} (${opt.styleKind})` : opt.name,
                }));
              const selectableOptions = isSizeField
                ? field.options.filter((opt) => opt.styleKind === styleKind)
                : field.options;

              return (
                <div className="recipe-axis-row" key={field.id}>
                  <div className="recipe-axis-row__main">
                    <label>
                      {field.name}
                      {!field.isBase && <span className="field-type-tag">{FIELD_TYPE_LABELS[field.type]}</span>}
                      {!field.active && " (inactive)"}
                      {(field.type === "text" || field.type === "number") && field.required && (
                        <span className="field-type-tag">Required</span>
                      )}
                      {(field.type === "text" || field.type === "number") && field.additionalPriceCents > 0 && (
                        <span className="field-type-tag">+{formatCents(field.additionalPriceCents)}</span>
                      )}
                    </label>

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
                    {isPaired && (
                      <span style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>
                        Cake Style and Size are linked — enabling/disabling one does the same to the other.
                      </span>
                    )}

                    {isIncluded && field.type === "single_select" && (
                      <select
                        name={`option_${field.id}`}
                        required={isCatalog}
                        value={draft.optionIds[0] ?? ""}
                        onChange={(e) => selectSingleOption(field.id, e.target.value ? Number(e.target.value) : undefined)}
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {selectableOptions.map((opt) => {
                          const breakdown = presetsByOptionId.get(opt.id)?.levels.map((l) => l.moldName).join(" → ");
                          return (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                              {breakdown ? ` (${breakdown})` : ""}
                              {!opt.active ? " (inactive)" : ""} — {formatCents(opt.priceCents)}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {isSizeField && (
                      <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", margin: "4px 0 0" }}>
                        {styleKind == null
                          ? "Pick a Cake Style first."
                          : selectableOptions.length === 0
                            ? `No ${styleKind} sizes configured yet — add some from Catalog.`
                            : null}
                      </p>
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
                        {missingRequiredDefaultIds.has(field.id) && (
                          <span style={{ color: "var(--pink-600)", fontSize: "0.8rem" }}>
                            Needs at least one default selection before this can be saved.
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
                            {opt.label}
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

        {isCatalog ? (
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
        ) : (
          // quote flows have no fixed price — the baker quotes by hand once
          // the request comes in — so chargedPriceDollars is just pinned to 0
          <input type="hidden" name="chargedPriceDollars" value="0" />
        )}

        {isCatalog ? (
          <div className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="published" name="published" value="1" defaultChecked={design?.published} />
            <label htmlFor="published" style={{ margin: 0 }}>
              Published (visible to customers)
            </label>
          </div>
        ) : (
          // the two quote flows are always reachable, never unlisted like a
          // catalog product
          <input type="hidden" name="published" value="1" />
        )}

        {!design && portfolioPhoto && (
          <div className="admin-field">
            <label>From Portfolio</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={portfolioPhoto.path}
                alt=""
                width={72}
                height={72}
                style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
              />
              <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", margin: 0 }}>
                This photo will become the design&apos;s primary photo, and will be removed from the
                Portfolio once you save.
              </p>
            </div>
          </div>
        )}

        <div className="admin-field">
          <label>{design || portfolioPhoto ? "Add more photos" : "Photos"}</label>
          <input type="file" name="photos" accept="image/*" multiple />
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={missingRequiredDefaults.length > 0}>
            {design ? "Save Design" : "Create Design"}
          </button>
          {missingRequiredDefaults.length > 0 && (
            <p style={{ color: "var(--pink-600)", fontSize: "0.85rem", marginTop: 6 }}>
              Give a default value for: {missingRequiredDefaults.map((f) => f.name).join(", ")} — or uncheck
              &quot;Include in this design&quot; if you don&apos;t want to use it.
            </p>
          )}
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
                    src={photo.path}
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
            setIncludedFieldIds((prev) => new Set(prev).add(field.id));
            setShowFieldModal(false);
          }}
        />
      )}
    </>
  );
}
