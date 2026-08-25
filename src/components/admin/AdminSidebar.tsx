"use client";

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
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/admins", label: "Admins" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">🎂 Vanessa's Admin</div>
      <nav className="admin-sidebar__nav">
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
      <form action={logout} className="admin-sidebar__logout">
        <button type="submit">Log Out</button>
      </form>
    </aside>
  );
}
