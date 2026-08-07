export type DragKind = "flavor" | "filling" | "decoration";

export type FlavorOption = {
  id: string;
  kind: "flavor";
  name: string;
  crumb: string;
  crumbDark: string;
  swatch: string;
  price: number;
};

export type FillingOption = {
  id: string;
  kind: "filling";
  name: string;
  color: string;
  price: number;
};

export type DecorationOption = {
  id: string;
  kind: "decoration";
  name: string;
  emoji: string;
  price: number;
};

export type SizeOption = {
  id: string;
  name: string;
  diameter: string;
  serves: number;
  tiers: 1 | 2;
  price: number;
};

export const flavors: FlavorOption[] = [
  { id: "chocolate", kind: "flavor", name: "Chocolate", crumb: "#8a5a3b", crumbDark: "#6b4226", swatch: "#8a5a3b", price: 0 },
  { id: "vanilla", kind: "flavor", name: "Vanilla", crumb: "#fff2d6", crumbDark: "#f5dfa8", swatch: "#f5dfa8", price: 0 },
  { id: "red-velvet", kind: "flavor", name: "Red Velvet", crumb: "#c1355e", crumbDark: "#9c2249", swatch: "#c1355e", price: 4 },
  { id: "marble", kind: "flavor", name: "Marble", crumb: "#f3e6d8", crumbDark: "#8a5a3b", swatch: "#c9a273", price: 3 },
];

export const fillings: FillingOption[] = [
  { id: "strawberry", kind: "filling", name: "Strawberry Jam", color: "#ff8fa3", price: 3 },
  { id: "chocolate-ganache", kind: "filling", name: "Chocolate Ganache", color: "#5c3a21", price: 4 },
  { id: "vanilla-cream", kind: "filling", name: "Vanilla Cream", color: "#fff3d6", price: 2 },
  { id: "lemon-curd", kind: "filling", name: "Lemon Curd", color: "#ffe066", price: 3 },
  { id: "salted-caramel", kind: "filling", name: "Salted Caramel", color: "#c98a3e", price: 4 },
  { id: "cream-cheese", kind: "filling", name: "Cream Cheese", color: "#fdf6e3", price: 3 },
];

export const decorations: DecorationOption[] = [
  { id: "sprinkles", kind: "decoration", name: "Sprinkles", emoji: "✨", price: 2 },
  { id: "berries", kind: "decoration", name: "Fresh Berries", emoji: "🍓", price: 5 },
  { id: "drip", kind: "decoration", name: "Choco Drip", emoji: "🍫", price: 4 },
  { id: "flowers", kind: "decoration", name: "Sugar Flowers", emoji: "🌸", price: 6 },
  { id: "gold", kind: "decoration", name: "Gold Leaf", emoji: "✦", price: 8 },
  { id: "donut", kind: "decoration", name: "Mini Donut", emoji: "🍩", price: 4 },
  { id: "macaron", kind: "decoration", name: "Macarons", emoji: "🟣", price: 5 },
  { id: "cherry", kind: "decoration", name: "Cherry", emoji: "🍒", price: 2 },
];

export const sizes: SizeOption[] = [
  { id: "s", name: "Small", diameter: '6"', serves: 8, tiers: 1, price: 35 },
  { id: "m", name: "Medium", diameter: '8"', serves: 14, tiers: 1, price: 52 },
  { id: "l", name: "Large", diameter: '10"', serves: 22, tiers: 1, price: 74 },
  { id: "xl", name: "XL Two-Tier", diameter: '12"', serves: 36, tiers: 2, price: 110 },
];

export const MAX_DECORATIONS = 10;
