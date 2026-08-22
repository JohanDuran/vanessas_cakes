import type { fieldOptions, tierPresetLevels, tierPresets } from "../../../../db/schema";

export type DesignTierPresetSummary = {
  fieldOptionId: number;
  levelCount: number;
  levels: { moldName: string }[];
};

/** Shared by the new/edit design pages — both need the same lightweight
 *  "which tier_size options exist, and what molds make each one up" summary
 *  so DesignForm can filter/label tier_size choices by the drafted tier count. */
export function buildTierPresetSummaries(
  allOptions: (typeof fieldOptions.$inferSelect)[],
  presetRows: (typeof tierPresets.$inferSelect)[],
  levelRows: (typeof tierPresetLevels.$inferSelect)[]
): DesignTierPresetSummary[] {
  const optionNameById = new Map(allOptions.map((o) => [o.id, o.name]));
  const levelsByPresetId = new Map<number, typeof levelRows>();
  for (const row of levelRows) {
    const list = levelsByPresetId.get(row.tierPresetId) ?? [];
    list.push(row);
    levelsByPresetId.set(row.tierPresetId, list);
  }

  return presetRows.map((preset) => ({
    fieldOptionId: preset.fieldOptionId,
    levelCount: preset.levelCount,
    levels: (levelsByPresetId.get(preset.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((lvl) => ({ moldName: optionNameById.get(lvl.moldOptionId) ?? "Unknown" })),
  }));
}
