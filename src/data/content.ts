import type { CakeFlavor, CakeTopping } from "../components/CakeIllustration";

export type SlideCake = {
  id: string;
  name: string;
  description: string;
  flavor: CakeFlavor;
  icing: string;
  icingSoft: string;
  topping: CakeTopping;
  tiers: 1 | 2;
};

export const slideshowCakes: SlideCake[] = [
  {
    id: "berry-bliss",
    name: "Berry Bliss Cake",
    description: "Vanilla sponge, whipped cream, and a crown of fresh berries.",
    flavor: "vanilla",
    icing: "#ffd6e8",
    icingSoft: "#fff0f6",
    topping: "berries",
    tiers: 2,
  },
  {
    id: "choco-drip",
    name: "Midnight Choco Drip",
    description: "Rich chocolate layers with a glossy pink drip finish.",
    flavor: "chocolate",
    icing: "#ff9dc4",
    icingSoft: "#ffc9e3",
    topping: "drip",
    tiers: 2,
  },
  {
    id: "velvet-bloom",
    name: "Velvet Bloom",
    description: "Classic red velvet dressed in cream-cheese frosting and sugar flowers.",
    flavor: "red-velvet",
    icing: "#fff5fa",
    icingSoft: "#ffffff",
    topping: "flowers",
    tiers: 2,
  },
  {
    id: "marble-party",
    name: "Marble Sprinkle Party",
    description: "Swirled marble crumb, pastel icing, and a shower of sprinkles.",
    flavor: "marble",
    icing: "#e3d6fb",
    icingSoft: "#f6f0ff",
    topping: "sprinkles",
    tiers: 1,
  },
  {
    id: "lemon-gold",
    name: "Golden Lemon Kiss",
    description: "Zesty lemon cake finished with delicate gold leaf accents.",
    flavor: "lemon",
    icing: "#fff6d6",
    icingSoft: "#fffbe8",
    topping: "gold",
    tiers: 1,
  },
];
