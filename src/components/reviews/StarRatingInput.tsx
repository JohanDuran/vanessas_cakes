"use client";

import { useState } from "react";

type Props = {
  name: string;
  defaultValue?: number;
};

/** Interactive 5-star picker — a plain radio group under the hood so the
 *  chosen value posts with the form like any other field, styled as stars
 *  with hover preview on top. */
export default function StarRatingInput({ name, defaultValue = 0 }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="star-rating-input" role="radiogroup" aria-label="Star rating" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        return (
          <label key={star} className="star-rating-input__star">
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => setValue(star)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(0)}
              required
            />
            <span
              className={star <= shown ? "star-rating-input__glyph is-filled" : "star-rating-input__glyph"}
              onMouseEnter={() => setHover(star)}
            >
              ★
            </span>
          </label>
        );
      })}
    </div>
  );
}
