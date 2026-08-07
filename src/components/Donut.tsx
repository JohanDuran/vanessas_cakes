import logo from "../assets/vanessa-bakery-logo.png";

type DonutProps = {
  size?: number;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
};

/** The Vanessa's Bakery badge, used as a decorative motif throughout the site. */
export default function Donut({ size = 90, rotate = 0, className, style }: DonutProps) {
  return (
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: "50%",
        transform: `rotate(${rotate}deg)`,
        objectFit: "cover",
        ...style,
      }}
    />
  );
}
