import type { Metadata } from "next";
import Donut from "../../components/Donut";

export const metadata: Metadata = {
  title: "We'll be right back — Vanessa's cake",
};

export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "2rem 1.5rem",
        textAlign: "center",
        background: "var(--cream)",
        color: "var(--text)",
      }}
    >
      <Donut size={96} />
      <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}>
        We&apos;re baking something new!
      </h1>
      <p style={{ margin: 0, maxWidth: 480, color: "var(--text-soft)", fontSize: "1.05rem" }}>
        Our site is under development. We&apos;ll be back shortly — thank you for your patience.
      </p>
      <p style={{ margin: 0, fontSize: "1.1rem" }}>
        For orders, please call or text{" "}
        <a href="tel:9788866232" style={{ color: "var(--pink-600)", fontWeight: 600 }}>
          978-886-6232
        </a>
      </p>
    </main>
  );
}
