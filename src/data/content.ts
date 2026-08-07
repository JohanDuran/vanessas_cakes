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

export const galleryCakes: SlideCake[] = [
  slideshowCakes[1],
  slideshowCakes[3],
  slideshowCakes[0],
  slideshowCakes[4],
  slideshowCakes[2],
  {
    id: "strawberry-dream",
    name: "Strawberry Dream",
    description: "Strawberry crumb with berry compote and pastel swirls.",
    flavor: "strawberry",
    icing: "#ffe0ea",
    icingSoft: "#fff5f8",
    topping: "berries",
    tiers: 1,
  },
];

export type Review = {
  id: string;
  name: string;
  rating: number;
  text: string;
  cake: string;
};

export const reviews: Review[] = [
  {
    id: "r1",
    name: "Amelia R.",
    rating: 5,
    text: "The marble sprinkle cake stole the show at my daughter's birthday. So soft, and not too sweet!",
    cake: "Marble Sprinkle Party",
  },
  {
    id: "r2",
    name: "Daniel K.",
    rating: 5,
    text: "Custom-built our wedding cake through their designer tool and it came out exactly like the preview. Incredible.",
    cake: "Velvet Bloom",
  },
  {
    id: "r3",
    name: "Priya S.",
    rating: 5,
    text: "Best chocolate cake in town, hands down. The drip finish is as good as it looks in photos.",
    cake: "Midnight Choco Drip",
  },
  {
    id: "r4",
    name: "Marco L.",
    rating: 4,
    text: "Beautiful presentation and friendly service. Will definitely be ordering again for the holidays.",
    cake: "Golden Lemon Kiss",
  },
];

export const storyStats = [
  { label: "Years Baking", value: "12+" },
  { label: "Cakes Delivered", value: "8,400+" },
  { label: "5-Star Reviews", value: "1,900+" },
];
