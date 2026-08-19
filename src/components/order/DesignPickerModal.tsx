"use client";

import type { DesignSummaryDTO } from "../../lib/order-types";
import { formatCents } from "../../lib/pricing";

type Props = {
  designs: DesignSummaryDTO[];
  onSelect: (design: DesignSummaryDTO) => void;
  onClose?: () => void;
  closable?: boolean;
};

export default function DesignPickerModal({ designs, onSelect, onClose, closable }: Props) {
  return (
    <div className="design-modal-overlay">
      <div className="design-modal">
        <div className="design-modal__header">
          <div>
            <span className="section-eyebrow">Step 1</span>
            <h2>Choose Your Design</h2>
          </div>
          {closable && (
            <button type="button" className="design-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="design-modal__grid">
          {designs.map((design) => (
            <button key={design.id} type="button" className="design-card" onClick={() => onSelect(design)}>
              <div className="design-card__art">
                {design.photos[0] ? (
                  <img src={`/uploads/${design.photos[0]}`} alt={design.name} />
                ) : (
                  <div className="design-card__placeholder">🎂</div>
                )}
              </div>
              <span className="design-card__name">{design.name}</span>
              <span className="design-card__price">from {formatCents(design.chargedPriceCents)}</span>
            </button>
          ))}
          {designs.length === 0 && (
            <p className="design-modal__empty">No designs published yet — check back soon!</p>
          )}
        </div>
      </div>
    </div>
  );
}
