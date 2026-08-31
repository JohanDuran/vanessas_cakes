import Link from "next/link";
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
        <p className="footer__tag">Homestead handmane cakes, baked fresh every day with a lot of love.</p>
        <nav className="footer__links">
          <a href="/#story">Our Story</a>
          <Link href="/gallery">Shop our Collection</Link>
          <a href="/#social">Follow Us</a>
        </nav>
        <p className="footer__copy">© {new Date().getFullYear()} Vanessa's cake. All sweetness reserved.</p>
      </div>
    </footer>
  );
}
