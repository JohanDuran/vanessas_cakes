import { Link } from "react-router-dom";
import Donut from "./Donut";
import "./Footer.css";

type SocialLink = {
  name: string;
  href: string;
  icon: (props: { size: number }) => React.ReactElement;
};

const IconInstagram = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const IconFacebook = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M14.5 8.5h2.5V5.2h-2.7c-2.4 0-3.8 1.5-3.8 3.9v2.1H8.3v3.3h2.2V21h3.4v-6.5h2.5l.5-3.3h-3V9.4c0-.6.3-.9.6-.9Z" strokeLinejoin="round" />
  </svg>
);

const IconTikTok = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3v10.6a3.4 3.4 0 1 1-3.4-3.4" />
    <path d="M15 3c.5 2.6 2.2 4.2 4.6 4.4" />
  </svg>
);

const IconPinterest = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 18.5c.6-2 1.4-5.3 1.4-5.3M12 12a2.7 2.7 0 1 0 2.7-3.6c-1.9-.5-3.7.5-4.1 2.4" />
  </svg>
);

const socialLinks: SocialLink[] = [
  { name: "Instagram", href: "https://instagram.com/vanessascakes", icon: IconInstagram },
  { name: "Facebook", href: "https://facebook.com/vanessascakes", icon: IconFacebook },
  { name: "TikTok", href: "https://tiktok.com/@vanessascakes", icon: IconTikTok },
  { name: "Pinterest", href: "https://pinterest.com/vanessascakes", icon: IconPinterest },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__bg" aria-hidden="true">
        <span className="footer__blob footer__blob--pink" />
        <span className="footer__blob footer__blob--mint" />
        <span className="footer__blob footer__blob--lavender" />
        <span className="footer__blob footer__blob--yellow" />
        <span className="footer__blob footer__blob--peach" />
        <span className="footer__spark" />
      </div>

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

        <div className="footer__social">
          {socialLinks.map(({ name, href, icon: Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className="footer__social-link"
            >
              <Icon size={19} />
            </a>
          ))}
        </div>

        <p className="footer__copy">© {new Date().getFullYear()} Vanessa's cake. All sweetness reserved.</p>
      </div>
    </footer>
  );
}
