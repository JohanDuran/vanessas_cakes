"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { CAKE_STYLE_FIELD_SLUG, FIELD_TYPE_LABELS, SIZE_FIELD_SLUG, fieldHasOptions, type CakeStyleKind, type DesignKind, type FieldType, type TierLevelCount } from "../../lib/fields";
import { applyCakeStyleRules, buildCakeStyleContext, currentStyleKind } from "../../lib/cakeStyle";
import { getHiddenOptionIds, resolveAnswers, selectionsViolateConstraints, type ConstraintPair } from "../../lib/constraints";
import { computeTotalCents, formatCents, type Answers, type PriceableField } from "../../lib/pricing";
import { saveDesign, deleteDesignPhoto, setPrimaryPhoto } from "../../app/admin/(protected)/designs/actions";
import type { DesignTierPresetSummary } from "../../app/admin/(protected)/designs/tierPresetSummary";
import { useToast } from "../ToastProvider";
import SubmitButton from "../SubmitButton";
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
  /** admin-controlled: always shown in every design's configuration list,
   *  and seeds that design's "Required" checkbox as checked by default. */
  isBase: boolean;
  active: boolean;
  additionalPriceCents: number;
  options: FieldOptionSummary[];
};

type Photo = { id: number; path: string; isPrimary: boolean };

export type CategorySummary = { id: number; name: string };

type Props = {
  fields: FieldSummary[];
  tierPresets?: DesignTierPresetSummary[];
  categories?: CategorySummary[];
  /** admin-defined incompatible-option pairs — filtered out of every
   *  selector below so a design's own defaults can never combine two
   *  options marked incompatible in Constraints (see saveDesign's matching
   *  server-side check). */
  constraintPairs?: ConstraintPair[];
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
    published: boolean;
    fieldValues: Answers;
    lockedFieldIds: number[];
    /** fields configured but never shown to the customer — admin reference only */
    hiddenFieldIds: number[];
    /** fields the customer must answer for this design specifically */
    requiredFieldIds: number[];
    excludedOptionIds: number[];
    categoryIds: number[];
    /** every field this design uses, whether or not a default value was
     *  given — see DesignSummaryDTO.includedFieldIds */
    includedFieldIds: number[];
    photos: Photo[];
    /** this design's own price overrides — see DesignSummaryDTO for the
     *  same shape. Empty for a design that's never had any set. */
    optionPriceOverrides: Record<number, number>;
    fieldPriceOverrides: Record<number, number>;
    perSizeFieldPrices: Record<number, Record<number, number>>;
    optionSizePrices: Record<number, Record<number, number>>;
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

export default function DesignForm({ fields, tierPresets = [], categories = [], constraintPairs = [], portfolioPhoto, design }: Props) {
  const { push: pushToast } = useToast();
  // new designs are always catalog — the two quote-kind designs are seeded
  // once and only ever reached through their own edit pages, never created here
  const isCatalog = !design || design.kind === "catalog";
  // shown by default: base fields (admin-flagged in Design Fields) plus, when
  // editing, whatever this design already uses — everything else stays
  // hidden until picked from the "Add existing field" dropdown below, so the
  // form doesn't get more crowded every time a new custom field is added
  const [availableFields, setAvailableFields] = useState<FieldSummary[]>(() =>
    fields.filter((f) => f.isBase || (design?.includedFieldIds.includes(f.id) ?? false))
  );
  // fields that exist in the catalog but aren't currently shown in this
  // design's configuration — offered via the "Add existing field" dropdown.
  // Not to be confused with hiddenFieldIds below (fields shown here but kept
  // invisible to the *customer*, admin reference only).
  const unaddedFields = useMemo(
    () => fields.filter((f) => !availableFields.some((af) => af.id === f.id)),
    [fields, availableFields]
  );
  const addExistingField = (fieldId: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setAvailableFields((prev) => [...prev, field]);
    setDrafts((prev) => (prev[field.id] ? prev : { ...prev, [field.id]: { optionIds: [], text: "", number: "" } }));
    setIncludedFieldIds((prev) => new Set(prev).add(field.id));
    if (field.isBase) setRequiredFieldIds((prev) => new Set(prev).add(field.id));
    setActiveFieldId(field.id);
  };
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const init: Record<number, Draft> = {};
    for (const f of fields) init[f.id] = draftFromAnswer(design?.fieldValues[f.id]);
    // a brand-new design defaults Cake Style to Standard — a starting point
    // the admin can change, not a stored setting; silently skipped if the
    // field or its Standard option isn't present (e.g. removed from the catalog)
    if (!design) {
      const styleField = fields.find((f) => f.slug === CAKE_STYLE_FIELD_SLUG);
      const standardOption = styleField?.options.find((o) => o.styleKind === "standard");
      if (styleField && standardOption) {
        init[styleField.id] = { ...init[styleField.id], optionIds: [standardOption.id] };
      }
    }
    return init;
  });
  // a brand-new design starts with every base field pre-checked (matching
  // the old always-included behavior, admin can uncheck from there); an
  // existing design's checked set is whatever it actually includes
  const [includedFieldIds, setIncludedFieldIds] = useState<Set<number>>(
    () => new Set(fields.filter((f) => (design ? design.includedFieldIds.includes(f.id) : f.isBase)).map((f) => f.id))
  );
  const [lockedFieldIds, setLockedFieldIds] = useState<Set<number>>(() => {
    if (design) return new Set(design.lockedFieldIds);
    // pairs with the Standard default above — same rule: a default the
    // admin can uncheck, not a stored setting; no-op if the field is missing
    const styleField = fields.find((f) => f.slug === CAKE_STYLE_FIELD_SLUG);
    return new Set(styleField ? [styleField.id] : []);
  });
  // fields configured but never shown to the customer anywhere — admin
  // reference only (see design_hidden_fields)
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<number>>(
    () => new Set(design?.hiddenFieldIds ?? [])
  );
  // fields the customer must answer for this design — defaults to whatever
  // Design Fields flagged as a base field for a brand-new design, fully editable
  // either way (see design_required_fields)
  const [requiredFieldIds, setRequiredFieldIds] = useState<Set<number>>(
    () =>
      new Set(
        design
          ? design.requiredFieldIds
          : fields.filter((f) => f.isBase).map((f) => f.id)
      )
  );
  const [excludedOptionIds, setExcludedOptionIds] = useState<Set<number>>(
    new Set(design?.excludedOptionIds ?? [])
  );
  const [showFieldModal, setShowFieldModal] = useState(false);

  // Which field's full configuration is shown in the detail pane — the admin
  // configures one field at a time (like the customer's own order wizard)
  // instead of scrolling a long list of every field at once. Falls back to
  // the first available field whenever the id it's pointed at disappears
  // (there's no removal today, but a brand-new design with zero fields yet
  // starts with none selected either way).
  const [activeFieldId, setActiveFieldId] = useState<number | null>(() => availableFields[0]?.id ?? null);
  const activeField = availableFields.find((f) => f.id === activeFieldId) ?? availableFields[0];
  const activeFieldIndex = activeField ? availableFields.findIndex((f) => f.id === activeField.id) : -1;

  // Reordering here only changes the array order (rendered as hidden
  // `fieldOrder` inputs below, in this exact order) — this is purely this
  // design's own display order (see design_field_order), never the global
  // catalog field order.
  const moveField = (fieldId: number, direction: -1 | 1) => {
    setAvailableFields((prev) => {
      const idx = prev.findIndex((f) => f.id === fieldId);
      const swapIdx = idx + direction;
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  // Hidden and Required can't both be true for the same field — a field the
  // customer never sees can't also be something they're forced to answer.
  // Checking "Hide" always wins and clears "Required"; the Required checkbox
  // is disabled below while a field is hidden so it can't be re-checked.
  const toggleHidden = (fieldId: number) => {
    setHiddenFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
        setRequiredFieldIds((prevRequired) => {
          if (!prevRequired.has(fieldId)) return prevRequired;
          const nextRequired = new Set(prevRequired);
          nextRequired.delete(fieldId);
          return nextRequired;
        });
      }
      return next;
    });
  };

  const toggleRequired = (fieldId: number) => {
    if (hiddenFieldIds.has(fieldId)) return;
    setRequiredFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  // This design's own price for each option — defaults to the design's
  // existing override, or the catalog price if it's never had one. Seeded
  // from the full `fields` prop (not just availableFields) so a field
  // picked later from "Add existing field" already has a draft ready.
  const [optionPriceDrafts, setOptionPriceDrafts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const f of fields) {
      for (const o of f.options) {
        init[o.id] = ((design?.optionPriceOverrides[o.id] ?? o.priceCents) / 100).toFixed(2);
      }
    }
    return init;
  });
  // Same idea, for text/number/per_size fields' single flat price.
  const [fieldPriceDrafts, setFieldPriceDrafts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const f of fields) {
      if (fieldHasOptions(f.type)) continue;
      init[f.id] = ((design?.fieldPriceOverrides[f.id] ?? f.additionalPriceCents) / 100).toFixed(2);
    }
    return init;
  });
  // per_size fields this design has made size-varying — presence in this set
  // means design_field_size_prices rows get written for it instead of the
  // flat fieldPriceDrafts value (see saveDesign)
  const [sizeVaryingFieldIds, setSizeVaryingFieldIds] = useState<Set<number>>(
    () =>
      new Set(
        fields
          .filter((f) => f.type === "per_size" && Object.keys(design?.perSizeFieldPrices[f.id] ?? {}).length > 0)
          .map((f) => f.id)
      )
  );
  const sizeField = fields.find((f) => f.slug === SIZE_FIELD_SLUG);
  const [perSizePriceDrafts, setPerSizePriceDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      if (f.type !== "per_size") continue;
      for (const sizeOpt of sizeField?.options ?? []) {
        const existing = design?.perSizeFieldPrices[f.id]?.[sizeOpt.id];
        const fallback = design?.fieldPriceOverrides[f.id] ?? f.additionalPriceCents;
        init[`${f.id}:${sizeOpt.id}`] = ((existing ?? fallback) / 100).toFixed(2);
      }
    }
    return init;
  });
  const toggleSizeVarying = (fieldId: number) => {
    setSizeVaryingFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  // Regular select fields (e.g. Filling) whose *options* this design has
  // made size-varying — a field-level checkbox turns every one of its
  // options into a size x price grid instead of one flat price each (see
  // design_option_size_prices). Distinct from sizeVaryingFieldIds above,
  // which is only for per_size-type fields (no options of their own).
  const [optionSizeVaryingFieldIds, setOptionSizeVaryingFieldIds] = useState<Set<number>>(
    () =>
      new Set(
        fields
          .filter((f) => f.options.some((o) => Object.keys(design?.optionSizePrices[o.id] ?? {}).length > 0))
          .map((f) => f.id)
      )
  );
  const [optionSizePriceDrafts, setOptionSizePriceDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      if (!fieldHasOptions(f.type)) continue;
      for (const opt of f.options) {
        for (const sizeOpt of sizeField?.options ?? []) {
          const existing = design?.optionSizePrices[opt.id]?.[sizeOpt.id];
          const fallback = design?.optionPriceOverrides[opt.id] ?? opt.priceCents;
          init[`${opt.id}:${sizeOpt.id}`] = ((existing ?? fallback) / 100).toFixed(2);
        }
      }
    }
    return init;
  });
  const toggleOptionSizeVarying = (fieldId: number) => {
    setOptionSizeVaryingFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

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

  const checkAllExcluded = (optionIds: number[]) => {
    setExcludedOptionIds((prev) => new Set([...prev, ...optionIds]));
  };

  const uncheckAllExcluded = (optionIds: number[]) => {
    setExcludedOptionIds((prev) => {
      const next = new Set(prev);
      for (const id of optionIds) next.delete(id);
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

  // this design's own drafted prices, not the catalog ones — keeps the
  // standard-price preview below in sync with whatever the admin is
  // currently typing into the "Prices for this design" inputs
  const allOptionsFlat = useMemo(
    () =>
      availableFields.flatMap((f) =>
        f.options.map((o) => ({
          id: o.id,
          fieldId: f.id,
          priceCents: Math.round(Number(optionPriceDrafts[o.id] ?? "0") * 100),
        }))
      ),
    [availableFields, optionPriceDrafts]
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

  // Size is often locked to force one fixed size for the whole design — in
  // that case there's only ever one size a customer could get, so every
  // by-size price grid (for Filling, Frosting, etc.) should offer just that
  // one column instead of every size the drafted cake style has.
  const sizeFieldLocked = sizeField ? lockedFieldIds.has(sizeField.id) : false;
  const lockedSizeOptionId = sizeFieldLocked ? drafts[sizeField!.id]?.optionIds[0] : undefined;
  // this design's own visible sizes, for the drafted cake style — a size
  // this design has hidden from customers (excludedOptionIds) never needs
  // its own price configured anywhere, and when Size is locked there's only
  // ever the one size to price for. Shared by both the Size field's own
  // price table and every other field's "vary by cake size" grid, so the
  // two always agree on which sizes actually apply to this design.
  const visibleSizeOptions = (sizeField?.options ?? [])
    .filter((opt) => opt.styleKind === styleKind)
    .filter((opt) => !excludedOptionIds.has(opt.id))
    .filter((opt) => lockedSizeOptionId == null || opt.id === lockedSizeOptionId);

  // mirrors the order wizard's resolveAll: a `size` default left over from a
  // different cake_style (picked before a later style change, or inherited
  // from stale data) must not linger in the draft, or the price preview and
  // the visible dropdown would disagree about what's actually selected.
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
  // below never double-counts a stale, no-longer-selectable size option.
  // Constraint pairs are resolved first, same order the wizard applies them in.
  const effectiveAnswers: Answers = useMemo(() => {
    const afterConstraints = resolveAnswers(currentAnswers, constraintPairs);
    return cakeStyleCtx ? applyCakeStyleRules(afterConstraints, cakeStyleCtx) : afterConstraints;
  }, [currentAnswers, cakeStyleCtx, constraintPairs]);

  // an admin-picked default that conflicts with a constraint pair (e.g. after
  // changing a different field's default to something incompatible) must not
  // linger in the draft — otherwise Save fails server-side with the whole
  // form reset (see saveDesign's matching check). Mirrors the size-clearing
  // effect above: keeps the visible selects/checkboxes, the drafted state,
  // and validation all in agreement.
  useEffect(() => {
    const resolved = resolveAnswers(currentAnswers, constraintPairs);
    for (const field of availableFields) {
      const before = currentAnswers[field.id];
      if (before?.type !== "options") continue;
      const after = resolved[field.id];
      const afterIds = after?.type === "options" ? after.optionIds : [];
      if (before.optionIds.length !== afterIds.length || before.optionIds.some((id) => !afterIds.includes(id))) {
        setDraft(field.id, { optionIds: afterIds });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnswers, constraintPairs]);

  const allFieldsFlat: PriceableField[] = useMemo(
    () =>
      availableFields.map((f) => ({
        id: f.id,
        additionalPriceCents: Math.round(Number(fieldPriceDrafts[f.id] ?? "0") * 100),
      })),
    [availableFields, fieldPriceDrafts]
  );

  // This design's price for its own default selections — there's no
  // separate "charged price" or premium anymore, this simply *is* the
  // price (see lib/pricing.ts's computeTotalCents). per_size/size-varying
  // fields never have a default answer (see currentAnswers above), so they
  // never factor into this preview — matches what a customer sees before
  // opting into any addon.
  const totalCents = useMemo(
    () => computeTotalCents(effectiveAnswers, allOptionsFlat, allFieldsFlat),
    [effectiveAnswers, allOptionsFlat, allFieldsFlat]
  );

  // The detail pane only shows one field's interactive controls at a time
  // (see the field-wizard below) — every *other* field's current state still
  // has to reach saveDesign somehow, so this renders the same set of form
  // inputs the old all-at-once layout used to render inline, as hidden
  // inputs, for whichever field isn't the one currently on screen. Without
  // this, submitting would silently drop every field except the active one
  // (caught the hard way: saving after switching fields threw "Cake Style
  // and Size must be enabled or disabled together" because only one of the
  // pair still had an `includedFieldIds` input in the DOM).
  const renderFieldStateInputs = (field: FieldSummary) => {
    if (!includedFieldIds.has(field.id)) return null;
    const isLocked = lockedFieldIds.has(field.id);
    const draft = drafts[field.id] ?? { optionIds: [], text: "", number: "" };
    const hasOptions = fieldHasOptions(field.type);
    const isSizeField = field.slug === SIZE_FIELD_SLUG;
    const isCakeStyleField = field.slug === CAKE_STYLE_FIELD_SLUG;
    const priceableOptions = isSizeField ? visibleSizeOptions : field.options.filter((opt) => !excludedOptionIds.has(opt.id));
    const styleFilteredSizeOptions = visibleSizeOptions;
    const isOptionSizeVarying = hasOptions && !isSizeField && !isCakeStyleField && optionSizeVaryingFieldIds.has(field.id);
    const isFieldSizeVarying = field.type === "per_size" && sizeVaryingFieldIds.has(field.id);

    return (
      <Fragment key={field.id}>
        <input type="hidden" name="includedFieldIds" value={field.id} />
        {isLocked && <input type="hidden" name="lockedFieldIds" value={field.id} />}
        {requiredFieldIds.has(field.id) && <input type="hidden" name="requiredFieldIds" value={field.id} />}
        {hiddenFieldIds.has(field.id) && <input type="hidden" name="hiddenFieldIds" value={field.id} />}

        {field.type === "single_select" && draft.optionIds[0] != null && (
          <input type="hidden" name={`option_${field.id}`} value={draft.optionIds[0]} />
        )}
        {field.type === "multi_select" &&
          draft.optionIds.map((id) => <input key={id} type="hidden" name={`options_${field.id}`} value={id} />)}
        {field.type === "text" && draft.text && <input type="hidden" name={`text_${field.id}`} value={draft.text} />}
        {field.type === "number" && draft.number !== "" && (
          <input type="hidden" name={`number_${field.id}`} value={draft.number} />
        )}

        {!isLocked &&
          hasOptions &&
          field.options
            .filter((opt) => excludedOptionIds.has(opt.id))
            .map((opt) => <input key={opt.id} type="hidden" name="excludedOptionIds" value={opt.id} />)}

        {isOptionSizeVarying && <input type="hidden" name="optionSizeVaryingFieldIds" value={field.id} />}
        {hasOptions &&
          (isOptionSizeVarying
            ? priceableOptions.flatMap((opt) =>
                styleFilteredSizeOptions.map((sizeOpt) => (
                  <input
                    key={`${opt.id}_${sizeOpt.id}`}
                    type="hidden"
                    name={`optionSizePrice_${opt.id}_${sizeOpt.id}`}
                    value={optionSizePriceDrafts[`${opt.id}:${sizeOpt.id}`] ?? ""}
                  />
                ))
              )
            : priceableOptions.map((opt) => (
                <input key={opt.id} type="hidden" name={`optionPrice_${opt.id}`} value={optionPriceDrafts[opt.id] ?? ""} />
              )))}

        {!hasOptions && !isFieldSizeVarying && (
          <input type="hidden" name={`fieldPrice_${field.id}`} value={fieldPriceDrafts[field.id] ?? ""} />
        )}
        {isFieldSizeVarying && (
          <>
            <input type="hidden" name="sizeVaryingFieldIds" value={field.id} />
            {styleFilteredSizeOptions.map((sizeOpt) => (
              <input
                key={sizeOpt.id}
                type="hidden"
                name={`sizePrice_${field.id}_${sizeOpt.id}`}
                value={perSizePriceDrafts[`${field.id}:${sizeOpt.id}`] ?? ""}
              />
            ))}
          </>
        )}
      </Fragment>
    );
  };

  // A disabled submit button — or a native HTML `required` attribute —
  // gives zero feedback when tapped: the browser just silently blocks the
  // submit (at most a small native tooltip on whichever field it stopped
  // at) and our own code never runs. So none of these inputs use native
  // `required` — this is the one place that validates them, and it always
  // says something back via a popup instead of failing silently.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const errors: string[] = [];

    if (!String(formData.get("name") ?? "").trim()) {
      errors.push("Design name is required.");
    }

    // belt-and-suspenders: the selectors above already filter out any option
    // that would conflict with another field's current default, so this
    // should be unreachable in normal use — but catching it here (instead of
    // letting saveDesign's matching check throw) avoids the full-page
    // redirect that would otherwise wipe out everything drafted in this form
    if (selectionsViolateConstraints(effectiveAnswers, constraintPairs)) {
      errors.push(
        "This combines two options marked incompatible in Constraints — fix it or remove that constraint first."
      );
    }

    // a brand-new design with no seed photo (no existing design, no
    // Portfolio pick) needs at least one photo of its own — editing or
    // coming from Portfolio already has one, so "Add more photos" stays optional
    if (!design && !portfolioPhoto) {
      const photoFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      if (photoFiles.length === 0) {
        errors.push("Add at least one photo.");
      }
    }

    if (errors.length === 0) return;
    e.preventDefault();
    errors.forEach((message) => pushToast("error", message));
  };

  return (
    <>
      <form
        action={saveDesign}
        onSubmit={handleSubmit}
        className="admin-card"
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        {design && <input type="hidden" name="id" value={design.id} />}
        {!design && portfolioPhoto && (
          <input type="hidden" name="portfolioPhotoId" value={portfolioPhoto.id} />
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
          <label>
            {design || portfolioPhoto ? "Add more photos" : "Photos"}
            {!design && !portfolioPhoto && <span className="field-type-tag">Required</span>}
          </label>
          <input type="file" name="photos" accept="image/*" multiple />
        </div>

        <div className="admin-form-row">
          <div className="admin-field" style={{ flex: 1, minWidth: 240 }}>
            <label>
              Design name
              <span className="field-type-tag">Required</span>
            </label>
            <input name="name" defaultValue={design?.name} style={{ width: "100%" }} />
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
          <h3 style={{ margin: 0 }}>Fields (quote tool)</h3>
          <p style={{ color: "var(--text-soft)", marginTop: 4, marginBottom: 14, fontSize: "0.9rem" }}>
            Configure one field at a time — pick it from the list, or use Previous/Next below.
            Giving a field a default pre-fills that answer for the customer, but it&apos;s
            optional — leave it blank if none applies. Mark a field Required to force the
            customer to answer it themselves. You can also lock a field so customers can&apos;t
            change it, hide it from the customer entirely, or hide specific options just for
            this design. Use the arrows to reorder fields — that&apos;s the order customers see
            them in too.
          </p>

          {/* this design's own field display order — one hidden input per
             field, in the exact order shown in the nav list below (see
             moveField); saveDesign persists this as design_field_order */}
          {availableFields.map((field) => (
            <input key={field.id} type="hidden" name="fieldOrder" value={field.id} />
          ))}
          {availableFields.filter((f) => f.id !== activeField?.id).map((field) => renderFieldStateInputs(field))}

          <div className="field-wizard">
            <div className="field-wizard__nav">
              <div className="field-wizard__nav-header">
                <span className="field-wizard__nav-count">
                  {availableFields.length} field{availableFields.length === 1 ? "" : "s"}
                </span>
                <div className="field-wizard__nav-add">
                  {unaddedFields.length > 0 && (
                    <select
                      value=""
                      aria-label="Add an existing field"
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        if (id) addExistingField(id);
                      }}
                    >
                      <option value="">+ Add existing field…</option>
                      {unaddedFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="admin-btn-sm admin-btn-sm--ghost" onClick={() => setShowFieldModal(true)}>
                    + Add Field
                  </button>
                </div>
              </div>

              <ol className="field-wizard__nav-list">
                {availableFields.map((field, idx) => {
                  const included = includedFieldIds.has(field.id);
                  return (
                    <li
                      key={field.id}
                      className={`field-wizard__nav-item ${activeField?.id === field.id ? "is-active" : ""} ${
                        included ? "" : "is-not-included"
                      }`}
                    >
                      <button type="button" className="field-wizard__nav-item-btn" onClick={() => setActiveFieldId(field.id)}>
                        <span className="field-wizard__nav-item-name">{field.name}</span>
                        <span className="field-wizard__nav-item-badges">
                          {!included && <span>not included</span>}
                          {included && lockedFieldIds.has(field.id) && <span title="Locked">🔒</span>}
                          {included && requiredFieldIds.has(field.id) && <span title="Required">❗</span>}
                          {included && hiddenFieldIds.has(field.id) && <span title="Hidden from customer">🙈</span>}
                        </span>
                      </button>
                      <div className="field-wizard__nav-reorder">
                        <button
                          type="button"
                          aria-label={`Move ${field.name} up`}
                          disabled={idx === 0}
                          onClick={() => moveField(field.id, -1)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${field.name} down`}
                          disabled={idx === availableFields.length - 1}
                          onClick={() => moveField(field.id, 1)}
                        >
                          ▼
                        </button>
                      </div>
                    </li>
                  );
                })}
                {availableFields.length === 0 && <li className="field-wizard__nav-empty">No fields yet.</li>}
              </ol>
            </div>

            <div className="field-wizard__detail">
              {!activeField && (
                <p style={{ color: "var(--text-soft)" }}>No fields defined yet — add one above.</p>
              )}
              {activeField &&
                (() => {
              const field = activeField;
              const isIncluded = includedFieldIds.has(field.id);
              const isLocked = lockedFieldIds.has(field.id);
              const isPaired = PAIRED_INCLUSION_SLUGS.has(field.slug);
              const draft = drafts[field.id] ?? { optionIds: [], text: "", number: "" };
              const hasOptions = fieldHasOptions(field.type);
              const isSizeField = field.slug === SIZE_FIELD_SLUG;
              // cake_style drives which sizes even exist (see cakeStyle.ts) —
              // varying its own option prices by size makes no sense, so it
              // never gets the "vary by cake size" control size fields get
              const isCakeStyleField = field.slug === CAKE_STYLE_FIELD_SLUG;
              // options that would combine with this design's *other* current
              // defaults to form a pair marked incompatible in Constraints —
              // never offered as a pick for this field's own default (see
              // saveDesign's matching server-side check)
              const constraintHiddenIds = getHiddenOptionIds(field.id, effectiveAnswers, constraintPairs);
              const hideableOptions = field.options
                .filter((opt) => !draft.optionIds.includes(opt.id))
                // size options are scoped to the drafted Cake Style, same as
                // selectableOptions below — hiding an option only makes sense
                // for sizes that could actually be picked for this style
                .filter((opt) => !isSizeField || opt.styleKind === styleKind)
                .map((opt) => ({ ...opt, label: opt.name }));
              const selectableOptions = (
                isSizeField ? field.options.filter((opt) => opt.styleKind === styleKind) : field.options
              ).filter((opt) => !constraintHiddenIds.has(opt.id));
              // this design's currently-visible sizes — excludes anything
              // hidden for this design, and collapses to the one locked size
              // when Size can't be changed — used for every price table
              // below that's keyed by size, so a style change (or excluding
              // a size, or locking Size) hides prices for sizes that no
              // longer apply, same as the option pickers above
              const styleFilteredSizeOptions = visibleSizeOptions;
              // this field's own options, scoped the same way — its own
              // price table when it's the size field itself, or with any
              // option this design has hidden dropped otherwise (an
              // excluded option never needs its own price row)
              const priceableOptions = isSizeField ? visibleSizeOptions : field.options.filter((opt) => !excludedOptionIds.has(opt.id));

              return (
                <div className="field-wizard__detail-card">
                  <span className="field-wizard__detail-progress">
                    Field {activeFieldIndex + 1} of {availableFields.length}
                  </span>
                  <div className="recipe-axis-row__main">
                    <label>
                      {field.name}
                      {!field.isBase && <span className="field-type-tag">{FIELD_TYPE_LABELS[field.type]}</span>}
                      {!field.active && " (inactive)"}
                      {(field.type === "text" || field.type === "number" || field.type === "per_size") &&
                        field.additionalPriceCents > 0 && (
                          <span className="field-type-tag">catalog default +{formatCents(field.additionalPriceCents)}</span>
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
                            ? `No ${styleKind} sizes configured yet — add some from Design Fields.`
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

                    {isIncluded && field.type === "per_size" && (
                      <span style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
                        No default needed — the customer opts in or out; set its price below.
                      </span>
                    )}

                  </div>

                  {isIncluded && field.type === "multi_select" && (
                    <div className="recipe-axis-row__exclude">
                      <span className="recipe-axis-row__exclude-label">Default selection:</span>
                      <div className="recipe-axis-row__exclude-list">
                        {field.options
                          .filter((opt) => !constraintHiddenIds.has(opt.id))
                          .map((opt) => (
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
                            No options yet — add some from Design Fields.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isIncluded && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
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
                      <label
                        className="recipe-axis-row__lock"
                        title={hiddenFieldIds.has(field.id) ? "A hidden field can't also be required — uncheck \"Hide from customer\" first." : undefined}
                      >
                        <input
                          type="checkbox"
                          name="requiredFieldIds"
                          value={field.id}
                          checked={requiredFieldIds.has(field.id)}
                          disabled={hiddenFieldIds.has(field.id)}
                          onChange={() => toggleRequired(field.id)}
                        />
                        Required — customer must answer
                      </label>
                      <label className="recipe-axis-row__lock">
                        <input
                          type="checkbox"
                          name="hiddenFieldIds"
                          value={field.id}
                          checked={hiddenFieldIds.has(field.id)}
                          onChange={() => toggleHidden(field.id)}
                        />
                        🙈 Hide from customer (admin reference only)
                      </label>
                    </div>
                  )}

                  {isIncluded && !isLocked && hasOptions && (
                    <div className="recipe-axis-row__exclude">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="recipe-axis-row__exclude-label">Hide specific options for this design:</span>
                        {hideableOptions.length > 0 && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="admin-btn-sm admin-btn-sm--ghost"
                              onClick={() => checkAllExcluded(hideableOptions.map((opt) => opt.id))}
                            >
                              Check all
                            </button>
                            <button
                              type="button"
                              className="admin-btn-sm admin-btn-sm--ghost"
                              onClick={() => uncheckAllExcluded(hideableOptions.map((opt) => opt.id))}
                            >
                              Uncheck all
                            </button>
                          </div>
                        )}
                      </div>
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

                  {isIncluded && hasOptions && (
                    <div className="recipe-axis-row__exclude">
                      <span className="recipe-axis-row__exclude-label">Prices for this design:</span>
                      {!isSizeField && !isCakeStyleField && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 8px" }}>
                          <input
                            type="checkbox"
                            name="optionSizeVaryingFieldIds"
                            value={field.id}
                            checked={optionSizeVaryingFieldIds.has(field.id)}
                            onChange={() => toggleOptionSizeVarying(field.id)}
                          />
                          Vary these prices by cake size
                        </label>
                      )}
                      {priceableOptions.length === 0 ? (
                        <span style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>
                          No options yet — add some from Design Fields.
                        </span>
                      ) : !isSizeField && !isCakeStyleField && optionSizeVaryingFieldIds.has(field.id) ? (
                        <div className="price-table-wrap">
                          <table className="price-table">
                            <thead>
                              <tr>
                                <th>Option</th>
                                {styleFilteredSizeOptions.map((sizeOpt) => (
                                  <th key={sizeOpt.id}>{sizeOpt.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {priceableOptions.map((opt) => (
                                <tr key={opt.id}>
                                  <td>{opt.name}</td>
                                  {styleFilteredSizeOptions.map((sizeOpt) => (
                                    <td key={sizeOpt.id}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        name={`optionSizePrice_${opt.id}_${sizeOpt.id}`}
                                        value={optionSizePriceDrafts[`${opt.id}:${sizeOpt.id}`] ?? ""}
                                        onChange={(e) =>
                                          setOptionSizePriceDrafts((prev) => ({
                                            ...prev,
                                            [`${opt.id}:${sizeOpt.id}`]: e.target.value,
                                          }))
                                        }
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {styleFilteredSizeOptions.length === 0 && (
                                <tr>
                                  <td colSpan={2} style={{ color: "var(--text-soft)" }}>
                                    Pick a Cake Style with sizes configured first.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="price-table-wrap">
                          <table className="price-table">
                            <thead>
                              <tr>
                                <th>Option</th>
                                <th>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {priceableOptions.map((opt) => (
                                <tr key={opt.id}>
                                  <td>{opt.name}</td>
                                  <td>
                                    <input
                                      type="number"
                                      step="0.01"
                                      name={`optionPrice_${opt.id}`}
                                      value={optionPriceDrafts[opt.id] ?? ""}
                                      onChange={(e) =>
                                        setOptionPriceDrafts((prev) => ({ ...prev, [opt.id]: e.target.value }))
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {isIncluded && !hasOptions && (
                    <div className="recipe-axis-row__exclude">
                      <span className="recipe-axis-row__exclude-label">
                        {field.type === "per_size" ? "Flat price for this design:" : "Price for this design:"}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        name={`fieldPrice_${field.id}`}
                        value={fieldPriceDrafts[field.id] ?? ""}
                        onChange={(e) => setFieldPriceDrafts((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        style={{ width: 80 }}
                        disabled={field.type === "per_size" && sizeVaryingFieldIds.has(field.id)}
                      />
                    </div>
                  )}

                  {isIncluded && field.type === "per_size" && (
                    <div className="recipe-axis-row__exclude">
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          name="sizeVaryingFieldIds"
                          value={field.id}
                          checked={sizeVaryingFieldIds.has(field.id)}
                          onChange={() => toggleSizeVarying(field.id)}
                        />
                        Vary this price by cake size instead
                      </label>
                      {sizeVaryingFieldIds.has(field.id) && (
                        <div className="price-table-wrap">
                          <table className="price-table">
                            <thead>
                              <tr>
                                {styleFilteredSizeOptions.map((sizeOpt) => (
                                  <th key={sizeOpt.id}>{sizeOpt.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {styleFilteredSizeOptions.map((sizeOpt) => (
                                  <td key={sizeOpt.id}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      name={`sizePrice_${field.id}_${sizeOpt.id}`}
                                      value={perSizePriceDrafts[`${field.id}:${sizeOpt.id}`] ?? ""}
                                      onChange={(e) =>
                                        setPerSizePriceDrafts((prev) => ({
                                          ...prev,
                                          [`${field.id}:${sizeOpt.id}`]: e.target.value,
                                        }))
                                      }
                                    />
                                  </td>
                                ))}
                                {styleFilteredSizeOptions.length === 0 && (
                                  <td style={{ color: "var(--text-soft)" }}>
                                    Pick a Cake Style with sizes configured first.
                                  </td>
                                )}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="field-wizard__detail-nav">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={activeFieldIndex <= 0}
                      onClick={() => setActiveFieldId(availableFields[activeFieldIndex - 1].id)}
                    >
                      ← Previous field
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={activeFieldIndex === -1 || activeFieldIndex >= availableFields.length - 1}
                      onClick={() => setActiveFieldId(availableFields[activeFieldIndex + 1].id)}
                    >
                      Next field →
                    </button>
                  </div>
                </div>
              );
                })()}
            </div>
          </div>
        </div>

        {isCatalog && (
          <div className="admin-field">
            <label>Price for the default selections above</label>
            <div style={{ padding: "9px 0", fontWeight: 600 }}>{formatCents(totalCents)}</div>
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", margin: "4px 0 0" }}>
              This is exactly what a customer pays for this design's defaults — set prices per
              field/option above to change it. There&apos;s no separate charged price to type in.
            </p>
          </div>
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

        <div>
          <SubmitButton pendingLabel={design ? "Saving…" : "Creating…"}>
            {design ? "Save Design" : "Create Design"}
          </SubmitButton>
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
            setOptionPriceDrafts((prev) => {
              const next = { ...prev };
              for (const o of field.options) next[o.id] = (o.priceCents / 100).toFixed(2);
              return next;
            });
            setOptionSizePriceDrafts((prev) => {
              const next = { ...prev };
              for (const o of field.options) {
                for (const sizeOpt of sizeField?.options ?? []) {
                  next[`${o.id}:${sizeOpt.id}`] = (o.priceCents / 100).toFixed(2);
                }
              }
              return next;
            });
            if (!fieldHasOptions(field.type)) {
              setFieldPriceDrafts((prev) => ({ ...prev, [field.id]: (field.additionalPriceCents / 100).toFixed(2) }));
            }
            setActiveFieldId(field.id);
            setShowFieldModal(false);
          }}
        />
      )}
    </>
  );
}
