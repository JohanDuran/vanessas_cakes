"use client";

import { useState, type FormEvent } from "react";
import { FIELD_TYPES, FIELD_TYPE_LABELS, fieldHasOptions, type FieldType } from "../../lib/fields";
import { quickCreateField } from "../../app/admin/(protected)/catalog/actions";
import { useToast } from "../ToastProvider";
import DonutSpinner from "../DonutSpinner";
import FieldOptionsEditor, { type OptionDraft } from "./FieldOptionsEditor";
import type { FieldSummary } from "./DesignForm";

type Props = {
  onClose: () => void;
  onCreated: (field: FieldSummary) => void;
};

export default function QuickAddFieldModal({ onClose, onCreated }: Props) {
  const { push: pushToast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [additionalPriceDollars, setAdditionalPriceDollars] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      pushToast("error", "Name is required.");
      return;
    }
    if (fieldHasOptions(type) && options.length === 0) {
      pushToast("error", "Add at least one option.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("type", type);
      formData.set("optionsJson", JSON.stringify(options));
      formData.set("additionalPriceDollars", additionalPriceDollars);
      const saved = await quickCreateField(formData);
      onCreated({
        id: saved.id,
        slug: saved.slug,
        name: saved.name,
        type: saved.type as FieldType,
        isBase: false,
        active: true,
        additionalPriceCents: saved.additionalPriceCents,
        options: saved.options.map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents, active: true })),
      });
    } catch {
      pushToast("error", "Couldn't create the field — double check the options and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal__header">
          <div>
            <span className="section-eyebrow">Quick Add</span>
            <h2 style={{ marginTop: 6 }}>New Field</h2>
          </div>
          <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-field">
            <label>Field name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div className="admin-field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as FieldType)} style={{ width: "100%" }}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {fieldHasOptions(type) && (
            <div className="admin-field">
              <label>Options</label>
              <FieldOptionsEditor options={options} onChange={setOptions} />
            </div>
          )}

          {!fieldHasOptions(type) && (
            <div className="admin-field">
              <label>Additional price ($)</label>
              <input
                type="number"
                step="0.01"
                value={additionalPriceDollars}
                onChange={(e) => setAdditionalPriceDollars(e.target.value)}
                style={{ minWidth: 110 }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              {submitting && <DonutSpinner size={16} />}
              {submitting ? "Adding…" : "Add Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
