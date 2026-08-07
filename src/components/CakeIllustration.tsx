export type CakeFlavor =
  | "chocolate"
  | "vanilla"
  | "red-velvet"
  | "marble"
  | "strawberry"
  | "lemon";

export type CakeTopping = "berries" | "flowers" | "drip" | "sprinkles" | "gold";

const FLAVOR_COLORS: Record<CakeFlavor, { crumb: string; crumbDark: string }> = {
  chocolate: { crumb: "#8a5a3b", crumbDark: "#6b4226" },
  vanilla: { crumb: "#fff2d6", crumbDark: "#f5dfa8" },
  "red-velvet": { crumb: "#c1355e", crumbDark: "#9c2249" },
  marble: { crumb: "#f3e6d8", crumbDark: "#8a5a3b" },
  strawberry: { crumb: "#ffc9d9", crumbDark: "#ff9db8" },
  lemon: { crumb: "#fff2a8", crumbDark: "#ffe066" },
};

type Props = {
  flavor?: CakeFlavor;
  icing?: string;
  icingSoft?: string;
  topping?: CakeTopping;
  tiers?: 1 | 2;
  size?: number;
  className?: string;
};

/** Decorative front-view cake illustration used in the hero, gallery, and cards. */
export default function CakeIllustration({
  flavor = "vanilla",
  icing = "#ffd6e8",
  icingSoft = "#fff0f6",
  topping = "sprinkles",
  tiers = 1,
  size = 220,
  className,
}: Props) {
  const c = FLAVOR_COLORS[flavor];
  const isMarble = flavor === "marble";

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${flavor.replace("-", " ")} cake`}
    >
      <defs>
        <linearGradient id={`icing-${flavor}-${topping}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={icingSoft} />
          <stop offset="100%" stopColor={icing} />
        </linearGradient>
        <radialGradient id={`plate-${flavor}-${topping}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3e9e0" />
        </radialGradient>
      </defs>

      <ellipse cx="120" cy="206" rx="98" ry="16" fill="rgba(107,66,38,0.14)" />
      <ellipse cx="120" cy="200" rx="92" ry="14" fill={`url(#plate-${flavor}-${topping})`} />

      {tiers === 2 && (
        <g>
          <rect x="60" y="150" width="120" height="42" rx="10" fill={c.crumb} />
          <rect x="60" y="150" width="120" height="12" rx="6" fill={c.crumbDark} opacity="0.5" />
        </g>
      )}

      <g>
        <rect
          x={tiers === 2 ? 74 : 46}
          y={tiers === 2 ? 96 : 108}
          width={tiers === 2 ? 92 : 148}
          height={tiers === 2 ? 62 : 92}
          rx="14"
          fill={c.crumb}
        />
        {isMarble && (
          <path
            d="M50 130 Q80 110 110 132 T170 128 M48 155 Q90 140 130 158 T190 150"
            stroke={c.crumbDark}
            strokeWidth="6"
            fill="none"
            opacity="0.55"
            strokeLinecap="round"
          />
        )}
        <rect
          x={tiers === 2 ? 74 : 46}
          y={tiers === 2 ? 96 : 108}
          width={tiers === 2 ? 92 : 148}
          height="14"
          rx="7"
          fill={c.crumbDark}
          opacity="0.45"
        />
      </g>

      <path
        d={
          tiers === 2
            ? "M70 100 Q82 82 94 100 Q106 82 118 100 Q130 82 142 100 Q154 82 166 100 L166 112 L70 112 Z"
            : "M40 112 Q56 88 72 112 Q88 88 104 112 Q120 88 136 112 Q152 88 168 112 Q184 88 200 112 L200 128 L40 128 Z"
        }
        fill={`url(#icing-${flavor}-${topping})`}
      />
      <path
        d={
          tiers === 2
            ? "M70 100 Q82 82 94 100 Q106 82 118 100 Q130 82 142 100 Q154 82 166 100"
            : "M40 112 Q56 88 72 112 Q88 88 104 112 Q120 88 136 112 Q152 88 168 112 Q184 88 200 112"
        }
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="2.5"
      />

      {topping === "drip" && (
        <g fill={icing}>
          <path d="M55 112 q-4 18 -1 22 q4 4 8 -4 q2 -8 -2 -18 Z" />
          <path d="M95 112 q3 24 7 26 q5 2 6 -8 q0 -10 -6 -18 Z" />
          <path d="M140 112 q-3 20 0 24 q4 3 7 -5 q1 -9 -2 -19 Z" />
          <path d="M180 112 q4 16 1 20 q-4 4 -7 -3 q-2 -8 1 -17 Z" />
        </g>
      )}

      {topping === "sprinkles" &&
        Array.from({ length: 16 }).map((_, i) => {
          const x = 55 + (i % 8) * 17 + (Math.floor(i / 8) % 2) * 6;
          const y = 95 - Math.floor(i / 8) * 10 + (i % 3) * 4;
          const colors = ["#ff8fbf", "#a9ecc9", "#ffe58a", "#cbb6f5", "#fff"];
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width="6"
              height="2.4"
              rx="1.2"
              fill={colors[i % colors.length]}
              transform={`rotate(${i * 47} ${x} ${y})`}
            />
          );
        })}

      {topping === "berries" && (
        <g>
          {[70, 110, 150, 185].map((x, i) => (
            <g key={i} transform={`translate(${x} ${96 - (i % 2) * 4})`}>
              <circle r="9" fill="#e0355c" />
              <circle r="9" fill="#ff5f82" opacity="0.5" cx="-2" cy="-2" />
              <path d="M0 -9 L0 -15 M-3 -12 L3 -12" stroke="#4c8a52" strokeWidth="2" />
            </g>
          ))}
        </g>
      )}

      {topping === "flowers" && (
        <g>
          {[65, 118, 172].map((x, i) => (
            <g key={i} transform={`translate(${x} ${94})`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse
                  key={a}
                  rx="7"
                  ry="4.5"
                  fill={i % 2 === 0 ? "#ffb8d9" : "#fff"}
                  transform={`rotate(${a}) translate(7 0)`}
                />
              ))}
              <circle r="4" fill="#ffe58a" />
            </g>
          ))}
        </g>
      )}

      {topping === "gold" && (
        <g fill="#f0c869">
          <path d="M60 100 l4 -10 4 10 -4 3 Z" />
          <path d="M120 92 l4 -12 4 12 -4 3 Z" />
          <path d="M175 100 l4 -10 4 10 -4 3 Z" />
        </g>
      )}
    </svg>
  );
}
