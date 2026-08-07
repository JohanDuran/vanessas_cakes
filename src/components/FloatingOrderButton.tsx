import { Link } from "react-router-dom";
import "./FloatingOrderButton.css";

export default function FloatingOrderButton() {
  return (
    <Link to="/customize" className="fob" aria-label="Order a cake">
      <span className="fob__icon">🎂</span>
      <span className="fob__label">Order Now</span>
    </Link>
  );
}
