/** A little spinning donut — sprinkles and all — for anywhere the app needs
 *  to say "hang on, this is processing" without a generic spinner. Purely
 *  presentational; size is the rendered width/height in px. */
export default function DonutSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="donut-spinner"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="status"
      aria-label="Loading"
    >
      <circle className="donut-spinner__ring" cx="20" cy="20" r="16" />
      <circle className="donut-spinner__hole" cx="20" cy="20" r="6.5" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--1" cx="20" cy="5.5" r="1.8" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--2" cx="32.5" cy="12.75" r="1.8" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--3" cx="32.5" cy="27.25" r="1.8" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--4" cx="20" cy="34.5" r="1.8" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--5" cx="7.5" cy="27.25" r="1.8" />
      <circle className="donut-spinner__sprinkle donut-spinner__sprinkle--6" cx="7.5" cy="12.75" r="1.8" />
    </svg>
  );
}
