"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO } from "../../lib/order-types";
import { getHiddenOptionIds, resolveAnswers, type ConstraintPair } from "../../lib/constraints";
import {
  applyCakeStyleRules,
  buildCakeStyleContext,
  currentStyleKind,
  sizeOptionsForStyle,
  type CakeStyleContext,
} from "../../lib/cakeStyle";
import { computeTotalCents, formatCents, type Answers } from "../../lib/pricing";
import { SIZE_FIELD_SLUG, type ContactPreference } from "../../lib/fields";
import type { WeeklyHour, DateOverride, PickupSettings } from "../../lib/availability";
import DesignPhotoCarousel from "../../components/order/DesignPhotoCarousel";
import FieldOptionStep from "../../components/order/steps/FieldOptionStep";
import TierPresetStep from "../../components/order/steps/TierPresetStep";
import TextFieldStep from "../../components/order/steps/TextFieldStep";
import NumberFieldStep from "../../components/order/steps/NumberFieldStep";
import PickupStep from "../../components/order/steps/PickupStep";
import CustomCakeQuoteStep from "../../components/order/steps/CustomCakeQuoteStep";
import OrderSummaryPanel from "../../components/order/OrderSummaryPanel";

type Props = {
  fields: FieldDTO[];
  options: FieldOptionDTO[];
  designs: DesignSummaryDTO[];
  constraintPairs: ConstraintPair[];
  tierPresets: TierPresetDTO[];
  availability: {
    settings: PickupSettings;
    weeklyHours: WeeklyHour[];
    overrides: DateOverride[];
    orderCountsByDate: Record<string, number>;
  };
  /** When set (gallery entry point), the design step is skipped and locked. */
  lockedDesign?: DesignSummaryDTO;
  /** When set alongside lockedDesign, pre-selects this size before the wizard opens. */
  initialSizeId?: number;
  /** When set (the "Custom Cake" menu entry point), the wizard opens straight
   *  into the custom-cake flow instead of the design picker. */
  startCustom?: boolean;
};

type State = {
  designId: number | null;
  isCustom: boolean;
  contactPreference: ContactPreference | null;
  answers: Answers;
  pickupDate: string | null;
  pickupTime: string | null;
  // 0 = design picker, 1 = custom-cake quote (only when isCustom), then pickup,
  // then one step per design field, then review — see PICKUP_STEP/REVIEW_STEP below
  step: number;
};

type Action =
  | { type: "SELECT_DESIGN"; design: DesignSummaryDTO }
  | { type: "SELECT_CUSTOM" }
  | { type: "SET_CONTACT_PREFERENCE"; value: ContactPreference }
  | { type: "SET_OPTIONS"; fieldId: number; optionIds: number[] }
  | { type: "SET_TEXT"; fieldId: number; value: string }
  | { type: "SET_NUMBER"; fieldId: number; value: string }
  | { type: "SET_PICKUP"; date: string; time: string }
  | { type: "GOTO"; step: number };

/** A design's actual fields: every base field (always required), plus
 *  whichever custom fields the admin included (with or without a default
 *  answer), in canonical/catalog order. A custom-cake quote has no catalog
 *  design, so this naturally reduces to just the base fields. */
function fieldsForDesign(fields: FieldDTO[], design: DesignSummaryDTO): FieldDTO[] {
  return fields.filter((f) => f.isBase || design.includedFieldIds.includes(f.id));
}

/** Whether the customer has actually answered this field — used to gate the
 *  Next button for single_select (always) and text/number fields marked
 *  Required. multi_select is never required-gated. */
function isFieldAnswered(field: FieldDTO, answer: Answers[number] | undefined): boolean {
  if (!answer) return false;
  if (field.type === "text") return answer.type === "text" && answer.value.trim() !== "";
  if (field.type === "number") return answer.type === "number";
  if (field.type === "single_select") return answer.type === "options" && answer.optionIds.length > 0;
  return true;
}

/** Placeholder "design" for the custom-cake flow — has no catalog id, price,
 *  or photos, and no default field answers (fieldsForDesign then yields just
 *  the base fields, all left for the customer to optionally fill in). */
const CUSTOM_DESIGN: DesignSummaryDTO = {
  id: -1,
  name: "Custom Cake",
  description: null,
  chargedPriceCents: 0,
  premiumCents: 0,
  photos: [],
  fieldValues: {},
  lockedFieldIds: [],
  excludedOptionIds: [],
  categoryIds: [],
  includedFieldIds: [],
};

/** Step index reserved for the custom-cake quote step — only reachable when
 *  isCustom is true. */
const CUSTOM_STEP = 1;

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
        const pickupStep = 1;
        return {
          ...state,
          designId: action.design.id,
          isCustom: false,
          answers: resolveAll({ ...action.design.fieldValues }, pairs, cakeStyleCtx),
          step: pickupStep,
        };
      }
      case "SELECT_CUSTOM":
        return {
          ...state,
          designId: null,
          isCustom: true,
          contactPreference: null,
          answers: resolveAll({}, pairs, cakeStyleCtx),
          step: CUSTOM_STEP,
        };
      case "SET_CONTACT_PREFERENCE":
        return { ...state, contactPreference: action.value };
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
      case "SET_PICKUP":
        return { ...state, pickupDate: action.date, pickupTime: action.time };
      case "GOTO":
        return { ...state, step: action.step };
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
  availability,
  lockedDesign,
  initialSizeId,
  startCustom,
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

  const [state, dispatch] = useReducer(reducer, {
    designId: lockedDesign?.id ?? null,
    isCustom: !!startCustom,
    contactPreference: null,
    answers: lockedDesign
      ? resolveAll(
          {
            ...lockedDesign.fieldValues,
            ...(initialSizeId && sizeField ? { [sizeField.id]: { type: "options", optionIds: [initialSizeId] } } : {}),
          },
          constraintPairs,
          cakeStyleCtx
        )
      : {},
    pickupDate: null,
    pickupTime: null,
    step: lockedDesign ? 1 : startCustom ? CUSTOM_STEP : 0,
  });
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const router = useRouter();

  const optionsByField = useMemo(() => {
    const map = new Map<number, FieldOptionDTO[]>();
    for (const f of fields) map.set(f.id, options.filter((o) => o.fieldId === f.id));
    return map;
  }, [fields, options]);

  const selectedDesign =
    lockedDesign ?? (state.isCustom ? CUSTOM_DESIGN : designs.find((d) => d.id === state.designId) ?? null);

  const designFields = useMemo(
    () => (selectedDesign ? fieldsForDesign(fields, selectedDesign) : []),
    [fields, selectedDesign]
  );

  // step numbering: 0 is design, 1 is the custom-cake quote step (only when
  // isCustom), then pickup, then one step per design field, then review
  const PICKUP_STEP = state.isCustom ? CUSTOM_STEP + 1 : 1;
  const FIELD_STEP_START = PICKUP_STEP + 1;
  const REVIEW_STEP = FIELD_STEP_START + designFields.length;

  const currentField =
    state.step >= FIELD_STEP_START && state.step < REVIEW_STEP
      ? designFields[state.step - FIELD_STEP_START]
      : null;
  const currentAnswer = currentField ? state.answers[currentField.id] : undefined;
  const isCustomQuoteStep = state.isCustom && state.step === CUSTOM_STEP;
  const isPickup = state.step === PICKUP_STEP;
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
    return [...(state.isCustom ? [CUSTOM_STEP] : []), PICKUP_STEP, ...fieldSteps, REVIEW_STEP];
  }, [designFields, skippedFieldIdSet, FIELD_STEP_START, PICKUP_STEP, REVIEW_STEP, state.isCustom]);

  const stepLabels = [
    "Design",
    ...(state.isCustom ? ["Custom Cake Quote"] : []),
    "Pickup",
    ...designFields.map((f) => f.name),
    "Review",
  ];
  const visibleSteps = stepLabels.map((label, i) => ({ label, i })).filter(({ i }) => {
    if (i === 0) return !lockedDesign;
    if (state.isCustom && i === CUSTOM_STEP) return true;
    if (i === PICKUP_STEP) return true;
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

  // Design selection now happens entirely on /gallery — every route that
  // renders this wizard supplies lockedDesign or startCustom. This is just a
  // safety net for the (should-never-happen) case neither is set.
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

  return (
    <main className="order-page">
      <header className="order-hero order-hero--compact">
        <div className="container">
          <span className="section-eyebrow">Cake Designer</span>
          <h1>{selectedDesign.name}</h1>
        </div>
      </header>

      <div className="container">
        <DesignPhotoCarousel photos={selectedDesign.photos} alt={selectedDesign.name} />
      </div>

      <div className="container order-layout">
        <div className="order-stepper">
          <div className="order-stepper__progress">
            <div className="order-stepper__progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="order-stepper__track">
            {visibleSteps.map(({ label, i }, idx) => {
              // steps ahead of where the customer currently is are shown but not
              // jumpable — forward movement goes through the Next button so
              // customers can't skip validation on later steps
              const isFuture = i !== 0 && i > state.step;
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
                hidePrice={state.isCustom}
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
                hidePrice={state.isCustom}
                onToggle={(optionId) =>
                  dispatch({ type: "SET_OPTIONS", fieldId: currentField.id, optionIds: [optionId] })
                }
              />
            ) : (
              <FieldOptionStep
                field={currentField}
                options={sizeStepOptions}
                selectedIds={currentAnswer?.type === "options" ? currentAnswer.optionIds : []}
                hidePrice={state.isCustom}
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

          {isCustomQuoteStep && (
            <CustomCakeQuoteStep images={referenceImages} onImagesChange={setReferenceImages} />
          )}

          {isPickup && (
            <PickupStep
              availability={availability}
              pickupDate={state.pickupDate}
              pickupTime={state.pickupTime}
              onChange={(date, time) => dispatch({ type: "SET_PICKUP", date, time })}
            />
          )}

          {isReview && (
            <OrderSummaryPanel
              design={selectedDesign}
              designFields={designFields.filter((f) => !skippedFieldIdSet.has(f.id))}
              answers={state.answers}
              options={options}
              tierPresets={tierPresets}
              lockedFieldIds={lockedFieldIdSet}
              pickupDate={state.pickupDate}
              pickupTime={state.pickupTime}
              isCustom={state.isCustom}
              contactPreference={state.contactPreference}
              onContactPreferenceChange={(value) => dispatch({ type: "SET_CONTACT_PREFERENCE", value })}
              referenceImages={referenceImages}
              onEditStep={(fieldId) => {
                const idx = designFields.findIndex((f) => f.id === fieldId);
                if (idx !== -1) dispatch({ type: "GOTO", step: idx + FIELD_STEP_START });
              }}
              onEditPickup={() => dispatch({ type: "GOTO", step: PICKUP_STEP })}
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={
                  (!state.isCustom &&
                    currentField != null &&
                    (currentField.type === "single_select" ||
                      ((currentField.type === "text" || currentField.type === "number") && currentField.required)) &&
                    !isFieldAnswered(currentField, currentAnswer)) ||
                  (isPickup && !state.isCustom && !(state.pickupDate && state.pickupTime))
                }
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {!isReview && !state.isCustom && (
        <div className="order-subtotal-bar">
          <div className="container order-subtotal-bar__inner">
            <span className="order-subtotal-bar__label">Subtotal</span>
            <span className="order-subtotal-bar__value">
              {formatCents(
                computeTotalCents(
                  state.answers,
                  selectedDesign.premiumCents,
                  options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents })),
                  fields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }))
                )
              )}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
