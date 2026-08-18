export const AXES = [
  "size",
  "cake_type",
  "flavor",
  "filling",
  "frosting",
  "decoration",
] as const;

export type Axis = (typeof AXES)[number];

export const AXIS_LABELS: Record<Axis, string> = {
  size: "Size",
  cake_type: "Cake Type",
  flavor: "Flavor",
  filling: "Filling",
  frosting: "Frosting",
  decoration: "Decoration",
};

export function isAxis(value: string): value is Axis {
  return (AXES as readonly string[]).includes(value);
}
