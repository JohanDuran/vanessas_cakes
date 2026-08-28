"use client";

import { createContext, useContext, type ReactNode } from "react";

export type CurrentUser = { id: string; name: string; email: string; phone: string | null; isAdmin: boolean };

const UserContext = createContext<CurrentUser | null>(null);

/** Seeded once per request from the root layout's server-side
 *  getCurrentUser() call — login/signup/logout all redirect through a full
 *  navigation, so this always reflects the session on page load. */
export function UserProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser | null;
  children: ReactNode;
}) {
  return <UserContext.Provider value={initialUser}>{children}</UserContext.Provider>;
}

export function useUser(): CurrentUser | null {
  return useContext(UserContext);
}
