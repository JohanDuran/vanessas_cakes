"use client";

import { useEffect, useState } from "react";
import "./PromoModal.css";

// Bump this whenever the promo changes in a way that should reappear even
// for visitors who already dismissed a previous one. Uploading a new banner
// image from /admin/homepage does NOT do this on its own — see the note there.
const CURRENT_PROMO_ID = "promo_spring_2026_v1";
const DISMISSED_KEY = "closed_promo_id";
const SHOW_DELAY_MS = 1500;

type Props = {
  imagePath: string | null;
  imageAlt: string;
};

export default function PromoModal({ imagePath, imageAlt }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    if (localStorage.getItem(DISMISSED_KEY) === CURRENT_PROMO_ID) return;

    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [imagePath]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, CURRENT_PROMO_ID);
    setOpen(false);
  };

  if (!imagePath || !open) return null;

  return (
    <div
      className="promo-modal-overlay"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
    >
      <div className="promo-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="promo-modal__close" onClick={close} aria-label="Close">
          ×
        </button>
        <img src={imagePath} alt={imageAlt} className="promo-modal__image" />
      </div>
    </div>
  );
}
