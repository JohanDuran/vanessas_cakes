import { FIELD_TYPES, FIELD_TYPE_LABELS } from "../../../../../lib/fields";
import { createField } from "../actions";

export const dynamic = "force-dynamic";

export default function NewFieldPage() {
  return (
    <>
      <h1>New Field</h1>
      <p className="admin-main__subtitle">
        Add a custom field customers can answer when ordering — attach it to any design from that
        design&apos;s edit page, then come back here to add its options.
      </p>
      <form
        action={createField}
        className="admin-card"
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div className="admin-form-row">
          <div className="admin-field" style={{ flex: 1, minWidth: 240 }}>
            <label>Field name</label>
            <input name="name" style={{ width: "100%" }} />
          </div>
          <div className="admin-field">
            <label>Type</label>
            <select name="type" defaultValue="single_select" style={{ minWidth: 220 }}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="required" name="required" value="1" />
            <label htmlFor="required" style={{ margin: 0 }}>
              Required (Text/Number/Per Size only)
            </label>
          </div>
          <div className="admin-field">
            <label>Additional price ($, Text/Number/Per Size only)</label>
            <input
              name="additionalPriceDollars"
              type="number"
              step="0.01"
              defaultValue="0"
              style={{ minWidth: 110 }}
            />
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary">
            Create Field
          </button>
        </div>
      </form>
    </>
  );
}
