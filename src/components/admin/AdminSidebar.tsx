"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../../app/account/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/designs", label: "Designs" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/constraints", label: "Constraints" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__top">
        <div className="admin-sidebar__brand">🎂 Vanessa's Admin</div>
        <button
          type="button"
          className="admin-sidebar__toggle"
          aria-label="Toggle admin menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <Link href="/" className="admin-sidebar__back">
        ← Back to site
      </Link>
      <nav className={`admin-sidebar__nav ${open ? "admin-sidebar__nav--open" : ""}`}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "is-active" : ""}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={logout}
        className={`admin-sidebar__logout ${open ? "admin-sidebar__logout--open" : ""}`}
      >
        <button type="submit">Log Out</button>
      </form>
    </aside>
  );
}
