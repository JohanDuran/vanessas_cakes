"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";
import "./SocialSection.css";

const socialLinks = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vanessascakenh/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/pastelvane",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14.5 8.5h2V5.2c-.35-.05-1.55-.15-2.95-.15-2.92 0-4.92 1.83-4.92 5.2v2.7H5.9v3.7h2.73V21h3.7v-4.35h2.83l.45-3.7h-3.28V10.6c0-1.07.29-1.8 1.87-1.8Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/@easyconvane",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="18" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10.5 9.7v4.6l4-2.3-4-2.3Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@easyconvane",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16.3 3.5c.4 2.1 1.7 3.5 3.9 3.7v2.9c-1.4.1-2.7-.3-3.9-1.1v6.3c0 3.2-2.6 5.2-5.4 5.2-2.9 0-5.4-2.1-5.4-5.2 0-3.2 2.9-5.5 6-5v3.1c-.4-.2-.9-.3-1.4-.3-1.3 0-2.4 1-2.4 2.4 0 1.4 1.1 2.4 2.4 2.4 1.4 0 2.6-1 2.6-2.4V3.5h3.6Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/9788866232",
    icon: (
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
    ),
  },
];

export default function SocialSection() {
  const headRef = useScrollReveal<HTMLDivElement>();
  const gridRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="social" className="social">
      <div className="container">
        <div ref={headRef} className="social__head reveal">
          <span className="section-eyebrow">Stay Sweet With Us</span>
          <h2>Follow our latest creations</h2>
        </div>

        <div ref={gridRef} className="social__grid reveal">
          {socialLinks.map((s) => (
            <a
              key={s.id}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`social-card social-card--${s.id}`}
              aria-label={s.label}
            >
              <span className="social-card__icon">{s.icon}</span>
              <span className="social-card__label">{s.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
