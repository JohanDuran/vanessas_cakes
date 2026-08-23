"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Donut from "./Donut";
import { useCart } from "../lib/cart/CartContext";
import "./Navbar.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { items } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isHome = pathname === "/";

  return (
    <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="container navbar__inner">
        <Link href="/" className="navbar__brand">
          <Donut size={38} />
          <span>Vanessa's cake</span>
        </Link>

        <nav className={`navbar__links ${open ? "navbar__links--open" : ""}`}>
          {isHome ? (
            <>
              <a href="#story" onClick={() => setOpen(false)}>Our Story</a>
              <a href="#reviews" onClick={() => setOpen(false)}>Reviews</a>
            </>
          ) : (
            <Link href="/">Home</Link>
          )}
          <Link href="/gallery">Gallery</Link>
          <Link href="/order/custom">Custom Cake</Link>
          <Link href="/cart" className="navbar__cart">
            Cart
            {items.length > 0 && <span className="navbar__cart-badge">{items.length}</span>}
          </Link>
          <Link href="/gallery" className="btn btn-primary navbar__cta">
            Design Your Cake
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
