"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO } from "../../lib/order-types";
import { getHiddenOptionIds, resolveAnswers, type ConstraintPair } from "../../lib/constraints";
import {
  applyCakeStyleRules,
  buildCakeStyleContext,
  currentStyleKind,
  sizeOptionsForStyle,
  type CakeStyleContext,
} from "../../lib/cakeStyle";
import { computeTotalCents, formatCents, resolveFieldPriceCents, type Answers } from "../../lib/pricing";
import { SIZE_FIELD_SLUG } from "../../lib/fields";
import { useCart } from "../../lib/cart/CartContext";
import DesignPhotoCarousel from "../../components/order/DesignPhotoCarousel";
import FieldOptionStep from "../../components/order/steps/FieldOptionStep";
import TierPresetStep from "../../components/order/steps/TierPresetStep";
import TextFieldStep from "../../components/order/steps/TextFieldStep";
import NumberFieldStep from "../../components/order/steps/NumberFieldStep";
import ToggleFieldStep from "../../components/order/steps/ToggleFieldStep";
import CustomCakeQuoteStep from "../../components/order/steps/CustomCakeQuoteStep";
import OrderSummaryPanel from "../../components/order/OrderSummaryPanel";

type Props = {
  fields: FieldDTO[];
  options: FieldOptionDTO[];
  designs: DesignSummaryDTO[];
  constraintPairs: ConstraintPair[];
  tierPresets: TierPresetDTO[];
  /** When set (gallery entry point, or either Custom Cake entry point), the
   *  design step is skipped and locked. Every route that renders this wizard
   *  supplies one — catalog designs, and the two singleton quote-kind
   *  designs ("Custom Cake" / "Custom Cake — From a Photo", see
   *  src/app/order/custom/page.tsx). */
  lockedDesign?: DesignSummaryDTO;
  /** When set alongside lockedDesign, pre-selects this size before the wizard opens. */
  initialSizeId?: number;
  /** When set (a Portfolio photo's "Get a Quote" button), that photo is locked in
   *  as the custom quote's sole reference image and attachments are disabled. */
  portfolioReferenceImage?: { id: number; path: string } | null;
};

type State = {
  designId: number | null;
  answers: Answers;
  // 0 = design picker, 1 = custom-cake quote step (only when the resolved
  // design's kind !== "catalog"), then one step per design field, then
  // review — see FIELD_STEP_START/REVIEW_STEP below
  step: number;
  // highest step index the customer has validated their way past (via Next),
  // or Infinity when editing an already-completed cart item. Anything up to
  // this mark is "unlocked" and can be jumped to directly, in either
  // direction, from the stepper — Next/Back still move one step at a time.
  maxStepReached: number;
};

type Action =
  | { type: "SELECT_DESIGN"; design: DesignSummaryDTO }
  | { type: "SET_OPTIONS"; fieldId: number; optionIds: number[] }
  | { type: "SET_TEXT"; fieldId: number; value: string }
  | { type: "SET_NUMBER"; fieldId: number; value: string }
  | { type: "SET_TOGGLE"; fieldId: number; value: boolean }
  | { type: "GOTO"; step: number };

/** A design's actual fields: whichever fields (base or custom) the admin
 *  included for this design, in canonical/catalog order — see
 *  DesignForm's unified "Include in this design" checkbox. */
function fieldsForDesign(fields: FieldDTO[], design: DesignSummaryDTO): FieldDTO[] {
  return fields.filter((f) => design.includedFieldIds.includes(f.id));
}

/** Whether the customer has actually answered this field — used to gate the
 *  Next button for single_select (always) and text/number fields marked
 *  Required. multi_select is never required-gated. */
function isFieldAnswered(field: FieldDTO, answer: Answers[number] | undefined): boolean {
  if (!answer) return false;
  if (field.type === "text") return answer.type === "text" && answer.value.trim() !== "";
  if (field.type === "number") return answer.type === "number";
  if (field.type === "per_size") return answer.type === "toggle";
  if (field.type === "single_select") return answer.type === "options" && answer.optionIds.length > 0;
  return true;
}

/** Step index reserved for the custom-cake quote step — only reachable when
 *  the resolved design's kind !== "catalog". */
const CUSTOM_STEP = 1;

/** The first step the wizard should actually land on for a locked design —
 *  skips past any fields the design locks (customer can't change them, so
 *  there's nothing to show), landing on the review step if every field is
 *  locked. Mirrors the skip rule goNext/goBack apply via navigableSteps,
 *  which the reducer's initial state can't reuse directly since it runs
 *  before the component body computes those. */
function firstFieldOrReviewStep(fields: FieldDTO[], design: DesignSummaryDTO): number {
  if (design.kind !== "catalog") return CUSTOM_STEP;
  const fieldStepStart = 1;
  const designFields = fieldsForDesign(fields, design);
  const lockedSet = new Set(design.lockedFieldIds);
  for (let i = 0; i < designFields.length; i++) {
    if (!lockedSet.has(designFields[i].id)) return fieldStepStart + i;
  }
  return fieldStepStart + designFields.length; // every field locked -> straight to review
}

/** Runs both answer-consistency passes in sequence: clearing options excluded
 *  by admin-defined constraint pairs, then clearing size/tier-size answers
 *  left stale by a live cake_style/tier_levels switch. Must run on every
 *  answer-changing action, not just the tier-specific ones — e.g. a customer
 *  who picks Size=Large then switches Style to Tiered must not carry that
 *  stale size answer into the price total or the review step. */
function resolveAll(answers: Answers, pairs: ConstraintPair[], cakeStyleCtx: CakeStyleContext | null): Answers {
  const afterConstraints = resolveAnswers(answers, pairs);
  return cakeStyleCtx ? applyCakeStyleRules(afterConstraints, cakeStyleCtx) : afterConstraints;
}

function makeReducer(pairs: ConstraintPair[], cakeStyleCtx: CakeStyleContext | null) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "SELECT_DESIGN": {
        return {
          ...state,
          designId: action.design.id,
          answers: resolveAll({ ...action.design.fieldValues }, pairs, cakeStyleCtx),
          step: 1,
          maxStepReached: 1,
        };
      }
      case "SET_OPTIONS":
        return {
          ...state,
          answers: resolveAll(
            { ...state.answers, [action.fieldId]: { type: "options", optionIds: action.optionIds } },
            pairs,
            cakeStyleCtx
          ),
        };
      case "SET_TEXT":
        return {
          ...state,
          answers: { ...state.answers, [action.fieldId]: { type: "text", value: action.value } },
        };
      case "SET_NUMBER": {
        if (action.value === "") {
          const next = { ...state.answers };
          delete next[action.fieldId];
          return { ...state, answers: next };
        }
        return {
          ...state,
          answers: { ...state.answers, [action.fieldId]: { type: "number", value: Number(action.value) } },
        };
      }
      case "SET_TOGGLE":
        return {
          ...state,
          answers: { ...state.answers, [action.fieldId]: { type: "toggle", value: action.value } },
        };
      case "GOTO":
        return { ...state, step: action.step, maxStepReached: Math.max(state.maxStepReached, action.step) };
      default:
        return state;
    }
  };
}

export default function OrderWizard({
  fields,
  options,
  designs,
  constraintPairs,
  tierPresets,
  lockedDesign,
  initialSizeId,
  portfolioReferenceImage,
}: Props) {
  const cakeStyleCtx = useMemo(
    () => buildCakeStyleContext(fields, options, tierPresets),
    [fields, options, tierPresets]
  );
  const reducer = useMemo(
    () => makeReducer(constraintPairs, cakeStyleCtx),
    [constraintPairs, cakeStyleCtx]
  );

  const sizeField = useMemo(() => fields.find((f) => f.slug === SIZE_FIELD_SLUG), [fields]);

  const cart = useCart();
  const searchParams = useSearchParams();
  const editingClientId = searchParams.get("cartItem");
  // captured once at mount — editing loads the cart item's own answers instead
  // of the design's defaults, but shouldn't keep re-reading the cart on every render
  const [editingItem] = useState(() => (editingClientId ? cart.getItem(editingClientId) : undefined));

  const [state, dispatch] = useReducer(reducer, undefined, (): State => {
    const answers =
      editingItem?.answers ??
      (lockedDesign
        ? {
            ...lockedDesign.fieldValues,
            ...(initialSizeId && sizeField ? { [sizeField.id]: { type: "options", optionIds: [initialSizeId] } } : {}),
          }
        : {});
    const initialStep = lockedDesign ? firstFieldOrReviewStep(fields, lockedDesign) : 0;
    return {
      designId: lockedDesign?.id ?? null,
      answers: resolveAll(answers, constraintPairs, cakeStyleCtx),
      step: initialStep,
      // editing an already-completed cart item means every step is already
      // filled in, so the whole flow is unlocked for jumping around
      maxStepReached: editingItem ? Infinity : initialStep,
    };
  });
  const [referenceImages, setReferenceImages] = useState<File[]>(editingItem?.referenceImages ?? []);
  const [lockedReferenceImagePath] = useState<string | null>(
    () => editingItem?.lockedReferenceImagePath ?? portfolioReferenceImage?.path ?? null
  );
  const router = useRouter();

  const selectedDesign = lockedDesign ?? designs.find((d) => d.id === state.designId) ?? null;
  const isQuote = selectedDesign != null && selectedDesign.kind !== "catalog";

  // this design's own prices, not the raw catalog ones — see
  // resolvePriceableOptions/resolvePriceableFields in lib/pricing.ts
  const resolvedOptions = useMemo(
    () =>
      selectedDesign
        ? options.map((o) => ({ ...o, priceCents: selectedDesign.optionPriceOverrides[o.id] ?? o.priceCents }))
        : options,
    [options, selectedDesign]
  );
  const resolvedFieldsFlat = useMemo(
    () =>
      selectedDesign
        ? fields.map((f) => ({
            id: f.id,
            additionalPriceCents: selectedDesign.fieldPriceOverrides[f.id] ?? f.additionalPriceCents,
          }))
        : fields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents })),
    [fields, selectedDesign]
  );

  const optionsByField = useMemo(() => {
    const map = new Map<number, FieldOptionDTO[]>();
    for (const f of fields) map.set(f.id, resolvedOptions.filter((o) => o.fieldId === f.id));
    return map;
  }, [fields, resolvedOptions]);

  const designFields = useMemo(
    () => (selectedDesign ? fieldsForDesign(fields, selectedDesign) : []),
    [fields, selectedDesign]
  );

  // step numbering: 0 is design, 1 is the custom-cake quote step (only when
  // isQuote), then one step per design field, then review
  const FIELD_STEP_START = isQuote ? CUSTOM_STEP + 1 : 1;
  const REVIEW_STEP = FIELD_STEP_START + designFields.length;

  const currentField =
    state.step >= FIELD_STEP_START && state.step < REVIEW_STEP
      ? designFields[state.step - FIELD_STEP_START]
      : null;
  const currentAnswer = currentField ? state.answers[currentField.id] : undefined;
  const isCustomQuoteStep = isQuote && state.step === CUSTOM_STEP;
  const isReview = state.step === REVIEW_STEP;

  const lockedFieldIdSet = useMemo(() => new Set(selectedDesign?.lockedFieldIds ?? []), [selectedDesign]);
  const excludedOptionIdSet = useMemo(
    () => new Set(selectedDesign?.excludedOptionIds ?? []),
    [selectedDesign]
  );

  const skippedFieldIdSet = lockedFieldIdSet;

  // the live style kind, used to pick which options/diagram the Size step shows
  const liveStyleKind = useMemo(
    () => (cakeStyleCtx ? currentStyleKind(state.answers, cakeStyleCtx) : undefined),
    [cakeStyleCtx, state.answers]
  );
  const isSizeStep = currentField?.slug === SIZE_FIELD_SLUG;
  const sizeStepOptions = useMemo(() => {
    if (!isSizeStep || !currentField || !cakeStyleCtx) return [];
    return sizeOptionsForStyle(optionsByField.get(currentField.id) ?? [], cakeStyleCtx, liveStyleKind).filter(
      (o) =>
        !getHiddenOptionIds(currentField.id, state.answers, constraintPairs).has(o.id) &&
        !excludedOptionIdSet.has(o.id)
    );
  }, [isSizeStep, currentField, cakeStyleCtx, liveStyleKind, optionsByField, state.answers, constraintPairs, excludedOptionIdSet]);

  // the sequence of steps a customer can actually land on for this design —
  // locked and conditionally-hidden fields are skipped entirely, not just disabled
  const navigableSteps = useMemo(() => {
    const fieldSteps = designFields
      .map((_, idx) => idx + FIELD_STEP_START)
      .filter((i) => !skippedFieldIdSet.has(designFields[i - FIELD_STEP_START].id));
    return [...(isQuote ? [CUSTOM_STEP] : []), ...fieldSteps, REVIEW_STEP];
  }, [designFields, skippedFieldIdSet, FIELD_STEP_START, REVIEW_STEP, isQuote]);

  const stepLabels = [
    "Design",
    ...(isQuote ? ["Custom Cake Quote"] : []),
    ...designFields.map((f) => f.name),
    "Review",
  ];
  const visibleSteps = stepLabels.map((label, i) => ({ label, i })).filter(({ i }) => {
    if (i === 0) return !lockedDesign;
    if (isQuote && i === CUSTOM_STEP) return true;
    if (i >= FIELD_STEP_START && i < REVIEW_STEP) return !skippedFieldIdSet.has(designFields[i - FIELD_STEP_START].id);
    return true;
  });

  // keeps the active breadcrumb chip scrolled into view on the mobile horizontal stepper
  const activeStepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [state.step]);

  const navProgressIdx = navigableSteps.indexOf(state.step);
  const progressPct =
    navigableSteps.length > 1 ? (Math.max(navProgressIdx, 0) / (navigableSteps.length - 1)) * 100 : 0;

  const goNext = () => {
    const idx = navigableSteps.indexOf(state.step);
    const next = idx >= 0 && idx < navigableSteps.length - 1 ? navigableSteps[idx + 1] : state.step;
    dispatch({ type: "GOTO", step: next });
  };
  const goBack = () => {
    const idx = navigableSteps.indexOf(state.step);
    const prev = idx > 0 ? navigableSteps[idx - 1] : state.step;
    dispatch({ type: "GOTO", step: prev });
  };

  // per_size fields price off whichever `size` option is currently answered
  // for this design, if any
  const currentSizeOptionId = useMemo(() => {
    if (!sizeField) return undefined;
    const a = state.answers[sizeField.id];
    return a?.type === "options" ? a.optionIds[0] : undefined;
  }, [sizeField, state.answers]);

  const subtotalCents = computeTotalCents(
    state.answers,
    selectedDesign?.premiumCents ?? 0,
    resolvedOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents })),
    resolvedFieldsFlat,
    selectedDesign?.perSizeFieldPrices,
    currentSizeOptionId
  );

  // Size step only: everything else already answered, priced up (including
  // the design's premium) but excluding Size's own contribution — lets the
  // size step show each card's absolute total price rather than a +/- delta.
  const sizeStepBaseCents = useMemo(() => {
    if (!isSizeStep || !sizeField) return 0;
    const answersWithoutSize = { ...state.answers };
    delete answersWithoutSize[sizeField.id];
    return computeTotalCents(
      answersWithoutSize,
      selectedDesign?.premiumCents ?? 0,
      resolvedOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents })),
      resolvedFieldsFlat,
      selectedDesign?.perSizeFieldPrices,
      currentSizeOptionId
    );
  }, [isSizeStep, sizeField, state.answers, selectedDesign, resolvedOptions, resolvedFieldsFlat, currentSizeOptionId]);
  const nextDisabled =
    !isQuote &&
    currentField != null &&
    (currentField.type === "single_select" ||
      ((currentField.type === "text" || currentField.type === "number" || currentField.type === "per_size") &&
        currentField.required)) &&
    !isFieldAnswered(currentField, currentAnswer);

  // Design selection now happens entirely on /gallery and /portfolio — every
  // route that renders this wizard supplies lockedDesign (a catalog design,
  // or one of the two singleton quote-kind designs). This is just a safety
  // net for the (should-never-happen) case none is set.
  if (!selectedDesign) {
    return (
      <main className="order-page">
        <header className="order-hero">
          <div className="container">
            <span className="section-eyebrow">Cake Designer</span>
            <h1>Build Your Dream Cake</h1>
            <p>Start by picking a design — everything else adjusts from there.</p>
            <Link href="/gallery" className="btn btn-primary">
              Choose Your Design
            </Link>
          </div>
        </header>
      </main>
    );
  }

  const handleAddToCart = () => {
    const item = {
      designId: selectedDesign.id,
      answers: state.answers,
      referenceImages,
      lockedReferenceImagePath,
    };
    if (editingItem) {
      cart.updateItem(editingItem.clientId, item);
      router.push("/cart");
    } else {
      cart.addItem(item);
      // catalog designs are bought straight from Shop our Collection — after
      // adding one, send the customer back there to keep browsing instead of
      // straight to /cart (still the right place for a quote-kind request,
      // which has no "keep shopping" gallery to return to)
      router.push(isQuote ? "/cart" : "/gallery");
    }
  };

  return (
    <main className="order-page">
      <header className="order-hero order-hero--compact">
        <div className="container">
          <span className="section-eyebrow">Cake Designer</span>
          <h1>{selectedDesign.name}</h1>
        </div>
      </header>

      <div className="container">
        <DesignPhotoCarousel
          photos={lockedReferenceImagePath ? [lockedReferenceImagePath] : selectedDesign.photos}
          alt={selectedDesign.name}
        />
      </div>

      <div className="container order-layout">
        <div className="order-stepper">
          <div className="order-stepper__progress">
            <div className="order-stepper__progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="order-stepper__track">
            {visibleSteps.map(({ label, i }, idx) => {
              // steps beyond the furthest one the customer has validated their
              // way past are shown but not jumpable — reaching them still goes
              // through the Next button so customers can't skip validation on
              // steps they haven't gotten to yet. Anything already unlocked
              // (behind or ahead of the current step) is a direct one-click
              // jump, in either direction.
              const isFuture = i !== 0 && i > state.maxStepReached;
              return (
                <button
                  key={label}
                  ref={i === state.step ? activeStepRef : undefined}
                  type="button"
                  className={`order-stepper__item ${i === state.step ? "is-active" : ""} ${
                    i < state.step ? "is-done" : ""
                  } ${isFuture ? "is-future" : ""}`}
                  disabled={isFuture}
                  onClick={() => (i === 0 ? router.push("/gallery") : dispatch({ type: "GOTO", step: i }))}
                >
                  <span className="order-stepper__num">{idx + 1}</span>
                  <span className="order-stepper__label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="order-stage">
          {currentField &&
            (currentField.type === "single_select" || currentField.type === "multi_select") &&
            !isSizeStep && (
              <FieldOptionStep
                field={currentField}
                options={(optionsByField.get(currentField.id) ?? []).filter(
                  (o) =>
                    !getHiddenOptionIds(currentField.id, state.answers, constraintPairs).has(o.id) &&
                    !excludedOptionIdSet.has(o.id)
                )}
                selectedIds={currentAnswer?.type === "options" ? currentAnswer.optionIds : []}
                hidePrice={isQuote}
                onToggle={(optionId) => {
                  const currentIds = currentAnswer?.type === "options" ? currentAnswer.optionIds : [];
                  const nextIds =
                    currentField.type === "single_select"
                      ? [optionId]
                      : currentIds.includes(optionId)
                        ? currentIds.filter((id) => id !== optionId)
                        : [...currentIds, optionId];
                  dispatch({ type: "SET_OPTIONS", fieldId: currentField.id, optionIds: nextIds });
                }}
              />
            )}

          {currentField && isSizeStep && cakeStyleCtx && (
            liveStyleKind === "tiered" ? (
              <TierPresetStep
                field={currentField}
                options={sizeStepOptions}
                presetsByOptionId={cakeStyleCtx.presetsByOptionId}
                selectedIds={currentAnswer?.type === "options" ? currentAnswer.optionIds : []}
                hidePrice={isQuote}
                totalBaseCents={sizeStepBaseCents}
                onToggle={(optionId) =>
                  dispatch({ type: "SET_OPTIONS", fieldId: currentField.id, optionIds: [optionId] })
                }
              />
            ) : (
              <FieldOptionStep
                field={currentField}
                options={sizeStepOptions}
                selectedIds={currentAnswer?.type === "options" ? currentAnswer.optionIds : []}
                hidePrice={isQuote}
                totalBaseCents={sizeStepBaseCents}
                onToggle={(optionId) =>
                  dispatch({ type: "SET_OPTIONS", fieldId: currentField.id, optionIds: [optionId] })
                }
              />
            )
          )}

          {currentField && currentField.type === "text" && (
            <TextFieldStep
              field={currentField}
              value={currentAnswer?.type === "text" ? currentAnswer.value : ""}
              onChange={(value) => dispatch({ type: "SET_TEXT", fieldId: currentField.id, value })}
            />
          )}

          {currentField && currentField.type === "number" && (
            <NumberFieldStep
              field={currentField}
              value={currentAnswer?.type === "number" ? String(currentAnswer.value) : ""}
              onChange={(value) => dispatch({ type: "SET_NUMBER", fieldId: currentField.id, value })}
            />
          )}

          {currentField && currentField.type === "per_size" && (
            <ToggleFieldStep
              field={currentField}
              value={currentAnswer?.type === "toggle" ? currentAnswer.value : undefined}
              priceCents={resolveFieldPriceCents(
                currentField.id,
                resolvedFieldsFlat,
                selectedDesign?.perSizeFieldPrices,
                currentSizeOptionId
              )}
              onChange={(value) => dispatch({ type: "SET_TOGGLE", fieldId: currentField.id, value })}
            />
          )}

          {isCustomQuoteStep && (
            <CustomCakeQuoteStep
              images={referenceImages}
              onImagesChange={setReferenceImages}
              lockedImagePath={lockedReferenceImagePath}
            />
          )}

          {isReview && (
            <OrderSummaryPanel
              design={selectedDesign}
              designFields={designFields.filter((f) => !skippedFieldIdSet.has(f.id))}
              answers={state.answers}
              options={resolvedOptions}
              currentSizeOptionId={currentSizeOptionId}
              tierPresets={tierPresets}
              lockedFieldIds={lockedFieldIdSet}
              isCustom={isQuote}
              referenceImages={referenceImages}
              lockedReferenceImagePath={lockedReferenceImagePath}
              isEditingCartItem={!!editingItem}
              onAddToCart={handleAddToCart}
              onEditStep={(fieldId) => {
                const idx = designFields.findIndex((f) => f.id === fieldId);
                if (idx !== -1) dispatch({ type: "GOTO", step: idx + FIELD_STEP_START });
              }}
              onEditCustom={() => dispatch({ type: "GOTO", step: CUSTOM_STEP })}
            />
          )}

          {!isReview && (
            <div className="order-nav">
              {navigableSteps.indexOf(state.step) > 0 && (
                <button type="button" className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
              )}
              {!lockedDesign && state.step === navigableSteps[0] && (
                <button type="button" className="btn btn-outline" onClick={() => router.push("/gallery")}>
                  Change Design
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={goNext} disabled={nextDisabled}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {!isReview && !isQuote && (
        <div className="order-subtotal-bar">
          <div className="container order-subtotal-bar__inner">
            <span className="order-subtotal-bar__label">Subtotal</span>
            <span className="order-subtotal-bar__value">{formatCents(subtotalCents)}</span>
          </div>
        </div>
      )}

      {/* mobile only (see order-wizard.css) — combines Back/Next and the
         running subtotal into one compact bar fixed to the bottom of the
         screen, so a customer never has to scroll a tall step to find them */}
      {!isReview && (
        <div className="order-mobile-bar">
          {!isQuote && (
            <div className="order-mobile-bar__subtotal">
              <span>Subtotal</span>
              <span>{formatCents(subtotalCents)}</span>
            </div>
          )}
          <div className="order-mobile-bar__nav">
            {navigableSteps.indexOf(state.step) > 0 && (
              <button type="button" className="btn btn-outline" onClick={goBack}>
                Back
              </button>
            )}
            {!lockedDesign && state.step === navigableSteps[0] && (
              <button type="button" className="btn btn-outline" onClick={() => router.push("/gallery")}>
                Change Design
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={goNext} disabled={nextDisabled}>
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
