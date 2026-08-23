"use client";

import { useEffect } from "react";
import { useCart } from "../../lib/cart/CartContext";

/** Rendered only on the thank-you page — arriving there reliably means the
 *  checkout succeeded, so the cart that was just submitted should empty. */
export default function ClearCartOnMount() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
