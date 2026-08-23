"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Answers } from "../pricing";

export type CartItem = {
  clientId: string;
  designId: number | null;
  isCustom: boolean;
  answers: Answers;
  referenceImages: File[];
};

export type ContactFields = { name: string; email: string; phone: string; comments: string };

type CartContextValue = {
  items: CartItem[];
  contact: ContactFields;
  pickupDate: string | null;
  pickupTime: string | null;
  addItem: (item: Omit<CartItem, "clientId">) => string;
  updateItem: (clientId: string, patch: Partial<Omit<CartItem, "clientId">>) => void;
  removeItem: (clientId: string) => void;
  getItem: (clientId: string) => CartItem | undefined;
  setContact: (patch: Partial<ContactFields>) => void;
  setPickup: (date: string, time: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CONTACT: ContactFields = { name: "", email: "", phone: "", comments: "" };

function makeClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** In-memory, browser-only cart — provided once at the root layout so it
 *  survives client-side navigation between /gallery, /order/*, and /cart
 *  (the root layout stays mounted across route changes), but resets on a
 *  real page reload. Nothing here ever touches the database — the whole
 *  cart is only written to the server on final checkout submit. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [contact, setContactState] = useState<ContactFields>(EMPTY_CONTACT);
  const [pickupDate, setPickupDate] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);

  const addItem = useCallback((item: Omit<CartItem, "clientId">) => {
    const clientId = makeClientId();
    setItems((prev) => [...prev, { ...item, clientId }]);
    return clientId;
  }, []);

  const updateItem = useCallback((clientId: string, patch: Partial<Omit<CartItem, "clientId">>) => {
    setItems((prev) => prev.map((i) => (i.clientId === clientId ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((clientId: string) => {
    setItems((prev) => prev.filter((i) => i.clientId !== clientId));
  }, []);

  const getItem = useCallback((clientId: string) => items.find((i) => i.clientId === clientId), [items]);

  const setContact = useCallback((patch: Partial<ContactFields>) => {
    setContactState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setPickup = useCallback((date: string, time: string) => {
    setPickupDate(date);
    setPickupTime(time);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setContactState(EMPTY_CONTACT);
    setPickupDate(null);
    setPickupTime(null);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      contact,
      pickupDate,
      pickupTime,
      addItem,
      updateItem,
      removeItem,
      getItem,
      setContact,
      setPickup,
      clearCart,
    }),
    [items, contact, pickupDate, pickupTime, addItem, updateItem, removeItem, getItem, setContact, setPickup, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
