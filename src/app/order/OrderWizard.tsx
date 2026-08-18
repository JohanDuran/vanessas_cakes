"use client";

import { useMemo, useReducer, useState } from "react";
import { AXES, AXIS_LABELS, type Axis } from "../../lib/axes";
import type { CatalogItemDTO, DesignSummaryDTO } from "../../lib/order-types";
import { getHiddenItemIds, resolveSelections, type ConstraintPair } from "../../lib/constraints";
import DesignPickerModal from "../../components/order/DesignPickerModal";
import SizeStep from "../../components/order/steps/SizeStep";
import AxisOptionStep from "../../components/order/steps/AxisOptionStep";
import OrderSummaryPanel from "../../components/order/OrderSummaryPanel";

type Props = {
  items: CatalogItemDTO[];
  designs: DesignSummaryDTO[];
  constraintPairs: ConstraintPair[];
  /** When set (gallery entry point), the design step is skipped and locked. */
  lockedDesign?: DesignSummaryDTO;
  /** When set alongside lockedDesign, pre-selects this size before the wizard opens. */
  initialSizeId?: number;
};

type State = {
  designId: number | null;
  selections: Partial<Record<Axis, number>>;
  step: number; // 0 = design picker, 1..AXES.length = axis steps, AXES.length+1 = review
};

type Action =
  | { type: "SELECT_DESIGN"; design: DesignSummaryDTO }
  | { type: "SELECT_ITEM"; axis: Axis; itemId: number }
  | { type: "GOTO"; step: number };

const REVIEW_STEP = AXES.length + 1;

function makeReducer(pairs: ConstraintPair[]) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "SELECT_DESIGN":
        return {
          ...state,
          designId: action.design.id,
          selections: resolveSelections({ ...action.design.recipe }, pairs),
          step: 1,
        };
      case "SELECT_ITEM":
        return {
          ...state,
          selections: resolveSelections({ ...state.selections, [action.axis]: action.itemId }, pairs),
        };
      case "GOTO":
        return { ...state, step: action.step };
      default:
        return state;
    }
  };
}

export default function OrderWizard({ items, designs, constraintPairs, lockedDesign, initialSizeId }: Props) {
  const reducer = useMemo(() => makeReducer(constraintPairs), [constraintPairs]);
  const [state, dispatch] = useReducer(reducer, {
    designId: lockedDesign?.id ?? null,
    selections: lockedDesign
      ? resolveSelections(
          { ...lockedDesign.recipe, ...(initialSizeId ? { size: initialSizeId } : {}) },
          constraintPairs
        )
      : {},
    step: lockedDesign ? 1 : 0,
  });
  const [showDesignModal, setShowDesignModal] = useState(!lockedDesign);

  const itemsByAxis = useMemo(() => {
    const map = new Map<Axis, CatalogItemDTO[]>();
    for (const axis of AXES) map.set(axis, items.filter((i) => i.axis === axis));
    return map;
  }, [items]);

  const selectedDesign = lockedDesign ?? designs.find((d) => d.id === state.designId) ?? null;
  const currentAxis: Axis | null = state.step >= 1 && state.step <= AXES.length ? AXES[state.step - 1] : null;
  const isReview = state.step === REVIEW_STEP;

  const stepLabels = ["Design", ...AXES.map((a) => AXIS_LABELS[a]), "Review"];

  const goNext = () => dispatch({ type: "GOTO", step: Math.min(state.step + 1, REVIEW_STEP) });
  const goBack = () => dispatch({ type: "GOTO", step: Math.max(state.step - 1, 1) });

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

      <div className="container order-layout">
        <div className="order-stepper">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={`order-stepper__item ${i === state.step ? "is-active" : ""} ${
                i < state.step ? "is-done" : ""
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="order-stage">
          {currentAxis === "size" && (
            <SizeStep
              options={(itemsByAxis.get("size") ?? []).filter(
                (i) => !getHiddenItemIds("size", state.selections, constraintPairs).has(i.id)
              )}
              selectedId={state.selections.size}
              onSelect={(id) => dispatch({ type: "SELECT_ITEM", axis: "size", itemId: id })}
            />
          )}

          {currentAxis && currentAxis !== "size" && (
            <AxisOptionStep
              axis={currentAxis}
              options={(itemsByAxis.get(currentAxis) ?? []).filter(
                (i) => !getHiddenItemIds(currentAxis, state.selections, constraintPairs).has(i.id)
              )}
              selectedId={state.selections[currentAxis]}
              onSelect={(id) => dispatch({ type: "SELECT_ITEM", axis: currentAxis, itemId: id })}
            />
          )}

          {isReview && (
            <OrderSummaryPanel
              design={selectedDesign}
              selections={state.selections}
              items={items}
              onEditStep={(axis) => dispatch({ type: "GOTO", step: AXES.indexOf(axis) + 1 })}
            />
          )}

          {!isReview && (
            <div className="order-nav">
              {state.step > 1 && (
                <button type="button" className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
              )}
              {!lockedDesign && state.step === 1 && (
                <button type="button" className="btn btn-outline" onClick={() => setShowDesignModal(true)}>
                  Change Design
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
                disabled={currentAxis != null && state.selections[currentAxis] == null}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

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
