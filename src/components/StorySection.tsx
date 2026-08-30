"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";
import CakeIllustration from "./CakeIllustration";
import Donut from "./Donut";
import "./StorySection.css";

type Props = {
  heading: string;
  paragraph1: string;
  paragraph2: string;
  /** Public URL of an admin-uploaded photo, or null to show the generated illustration. */
  imagePath: string | null;
  stats: { label: string; value: string }[];
};

export default function StorySection({ heading, paragraph1, paragraph2, imagePath, stats }: Props) {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const imgRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="story" className="story">
      <div className="container story__inner">
        <div ref={imgRef} className="story__art reveal">
          {!imagePath && <div className="story__art-blob" aria-hidden="true" />}
          {imagePath ? (
            <img src={imagePath} alt="" className="story__photo" />
          ) : (
            <>
              <CakeIllustration flavor="red-velvet" icing="#fff5fa" icingSoft="#fff" topping="flowers" tiers={2} size={280} />
              <Donut className="story__donut" size={64} rotate={-16} />
            </>
          )}
        </div>

        <div ref={revealRef} className="story__copy reveal">
          <span className="section-eyebrow">Our Story</span>
          <h2>{heading}</h2>
          <p>{paragraph1}</p>
          <p>{paragraph2}</p>

          <div className="story__stats">
            {stats.map((s) => (
              <div key={s.label} className="story__stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
