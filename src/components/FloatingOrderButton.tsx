import Link from "next/link";
import "./FloatingOrderButton.css";

export default function FloatingOrderButton() {
  return (
    <Link href="/order" className="fob" aria-label="Order a cake">
      <span className="fob__icon">🎂</span>
      <span className="fob__label">Order Now</span>
    </Link>
  );
}
