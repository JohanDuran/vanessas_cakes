"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  images: File[];
  onImagesChange: (files: File[]) => void;
  /** set when this quote started from a Portfolio photo's "Get a Quote" button —
   *  that photo is the fixed reference image and no other attachments are allowed. */
  lockedImagePath?: string | null;
};

export default function CustomCakeQuoteStep({ images, onImagesChange, lockedImagePath }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  return (
    <div className="wizard-step custom-quote">
      <h2>Custom Cake Quote</h2>

      <div className="custom-quote__banner">
        <p>
          Designing something one-of-a-kind? For custom cakes, <strong>every field in this wizard is
          optional</strong> — fill in as much or as little as you already know.
        </p>
        <p>The more details you can share now, the easier it'll be for us to put together your quote.</p>
        <p>We'll reach out to you within <strong>24 hours</strong>.</p>
      </div>

      <div className="wizard-field">
        <label htmlFor={lockedImagePath ? undefined : "customQuoteImages"}>
          {lockedImagePath ? "Reference image" : "Reference images (optional)"}
        </label>
        {lockedImagePath ? (
          <>
            <p className="custom-quote__locked-note">
              This is the photo you picked from our Portfolio — attachments aren't available for
              portfolio quotes.
            </p>
            <div className="custom-quote__previews">
              <div className="custom-quote__preview">
                <img src={lockedImagePath} alt="Your Portfolio pick" />
              </div>
            </div>
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              id="customQuoteImages"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) onImagesChange([...images, ...files]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            {previewUrls.length > 0 && (
              <div className="custom-quote__previews">
                {previewUrls.map((url, i) => (
                  <div key={url} className="custom-quote__preview">
                    <img src={url} alt={`Reference ${i + 1}`} />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
