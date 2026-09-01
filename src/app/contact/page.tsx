import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact Us — Vanessa's cake",
};

const PHONE_DISPLAY = "978-886-6232";
const PHONE_TEL = "+19788866232";
const WHATSAPP_URL = "https://wa.me/19788866232";
const EMAIL = "info@vanessascake.com";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 3.5c-1.7 0-3 1.3-3 3 0 8.3 6.7 15 15 15 1.7 0 3-1.3 3-3v-2.1c0-.5-.3-.9-.8-1l-3.4-.8c-.4-.1-.9 0-1.1.4l-1 1.3a12.4 12.4 0 0 1-5.9-5.9l1.3-1c.4-.3.5-.7.4-1.1l-.8-3.4c-.1-.5-.5-.8-1-.8H6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3.5a8.5 8.5 0 0 0-7.35 12.75L3.5 20.5l4.4-1.13A8.5 8.5 0 1 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 9.6c.1-.7.5-.8.8-.8h.5c.2 0 .4 0 .6.5l.6 1.5c.1.2 0 .4-.1.5l-.5.6c-.1.1-.1.3 0 .5.3.6 1.4 1.9 2.9 2.4.2.1.4 0 .5-.1l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.3.3.5 0 .5-.4 1.3-1 1.5-.9.4-1.9.3-3.5-.5-1.9-1-3.1-2.8-3.4-3.3-.3-.5-.8-1.5-.6-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5.5" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 7.2l7.3 5.6a1.2 1.2 0 0 0 1.4 0L20 7.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <header className="contact-hero">
        <div className="container">
          <span className="section-eyebrow">Get In Touch</span>
          <h1>Contact Us</h1>
          <p>
            Vanessa&apos;s cake is a homestead bakery — every cake is baked fresh, from scratch in our house in Nashua, NH. Reach out below and let&apos;s talk about your cake.
          </p>
        </div>
      </header>

      <section className="contact-section">
        <div className="container contact__grid">
          <div className="contact-card">
            <span className="section-eyebrow">Homestead Bakery</span>
            <h2>Baked in a home kitchen, with love</h2>
            <p>
              We&apos;re a small, home-based (homestead) bakery, not a storefront — every order is
              made fresh from scratch in small batches, so each cake gets our full attention.
            </p>

            <h2>Delivery &amp; pickup</h2>
            <p>
              Local delivery is available around Nashua, NH, or you&apos;re welcome to pick up your
              order directly from our home. Delivery availability and any fees are
              confirmed when we schedule your order.
            </p>
          </div>

          <div className="contact-card contact-card--details">
            <h2>Reach us</h2>
            <ul className="contact-list">
              <li>
                <a href={`tel:${PHONE_TEL}`} className="contact-list__link">
                  <span className="contact-list__icon">
                    <PhoneIcon />
                  </span>
                  <span className="contact-list__text">
                    <strong>Call or text</strong>
                    {PHONE_DISPLAY}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-list__link"
                >
                  <span className="contact-list__icon">
                    <WhatsAppIcon />
                  </span>
                  <span className="contact-list__text">
                    <strong>WhatsApp</strong>
                    {PHONE_DISPLAY}
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className="contact-list__link">
                  <span className="contact-list__icon">
                    <MailIcon />
                  </span>
                  <span className="contact-list__text">
                    <strong>Email</strong>
                    {EMAIL}
                  </span>
                </a>
              </li>
              <li className="contact-list__static">
                <span className="contact-list__icon">
                  <PinIcon />
                </span>
                <span className="contact-list__text">
                  <strong>Location</strong>
                  Nashua, NH
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
