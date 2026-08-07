import { Link } from "react-router-dom";
import Donut from "./Donut";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Donut size={40} />
          <span>Vanessa's cake</span>
        </div>
        <p className="footer__tag">Handmade pastel cakes, baked fresh every day.</p>
        <nav className="footer__links">
          <a href="/#story">Our Story</a>
          <a href="/#gallery">Gallery</a>
          <a href="/#reviews">Reviews</a>
          <Link to="/customize">Design a Cake</Link>
        </nav>
        <p className="footer__copy">© {new Date().getFullYear()} Vanessa's cake. All sweetness reserved.</p>
      </div>
    </footer>
  );
}
