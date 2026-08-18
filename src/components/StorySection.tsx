"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";
import CakeIllustration from "./CakeIllustration";
import Donut from "./Donut";
import { storyStats } from "../data/content";
import "./StorySection.css";

export default function StorySection() {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const imgRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="story" className="story">
      <div className="container story__inner">
        <div ref={imgRef} className="story__art reveal">
          <div className="story__art-blob" aria-hidden="true" />
          <CakeIllustration flavor="red-velvet" icing="#fff5fa" icingSoft="#fff" topping="flowers" tiers={2} size={280} />
          <Donut className="story__donut" size={64} rotate={-16} />
        </div>

        <div ref={revealRef} className="story__copy reveal">
          <span className="section-eyebrow">Our Story</span>
          <h2>Baked from a tiny kitchen, made with a lot of heart</h2>
          <p>
            Vanessa's cake started in 2013 in a cramped apartment kitchen with one oven and
            a big dream: to make cakes that felt like a warm hug. What began with birthday
            orders for neighbors has grown into a full pastel-colored studio — but every
            cake is still mixed, layered, and frosted by hand.
          </p>
          <p>
            We believe dessert should be playful. That's why our cakes lean into soft
            colors, whimsical toppings, and a signature pink donut on every box — a little
            reminder to enjoy the sweeter side of life.
          </p>

          <div className="story__stats">
            {storyStats.map((s) => (
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
