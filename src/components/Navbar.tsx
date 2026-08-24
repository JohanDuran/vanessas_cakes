"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Donut from "./Donut";
import { useCart } from "../lib/cart/CartContext";
import { useUser } from "../lib/user/UserContext";
import { logout } from "../app/account/actions";
import "./Navbar.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { items } = useCart();
  const user = useUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="container navbar__inner">
        <Link href="/" className="navbar__brand">
          <Donut size={38} />
          <span>Vanessa's cake</span>
        </Link>

        <nav className={`navbar__links ${open ? "navbar__links--open" : ""}`}>
          <Link href="/gallery">Gallery</Link>
          <Link href="/order/custom">Custom Cake</Link>
          {user?.isAdmin && <Link href="/admin">Admin</Link>}
          {user ? (
            <div className="navbar__account">
              <Link
                href="/account"
                className="navbar__icon-link"
                aria-label="My Account"
                title="My Account"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
              </Link>
              <div className="navbar__account-menu">
                <Link href="/account">My Profile</Link>
                <form action={logout}>
                  <button type="submit">Log Out</button>
                </form>
              </div>
            </div>
          ) : (
            <Link
              href="/account/login"
              className="navbar__icon-link"
              aria-label="Log In"
              title="Log In"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </Link>
          )}
          <Link href="/cart" className="navbar__cart navbar__icon-link" aria-label="Cart" title="Cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.5 2.5h2l2.6 12.6a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6l1.3-7.1H6" />
            </svg>
            {items.length > 0 && <span className="navbar__cart-badge">{items.length}</span>}
          </Link>
        </nav>

        <button
          className="navbar__burger"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
