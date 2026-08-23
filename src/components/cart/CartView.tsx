"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FieldDTO, FieldOptionDTO, DesignSummaryDTO, TierPresetDTO } from "../../lib/order-types";
import { computeTotalCents, formatCents } from "../../lib/pricing";
import type { WeeklyHour, DateOverride, PickupSettings } from "../../lib/availability";
import { useCart, type CartItem } from "../../lib/cart/CartContext";
import { submitCart } from "../../app/order/actions";
import PickupStep from "../order/steps/PickupStep";
import "./cart.css";

type Props = {
  fields: FieldDTO[];
  options: FieldOptionDTO[];
  designs: DesignSummaryDTO[];
  tierPresets: TierPresetDTO[];
  availability: {
    settings: PickupSettings;
    weeklyHours: WeeklyHour[];
    overrides: DateOverride[];
    orderCountsByDate: Record<string, number>;
  };
};

/** A design's actual fields — same rule as the wizard's own fieldsForDesign:
 *  every base field, plus whichever custom fields the design included. */
function fieldsForItem(fields: FieldDTO[], design: DesignSummaryDTO | undefined): FieldDTO[] {
  if (!design) return fields.filter((f) => f.isBase);
  return fields.filter((f) => f.isBase || design.includedFieldIds.includes(f.id));
}

function summarizeItem(
  item: CartItem,
  fields: FieldDTO[],
  options: FieldOptionDTO[],
  tierPresets: TierPresetDTO[],
  designs: DesignSummaryDTO[]
) {
  const design = item.designId ? designs.find((d) => d.id === item.designId) : undefined;
  const optionById = new Map(options.map((o) => [o.id, o]));
  const presetsByOptionId = new Map(tierPresets.map((p) => [p.fieldOptionId, p]));
  const itemFields = fieldsForItem(fields, design);

  const lines = itemFields
    .map((field) => {
      const answer = item.answers[field.id];
      if (!answer) return null;
      let value: string;
      if (answer.type === "options") {
        const names = answer.optionIds
          .map((id) => {
            const opt = optionById.get(id);
            if (!opt) return null;
            const preset = presetsByOptionId.get(id);
            return !preset || preset.levels.length === 0
              ? opt.name
              : `${opt.name} (${preset.levels.map((l) => l.moldName).join(" → ")})`;
          })
          .filter((n): n is string => Boolean(n));
        if (names.length === 0) return null;
        value = names.join(", ");
      } else if (answer.type === "text") {
        if (!answer.value) return null;
        value = answer.value;
      } else {
        value = String(answer.value);
      }
      return { label: field.name, value };
    })
    .filter((l): l is { label: string; value: string } => l !== null);

  const flatOptions = options.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }));
  const flatFields = itemFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }));
  const priceCents = item.isCustom
    ? 0
    : computeTotalCents(item.answers, design?.premiumCents ?? 0, flatOptions, flatFields);

  return {
    name: item.isCustom ? "Custom Cake Quote" : (design?.name ?? "Unknown design"),
    photo: design?.photos[0],
    lines,
    priceCents,
  };
}

export default function CartView({ fields, options, designs, tierPresets, availability }: Props) {
  const cart = useCart();
  const router = useRouter();
  const [submitState, formAction, isSubmitting] = useActionState(submitCart, undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const hasCatalogItem = cart.items.some((i) => !i.isCustom);
  const subtotalCents = cart.items.reduce(
    (sum, item) => sum + summarizeItem(item, fields, options, tierPresets, designs).priceCents,
    0
  );

  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    for (const item of cart.items) {
      const input = fileInputsRef.current[item.clientId];
      if (!input) continue;
      const dt = new DataTransfer();
      item.referenceImages.forEach((file) => dt.items.add(file));
      input.files = dt.files;
    }
  }, [cart.items]);

  const handleEdit = (item: CartItem) => {
    const target = item.isCustom ? "/order/custom" : `/order/${item.designId}`;
    router.push(`${target}?cartItem=${item.clientId}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const errors: string[] = [];
    if (cart.items.length === 0) errors.push("Your cart is empty.");
    if (!cart.contact.name.trim()) errors.push("Please enter your name.");
    if (!cart.contact.email.trim()) errors.push("Please enter your email.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cart.contact.email.trim())) {
      errors.push("Please enter a valid email address.");
    }
    if (hasCatalogItem && !(cart.pickupDate && cart.pickupTime)) {
      errors.push("Please choose a pickup date and time.");
    }

    if (errors.length > 0) {
      e.preventDefault();
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
  };

  if (cart.items.length === 0) {
    return (
      <main className="order-page">
        <div className="container cart-empty">
          <h1>Your cart is empty</h1>
          <p>Browse the gallery to start designing a cake.</p>
          <Link href="/gallery" className="btn btn-primary">
            Browse the Gallery
          </Link>
        </div>
      </main>
    );
  }

  const cartPayload = JSON.stringify(
    cart.items.map((item) => ({
      clientId: item.clientId,
      designId: item.designId,
      isCustom: item.isCustom,
      answers: item.answers,
    }))
  );

  return (
    <main className="order-page">
      <header className="order-hero order-hero--compact">
        <div className="container">
          <span className="section-eyebrow">Your Cart</span>
          <h1>Review Your Order</h1>
        </div>
      </header>

      <form action={formAction} onSubmit={handleSubmit} className="container cart-layout" noValidate>
        <input type="hidden" name="cart" value={cartPayload} />
        <input type="hidden" name="pickupDate" value={cart.pickupDate ?? ""} />
        <input type="hidden" name="pickupTime" value={cart.pickupTime ?? ""} />
        {cart.items.map(
          (item) =>
            item.isCustom &&
            item.referenceImages.length > 0 && (
              <input
                key={item.clientId}
                ref={(el) => {
                  fileInputsRef.current[item.clientId] = el;
                }}
                type="file"
                name={`referenceImages_${item.clientId}`}
                multiple
                style={{ display: "none" }}
                aria-hidden
                tabIndex={-1}
              />
            )
        )}

        <div className="cart-items">
          {cart.items.map((item) => {
            const summary = summarizeItem(item, fields, options, tierPresets, designs);
            return (
              <div key={item.clientId} className="cart-item">
                {summary.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cart-item__photo" src={summary.photo} alt={summary.name} />
                )}
                <div className="cart-item__body">
                  <h3>{summary.name}</h3>
                  <ul className="cart-item__lines">
                    {summary.lines.map((line) => (
                      <li key={line.label}>
                        <span>{line.label}</span>
                        <span>{line.value}</span>
                      </li>
                    ))}
                  </ul>
                  {!item.isCustom && <div className="cart-item__price">{formatCents(summary.priceCents)}</div>}
                </div>
                <div className="cart-item__actions">
                  <button type="button" className="btn btn-outline" onClick={() => handleEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="cart-item__remove" onClick={() => cart.removeItem(item.clientId)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cart-subtotal">
          <span>Subtotal</span>
          <strong>{formatCents(subtotalCents)}</strong>
        </div>

        {hasCatalogItem && (
          <PickupStep
            availability={availability}
            pickupDate={cart.pickupDate}
            pickupTime={cart.pickupTime}
            onChange={cart.setPickup}
          />
        )}

        <div className="wizard-field">
          <label htmlFor="customerName">Your name</label>
          <input
            id="customerName"
            name="customerName"
            value={cart.contact.name}
            onChange={(e) => cart.setContact({ name: e.target.value })}
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="customerEmail">Email</label>
          <input
            id="customerEmail"
            name="customerEmail"
            type="email"
            value={cart.contact.email}
            onChange={(e) => cart.setContact({ email: e.target.value })}
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="customerPhone">Phone</label>
          <input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            value={cart.contact.phone}
            onChange={(e) => cart.setContact({ phone: e.target.value })}
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="comments">Comments / special requests</label>
          <textarea
            id="comments"
            name="comments"
            rows={4}
            value={cart.contact.comments}
            onChange={(e) => cart.setContact({ comments: e.target.value })}
          />
        </div>

        {formErrors.length > 0 && (
          <ul className="order-summary__error" role="alert">
            {formErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
        {submitState?.error && (
          <p className="order-summary__error" role="alert">
            {submitState.error}
          </p>
        )}

        <button type="submit" className="btn btn-primary order-summary__submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send Order to the Baker"}
        </button>
      </form>
    </main>
  );
}
