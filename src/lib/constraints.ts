import type { Axis } from "./axes";
import type { Selections } from "./pricing";

export type ConstraintPair = { itemAId: number; itemBId: number };

/** Item ids in `targetAxis` that are excluded by whatever is currently
 *  selected in the *other* axes. The wizard removes these from the
 *  rendered option list entirely — they are not merely disabled. */
export function getHiddenItemIds(
  targetAxis: Axis,
  selections: Selections,
  pairs: ConstraintPair[]
): Set<number> {
  const selectedIds = new Set(
    Object.entries(selections)
      .filter(([axis]) => axis !== targetAxis)
      .map(([, id]) => id)
      .filter((id): id is number => id != null)
  );

  const hidden = new Set<number>();
  for (const pair of pairs) {
    if (selectedIds.has(pair.itemAId)) hidden.add(pair.itemBId);
    if (selectedIds.has(pair.itemBId)) hidden.add(pair.itemAId);
  }
  return hidden;
}

/** True if any two currently-selected items (across all axes) form an excluded pair. */
export function selectionsViolateConstraints(selections: Selections, pairs: ConstraintPair[]): boolean {
  const ids = new Set(Object.values(selections).filter((id): id is number => id != null));
  return pairs.some((p) => ids.has(p.itemAId) && ids.has(p.itemBId));
}

/** Clears any axis whose current selection has become excluded by another axis's
 *  selection, so the wizard never carries forward a now-impossible combination
 *  (e.g. after the user changes an earlier step). Runs to a fixed point since
 *  clearing one axis can itself un-exclude or re-exclude another. */
export function resolveSelections(selections: Selections, pairs: ConstraintPair[]): Selections {
  const current: Selections = { ...selections };
  for (let i = 0; i < Object.keys(current).length + 1; i++) {
    let changed = false;
    for (const axis of Object.keys(current) as Axis[]) {
      const itemId = current[axis];
      if (itemId == null) continue;
      if (getHiddenItemIds(axis, current, pairs).has(itemId)) {
        delete current[axis];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return current;
}
