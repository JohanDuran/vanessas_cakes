import type { Answers } from "./pricing";

export type ConstraintPair = { optionAId: number; optionBId: number };

/** Option ids within `targetFieldId` that are excluded by whatever is
 *  currently selected in the *other* fields' answers. The wizard removes
 *  these from the rendered option list entirely — they are not merely
 *  disabled. */
export function getHiddenOptionIds(
  targetFieldId: number,
  answers: Answers,
  pairs: ConstraintPair[]
): Set<number> {
  const selectedIds = new Set<number>();
  for (const [fieldIdStr, answer] of Object.entries(answers)) {
    if (Number(fieldIdStr) === targetFieldId) continue;
    if (answer.type === "options") {
      for (const id of answer.optionIds) selectedIds.add(id);
    }
  }

  const hidden = new Set<number>();
  for (const pair of pairs) {
    if (selectedIds.has(pair.optionAId)) hidden.add(pair.optionBId);
    if (selectedIds.has(pair.optionBId)) hidden.add(pair.optionAId);
  }
  return hidden;
}

/** True if any two currently-selected options (across all fields) form an excluded pair. */
export function selectionsViolateConstraints(answers: Answers, pairs: ConstraintPair[]): boolean {
  const ids = new Set<number>();
  for (const answer of Object.values(answers)) {
    if (answer.type === "options") {
      for (const id of answer.optionIds) ids.add(id);
    }
  }
  return pairs.some((p) => ids.has(p.optionAId) && ids.has(p.optionBId));
}

/** Clears any option that's become excluded by another field's selection, so
 *  the wizard never carries forward a now-impossible combination. For a
 *  single_select field this empties its answer entirely (forcing a re-pick,
 *  same as before); for multi_select it just drops the conflicting option(s)
 *  and keeps the rest. Runs to a fixed point since clearing one option can
 *  itself un-exclude or re-exclude another. */
export function resolveAnswers(answers: Answers, pairs: ConstraintPair[]): Answers {
  const current: Answers = { ...answers };
  for (let i = 0; i < Object.keys(current).length + 1; i++) {
    let changed = false;
    for (const fieldIdStr of Object.keys(current)) {
      const fieldId = Number(fieldIdStr);
      const answer = current[fieldId];
      if (answer.type !== "options") continue;

      const hidden = getHiddenOptionIds(fieldId, current, pairs);
      const filtered = answer.optionIds.filter((id) => !hidden.has(id));
      if (filtered.length !== answer.optionIds.length) {
        changed = true;
        if (filtered.length === 0) {
          delete current[fieldId];
        } else {
          current[fieldId] = { type: "options", optionIds: filtered };
        }
      }
    }
    if (!changed) break;
  }
  return current;
}
