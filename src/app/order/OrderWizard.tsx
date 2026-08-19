"use client";

import { useMemo, useReducer, useState } from "react";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO } from "../../lib/order-types";
import { getHiddenOptionIds, resolveAnswers, type ConstraintPair } from "../../lib/constraints";
import { computeTotalCents, formatCents, type Answers } from "../../lib/pricing";
import { SIZE_FIELD_SLUG } from "../../lib/fields";
import DesignPickerModal from "../../components/order/DesignPickerModal";
import DesignPhotoCarousel from "../../components/order/DesignPhotoCarousel";
import FieldOptionStep from "../../components/order/steps/FieldOptionStep";
import TextFieldStep from "../../components/order/steps/TextFieldStep";
import NumberFieldStep from "../../components/order/steps/NumberFieldStep";
import OrderSummaryPanel from "../../components/order/OrderSummaryPanel";

type Props = {
  fields: FieldDTO[];
  options: FieldOptionDTO[];
  designs: DesignSummaryDTO[];
  constraintPairs: ConstraintPair[];
  /** When set (gallery entry point), the design step is skipped and locked. */
  lockedDesign?: DesignSummaryDTO;
  /** When set alongside lockedDesign, pre-selects this size before the wizard opens. */
  initialSizeId?: number;
};

type State = {
  designId: number | null;
  answers: Answers;
  step: number; // 0 = design picker, 1..designFields.length = field steps, designFields.length+1 = review
};

type Action =
  | { type: "SELECT_DESIGN"; design: DesignSummaryDTO }
  | { type: "SET_OPTIONS"; fieldId: number; optionIds: number[] }
  | { type: "SET_TEXT"; fieldId: number; value: string }
  | { type: "SET_NUMBER"; fieldId: number; value: string }
  | { type: "GOTO"; step: number };

/** A design's actual fields: every base field (always required), plus
 *  whichever custom fields the admin included (inclusion *is* having a
 *  default answer for it), in canonical/catalog order. */
function fieldsForDesign(fields: FieldDTO[], design: DesignSummaryDTO): FieldDTO[] {
  return fields.filter((f) => f.isBase || design.fieldValues[f.id] != null);
}

/** First step index that isn't locked for this design — where the wizard
 *  should land after picking it, since locked field steps are never shown
 *  or navigable. */
function firstNavigableStepFor(fields: FieldDTO[], design: DesignSummaryDTO): number {
  const designFields = fieldsForDesign(fields, design);
  const lockedSet = new Set(design.lockedFieldIds);
  const idx = designFields.findIndex((f) => !lockedSet.has(f.id));
  return idx === -1 ? designFields.length + 1 : idx + 1;
}

function makeReducer(fields: FieldDTO[], pairs: ConstraintPair[]) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "SELECT_DESIGN":
        return {
          ...state,
          designId: action.design.id,
          answers: resolveAnswers({ ...action.design.fieldValues }, pairs),
          step: firstNavigableStepFor(fields, action.design),
        };
      case "SET_OPTIONS":
        return {
          ...state,
          answers: resolveAnswers(
            { ...state.answers, [action.fieldId]: { type: "options", optionIds: action.optionIds } },
            pairs
          ),
        };
      case "SET_TEXT":
        return {
          ...state,
          answers: { ...state.answers, [action.fieldId]: { type: "text", value: action.value } },
        };
      case "SET_NUMBER":
        return {
          ...state,
          answers: {
            ...state.answers,
            [action.fieldId]: { type: "number", value: Number(action.value) || 0 },
          },
        };
      case "GOTO":
        return { ...state, step: action.step };
      default:
        return state;
    }
  };
}

export default function OrderWizard({ fields, options, designs, constraintPairs, lockedDesign, initialSizeId }: Props) {
  const reducer = useMemo(() => makeReducer(fields, constraintPairs), [fields, constraintPairs]);

  const sizeField = useMemo(() => fields.find((f) => f.slug === SIZE_FIELD_SLUG), [fields]);

  const [state, dispatch] = useReducer(reducer, {
    designId: lockedDesign?.id ?? null,
    answers: lockedDesign
      ? resolveAnswers(
          {
            ...lockedDesign.fieldValues,
            ...(initialSizeId && sizeField ? { [sizeField.id]: { type: "options", optionIds: [initialSizeId] } } : {}),
          },
          constraintPairs
        )
      : {},
    step: lockedDesign ? firstNavigableStepFor(fields, lockedDesign) : 0,
  });
  const [showDesignModal, setShowDesignModal] = useState(!lockedDesign);

  const optionsByField = useMemo(() => {
    const map = new Map<number, FieldOptionDTO[]>();
    for (const f of fields) map.set(f.id, options.filter((o) => o.fieldId === f.id));
    return map;
  }, [fields, options]);

  const selectedDesign = lockedDesign ?? designs.find((d) => d.id === state.designId) ?? null;

  const designFields = useMemo(
    () => (selectedDesign ? fieldsForDesign(fields, selectedDesign) : []),
    [fields, selectedDesign]
  );
  const REVIEW_STEP = designFields.length + 1;

  const currentField = state.step >= 1 && state.step <= designFields.length ? designFields[state.step - 1] : null;
  const currentAnswer = currentField ? state.answers[currentField.id] : undefined;
  const isReview = state.step === REVIEW_STEP;

  const lockedFieldIdSet = useMemo(() => new Set(selectedDesign?.lockedFieldIds ?? []), [selectedDesign]);
  const excludedOptionIdSet = useMemo(
    () => new Set(selectedDesign?.excludedOptionIds ?? []),
    [selectedDesign]
  );

  // the sequence of steps a customer can actually land on for this design —
  // locked fields are skipped entirely, not just disabled
  const navigableSteps = useMemo(() => {
    const fieldSteps = designFields
      .map((_, idx) => idx + 1)
      .filter((i) => !lockedFieldIdSet.has(designFields[i - 1].id));
    return [...fieldSteps, REVIEW_STEP];
  }, [designFields, lockedFieldIdSet, REVIEW_STEP]);

  const stepLabels = ["Design", ...designFields.map((f) => f.name), "Review"];
  const visibleSteps = stepLabels.map((label, i) => ({ label, i })).filter(({ i }) => {
    if (i === 0) return !lockedDesign;
    if (i >= 1 && i <= designFields.length) return !lockedFieldIdSet.has(designFields[i - 1].id);
    return true;
  });

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

  if (!selectedDesign) {
    return (
      <main className="order-page">
        <header className="order-hero">
          <div className="container">
            <span className="section-eyebrow">Cake Designer</span>
            <h1>Build Your Dream Cake</h1>
            <p>Start by picking a design — everything else adjusts from there.</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowDesignModal(true)}>
              Choose Your Design
            </button>
          </div>
        </header>
        {showDesignModal && (
          <DesignPickerModal
            designs={designs}
            onSelect={(design) => {
              dispatch({ type: "SELECT_DESIGN", design });
              setShowDesignModal(false);
            }}
          />
        )}
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
          {visibleSteps.map(({ label, i }) => (
            <button
              key={label}
              type="button"
              className={`order-stepper__item ${i === state.step ? "is-active" : ""} ${
                i < state.step ? "is-done" : ""
              }`}
              onClick={() => (i === 0 ? setShowDesignModal(true) : dispatch({ type: "GOTO", step: i }))}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="order-stage">
          {currentField && (currentField.type === "single_select" || currentField.type === "multi_select") && (
            <FieldOptionStep
              field={currentField}
              options={(optionsByField.get(currentField.id) ?? []).filter(
                (o) =>
                  !getHiddenOptionIds(currentField.id, state.answers, constraintPairs).has(o.id) &&
                  !excludedOptionIdSet.has(o.id)
              )}
              selectedIds={currentAnswer?.type === "options" ? currentAnswer.optionIds : []}
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

          {isReview && (
            <OrderSummaryPanel
              design={selectedDesign}
              designFields={designFields}
              answers={state.answers}
              options={options}
              lockedFieldIds={lockedFieldIdSet}
              onEditStep={(fieldId) => {
                const idx = designFields.findIndex((f) => f.id === fieldId);
                if (idx !== -1) dispatch({ type: "GOTO", step: idx + 1 });
              }}
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
                <button type="button" className="btn btn-outline" onClick={() => setShowDesignModal(true)}>
                  Change Design
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={
                  currentField?.type === "single_select" &&
                  !(currentAnswer?.type === "options" && currentAnswer.optionIds.length > 0)
                }
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {!isReview && (
        <div className="order-subtotal-bar">
          <div className="container order-subtotal-bar__inner">
            <span className="order-subtotal-bar__label">Subtotal</span>
            <span className="order-subtotal-bar__value">
              {formatCents(
                computeTotalCents(
                  state.answers,
                  selectedDesign.premiumCents,
                  options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }))
                )
              )}
            </span>
          </div>
        </div>
      )}

      {showDesignModal && (
        <DesignPickerModal
          designs={designs}
          closable
          onClose={() => setShowDesignModal(false)}
          onSelect={(design) => {
            dispatch({ type: "SELECT_DESIGN", design });
            setShowDesignModal(false);
          }}
        />
      )}
    </main>
  );
}
