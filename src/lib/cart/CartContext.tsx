"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Answers } from "../pricing";
import { useUser } from "../user/UserContext";
import { useToast } from "../../components/ToastProvider";
import { addCartItemAction, updateCartItemAction, removeCartItemAction, mergeGuestCartAction, loadCartItemsAction } from "./dbActions";
import type { CartItemDTO } from "../../db/queries";

export type CartItem = {
  clientId: string;
  /** set once this item is persisted server-side — its DB primary key */
  dbId?: number;
  /** always points at a design — catalog or one of the two singleton
   *  quote-kind designs; "is this a quote" is a design.kind lookup, not a
   *  separate flag. */
  designId: number;
  answers: Answers;
  /** newly attached files not yet uploaded — always [] for an item loaded
   *  from the DB (its images already live on disk, see referenceImagePaths) */
  referenceImages: File[];
  /** already-uploaded reference photos, set only for DB-backed custom items */
  referenceImagePaths?: string[];
  /** an already-uploaded photo (e.g. a Portfolio pick via "Get a Quote") attached
   *  to this custom quote as-is — no re-upload needed, and the wizard disallows
   *  additional attachments while this is set. Only meaningful pre-checkout; once
   *  persisted it just becomes another row in referenceImagePaths. */
  lockedReferenceImagePath?: string | null;
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

/** Browser-only storage key for a guest's cart — never written to while
 *  signed in, so a stale guest cart can never bleed into someone's account. */
const GUEST_CART_KEY = "vanessa_guest_cart";

type StoredGuestItem = { clientId: string; designId: number; answers: Answers };

function makeClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dtoToCartItem(dto: CartItemDTO): CartItem {
  return {
    clientId: `db-${dto.id}`,
    dbId: dto.id,
    designId: dto.designId,
    answers: dto.answers,
    referenceImages: [],
    referenceImagePaths: dto.referenceImagePaths,
  };
}

function readGuestCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredGuestItem[];
    return parsed.map((p) => ({ ...p, referenceImages: [] }));
  } catch {
    return [];
  }
}

function writeGuestCartToStorage(items: CartItem[]) {
  try {
    const payload: StoredGuestItem[] = items.map(({ clientId, designId, answers }) => ({
      clientId,
      designId,
      answers,
    }));
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — cart just
    // stays in-memory for the rest of this tab's session
  }
}

function clearGuestCartStorage() {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // ignore
  }
}

async function mergeGuestCartIntoDb(guestItems: CartItem[]): Promise<CartItem[]> {
  if (guestItems.length === 0) {
    const loaded = await loadCartItemsAction();
    return loaded.map(dtoToCartItem);
  }
  const formData = new FormData();
  formData.set(
    "items",
    JSON.stringify(
      guestItems.map((i) => ({
        localId: i.clientId,
        designId: i.designId,
        answers: i.answers,
        lockedReferenceImagePath: i.lockedReferenceImagePath ?? null,
      }))
    )
  );
  for (const item of guestItems) {
    for (const file of item.referenceImages) formData.append(`files_${item.clientId}`, file);
  }
  const merged = await mergeGuestCartAction(formData);
  return merged.map(dtoToCartItem);
}

/** The customer's cart — persisted in the database while signed in (so it
 *  follows them across devices and survives a logout/login) and in
 *  localStorage while a guest (so it survives a reload, but never leaks
 *  between accounts). Provided once at the root layout so it survives
 *  client-side navigation between /gallery, /order/*, and /cart.
 *
 *  On login/signup, whatever was in the guest's browser cart is merged into
 *  their DB cart and the browser copy is dropped — the DB becomes the sole
 *  source of truth from then on. On logout, the DB rows are left completely
 *  untouched; only the in-memory/UI state is cleared, so the cart picks back
 *  up right where it was the next time that customer logs back in. */
export function CartProvider({
  initialItems = [],
  children,
}: {
  initialItems?: CartItemDTO[];
  children: ReactNode;
}) {
  const user = useUser();
  const { push: pushToast } = useToast();
  const [items, setItems] = useState<CartItem[]>(() => initialItems.map(dtoToCartItem));
  const [contact, setContactState] = useState<ContactFields>(EMPTY_CONTACT);
  const [pickupDate, setPickupDate] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const clearCart = useCallback(() => {
    setItems([]);
    setContactState(EMPTY_CONTACT);
    setPickupDate(null);
    setPickupTime(null);
    clearGuestCartStorage();
  }, []);

  // Guests: hydrate once from localStorage on mount (logged-in customers
  // already got their cart from the server via `initialItems`). Every
  // mutation below writes straight back to storage at its own call site —
  // deliberately not a reactive `items`-watching effect, since that raced
  // with this hydration on mount (StrictMode's double effect invocation
  // could fire the write with the pre-hydration `[]` and clobber storage
  // right after this read).
  useEffect(() => {
    if (user) return;
    setItems(readGuestCartFromStorage());
    // run once, at mount, before any login/logout transition could fire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Covers logins that land here via a hard browser redirect rather than a
  // client-side transition — Google sign-in (see auth/callback/route.ts)
  // remounts this provider already authenticated, so the transition effect
  // below never observes a guest -> logged-in change to react to. If a
  // guest cart is still sitting in localStorage from before that redirect,
  // fold it into the DB cart now.
  useEffect(() => {
    if (!user) return;
    const guestItems = readGuestCartFromStorage();
    if (guestItems.length === 0) return;
    clearGuestCartStorage();
    mergeGuestCartIntoDb(guestItems)
      .then(setItems)
      .catch((err) => {
        console.error(err);
        pushToast("error", "Couldn't restore your saved cart — please refresh the page.");
      });
    // run once, at mount, before the transition effect's ref has a chance to diverge
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reacts to the signed-in user changing — login/signup, logout, or (rare)
  // switching accounts. clearCart() only ever touches local state; nothing
  // here ever deletes a DB row.
  const previousUserId = useRef(user?.id ?? null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (previousUserId.current === currentUserId) return;
    const wasGuest = previousUserId.current === null;
    previousUserId.current = currentUserId;

    if (currentUserId === null) {
      clearCart();
      return;
    }

    if (wasGuest) {
      const guestItems = itemsRef.current;
      clearGuestCartStorage();
      mergeGuestCartIntoDb(guestItems)
        .then(setItems)
        .catch((err) => {
          console.error(err);
          pushToast("error", "Couldn't restore your saved cart — please refresh the page.");
        });
    } else {
      loadCartItemsAction()
        .then((loaded) => setItems(loaded.map(dtoToCartItem)))
        .catch((err) => {
          console.error(err);
          pushToast("error", "Couldn't load your cart — please refresh the page.");
        });
    }
  }, [user, clearCart, pushToast]);

  // Prefill contact fields from the signed-in user's profile — fires on
  // mount for an already-logged-in customer and again right after a
  // guest logs in mid-checkout. Uses `||` so it never clobbers anything
  // the customer already typed themselves.
  useEffect(() => {
    if (!user) return;
    setContactState((prev) => ({
      name: prev.name || user.name,
      email: prev.email || user.email,
      phone: prev.phone || user.phone || "",
      comments: prev.comments,
    }));
  }, [user]);

  const addItem = useCallback(
    (item: Omit<CartItem, "clientId">) => {
      const clientId = makeClientId();
      setItems((prev) => {
        const next = [...prev, { ...item, clientId }];
        if (!user) writeGuestCartToStorage(next);
        return next;
      });

      if (user) {
        const formData = new FormData();
        formData.set("designId", String(item.designId));
        formData.set("answers", JSON.stringify(item.answers));
        formData.set("lockedReferenceImagePath", item.lockedReferenceImagePath ?? "");
        item.referenceImages.forEach((f) => formData.append("referenceImages", f));
        addCartItemAction(formData)
          .then(({ id, referenceImagePaths }) => {
            setItems((prev) =>
              prev.map((i) =>
                i.clientId === clientId
                  ? {
                      ...i,
                      clientId: `db-${id}`,
                      dbId: id,
                      referenceImages: [],
                      referenceImagePaths,
                      lockedReferenceImagePath: null,
                    }
                  : i
              )
            );
          })
          .catch((err) => {
            console.error(err);
            // it was never actually persisted — drop the optimistic entry so the
            // cart doesn't show a cake that would vanish on the next page load
            setItems((prev) => prev.filter((i) => i.clientId !== clientId));
            pushToast("error", "Couldn't add that cake to your cart — please try again.");
          });
      }

      return clientId;
    },
    [user, pushToast]
  );

  const updateItem = useCallback(
    (clientId: string, patch: Partial<Omit<CartItem, "clientId">>) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.clientId === clientId ? { ...i, ...patch } : i));
        if (!user) writeGuestCartToStorage(next);
        return next;
      });

      if (user) {
        const current = itemsRef.current.find((i) => i.clientId === clientId);
        if (current?.dbId) {
          const merged = { ...current, ...patch };
          const formData = new FormData();
          formData.set("id", String(current.dbId));
          formData.set("designId", String(merged.designId));
          formData.set("answers", JSON.stringify(merged.answers));
          formData.set("lockedReferenceImagePath", merged.lockedReferenceImagePath ?? "");
          (patch.referenceImages ?? []).forEach((f) => formData.append("referenceImages", f));
          updateCartItemAction(formData)
            .then(({ referenceImagePaths }) => {
              setItems((prev) =>
                prev.map((i) =>
                  i.clientId === clientId
                    ? { ...i, referenceImages: [], referenceImagePaths, lockedReferenceImagePath: null }
                    : i
                )
              );
            })
            .catch((err) => {
              console.error(err);
              // the edit never actually saved — revert to what's still on the
              // server so the review step doesn't show a change that isn't real
              setItems((prev) => prev.map((i) => (i.clientId === clientId ? current : i)));
              pushToast("error", "Couldn't save that change — please try again.");
            });
        }
      }
    },
    [user, pushToast]
  );

  const removeItem = useCallback(
    (clientId: string) => {
      const current = itemsRef.current.find((i) => i.clientId === clientId);
      setItems((prev) => {
        const next = prev.filter((i) => i.clientId !== clientId);
        if (!user) writeGuestCartToStorage(next);
        return next;
      });
      if (user && current?.dbId) removeCartItemAction(current.dbId);
    },
    [user]
  );

  const getItem = useCallback((clientId: string) => items.find((i) => i.clientId === clientId), [items]);

  const setContact = useCallback((patch: Partial<ContactFields>) => {
    setContactState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setPickup = useCallback((date: string, time: string) => {
    setPickupDate(date);
    setPickupTime(time);
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
