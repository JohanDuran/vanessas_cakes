"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO } from "../../lib/order-types";
import { computeTotalCents, formatCents, type Answers } from "../../lib/pricing";
import { fromDateKey, formatTimeLabel } from "../../lib/availability";
import { CONTACT_PREFERENCES, CONTACT_PREFERENCE_LABELS, type ContactPreference } from "../../lib/fields";
import { submitOrder } from "../../app/order/actions";
import PriceDelta from "./PriceDelta";

type Props = {
  design: DesignSummaryDTO;
  designFields: FieldDTO[];
  answers: Answers;
  options: FieldOptionDTO[];
  tierPresets: TierPresetDTO[];
  lockedFieldIds: Set<number>;
  pickupDate: string | null;
  pickupTime: string | null;
  isCustom: boolean;
  contactPreference: ContactPreference | null;
  onContactPreferenceChange: (value: ContactPreference) => void;
  referenceImages: File[];
  onEditStep: (fieldId: number) => void;
  onEditPickup: () => void;
  onEditCustom: () => void;
};

export default function OrderSummaryPanel({
  design,
  designFields,
  answers,
  options,
  tierPresets,
  lockedFieldIds,
  pickupDate,
  pickupTime,
  isCustom,
  contactPreference,
  onContactPreferenceChange,
  referenceImages,
  onEditStep,
  onEditPickup,
  onEditCustom,
}: Props) {
  const optionById = new Map(options.map((o) => [o.id, o]));
  const presetsByOptionId = new Map(tierPresets.map((p) => [p.fieldOptionId, p]));
  const flatOptions = options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const flatFields = designFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }));
  const total = computeTotalCents(answers, design.premiumCents, flatOptions, flatFields);

  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    referenceImages.forEach((file) => dt.items.add(file));
    fileInputRef.current.files = dt.files;
  }, [referenceImages]);

  return (
    <form action={submitOrder} className="wizard-step order-summary">
      {!isCustom && <input type="hidden" name="designId" value={design.id} />}
      {contactPreference && <input type="hidden" name="contactPreference" value={contactPreference} />}
      {isCustom && (
        <input
          ref={fileInputRef}
          type="file"
          name="referenceImages"
          multiple
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
        />
      )}
      <input type="hidden" name="pickupDate" value={pickupDate ?? ""} />
      <input type="hidden" name="pickupTime" value={pickupTime ?? ""} />
      {designFields.map((field) => {
        const answer = answers[field.id];
        if (!answer) return null;
        if (answer.type === "options") {
          return answer.optionIds.map((optionId) => (
            <input key={`${field.id}-${optionId}`} type="hidden" name={`options_${field.id}`} value={optionId} />
          ));
        }
        if (answer.type === "text") {
          return <input key={field.id} type="hidden" name={`text_${field.id}`} value={answer.value} />;
        }
        return <input key={field.id} type="hidden" name={`number_${field.id}`} value={answer.value} />;
      })}

      <h2>Review Your Cake</h2>
      <p className="order-summary__design">
        <strong>{design.name}</strong>
      </p>

      <ul className="order-summary__list">
        <li>
          <span className="order-summary__axis">Pickup</span>
          <span className="order-summary__item">
            {pickupDate && pickupTime
              ? `${fromDateKey(pickupDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })} at ${formatTimeLabel(pickupTime)}`
              : "—"}
          </span>
          <span className="order-summary__item-price" />
          <button type="button" className="order-summary__edit" onClick={onEditPickup}>
            Change
          </button>
        </li>
        {designFields.map((field) => {
          const answer = answers[field.id];
          let valueLabel = "—";
          let priceNode: ReactNode = null;
          if (answer?.type === "options") {
            const names = answer.optionIds
              .map((id) => {
                const opt = optionById.get(id);
                if (!opt) return null;
                const preset = presetsByOptionId.get(id);
                if (!preset || preset.levels.length === 0) return opt.name;
                return `${opt.name} (${preset.levels.map((l) => l.moldName).join(" → ")})`;
              })
              .filter((name): name is string => Boolean(name));
            valueLabel = names.length > 0 ? names.join(", ") : "—";
            if (names.length > 0 && !isCustom) {
              const priceCents = answer.optionIds.reduce((sum, id) => sum + (optionById.get(id)?.priceCents ?? 0), 0);
              priceNode = formatCents(priceCents);
            }
          } else if (answer?.type === "text") {
            valueLabel = answer.value || "—";
            if (answer.value && !isCustom) priceNode = <PriceDelta cents={field.additionalPriceCents} />;
          } else if (answer?.type === "number") {
            valueLabel = String(answer.value);
            if (!isCustom) priceNode = <PriceDelta cents={field.additionalPriceCents} />;
          }
          return (
            <li key={field.id}>
              <span className="order-summary__axis">{field.name}</span>
              <span className="order-summary__item">{valueLabel}</span>
              <span className="order-summary__item-price">{priceNode}</span>
              {!lockedFieldIds.has(field.id) && (
                <button type="button" className="order-summary__edit" onClick={() => onEditStep(field.id)}>
                  Change
                </button>
              )}
            </li>
          );
        })}
        {isCustom && (
          <li>
            <span className="order-summary__axis">Reference images</span>
            <span className="order-summary__item">
              {referenceImages.length > 0 ? `${referenceImages.length} attached` : "None"}
            </span>
            <span className="order-summary__item-price" />
            <button type="button" className="order-summary__edit" onClick={onEditCustom}>
              Change
            </button>
          </li>
        )}
      </ul>

      {!isCustom && (
        <div className="order-summary__total">
          <span>Total</span>
          <strong>{formatCents(total)}</strong>
        </div>
      )}
      {isCustom && (
        <p className="wizard-step__hint">We'll follow up with your exact quote within 24 hours.</p>
      )}

      <div className="wizard-field">
        <label>Preferred contact method?</label>
        <div className="contact-pref-grid">
          {CONTACT_PREFERENCES.map((value) => (
            <button
              key={value}
              type="button"
              className={`option-card ${contactPreference === value ? "option-card--selected" : ""}`}
              onClick={() => onContactPreferenceChange(value)}
            >
              <span className="option-card__name">{CONTACT_PREFERENCE_LABELS[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <label htmlFor="customerName">Your name</label>
        <input id="customerName" name="customerName" required />
      </div>
      <div className="wizard-field">
        <label htmlFor="customerEmail">Email</label>
        <input id="customerEmail" name="customerEmail" type="email" required />
      </div>
      <div className="wizard-field">
        <label htmlFor="customerPhone">Phone</label>
        <input id="customerPhone" name="customerPhone" type="tel" />
      </div>
      <div className="wizard-field">
        <label htmlFor="comments">Comments / special requests</label>
        <textarea id="comments" name="comments" rows={4} />
      </div>

      <button
        type="submit"
        className="btn btn-primary order-summary__submit"
        disabled={!contactPreference}
      >
        {isCustom ? "Send Custom Quote Request" : "Send Order to the Baker"}
      </button>
    </form>
  );
}
