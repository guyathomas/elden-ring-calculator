import { X } from "lucide-react";
import type { FilterValue } from "./column-filter";

// Map column keys to human-readable labels
const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  categoryName: "Type",
  affinity: "Affinity",
  damageType: "Dmg Type",
  weight: "Weight",
  trueCombos: "True Combos",
  buffable: "Buffable",
  uniqueAttacks: "Unique Attacks",
  physical: "Physical",
  magic: "Magic",
  fire: "Fire",
  lightning: "Lightning",
  holy: "Holy",
  totalAR: "Total AR",
  criticalDamage: "Critical",
  spellScaling: "Spell",
  efficiency: "Efficiency",
  damagePercent: "% Max",
  strScalingGrade: "STR Scaling",
  dexScalingGrade: "DEX Scaling",
  intScalingGrade: "INT Scaling",
  faiScalingGrade: "FAI Scaling",
  arcScalingGrade: "ARC Scaling",
  strReq: "STR Req",
  dexReq: "DEX Req",
  intReq: "INT Req",
  faiReq: "FAI Req",
  arcReq: "ARC Req",
  minLevel: "Min Level",
  pointsRequired: "Points Req",
  meetsReqs: "Meets Reqs",
  bleed: "Bleed",
  frost: "Frost",
  poison: "Poison",
  scarletRot: "Scarlet Rot",
  sleep: "Sleep",
  madness: "Madness",
  guardPhys: "Guard Phys",
  guardMag: "Guard Mag",
  guardFire: "Guard Fire",
  guardLtn: "Guard Ltn",
  guardHoly: "Guard Holy",
  guardBoost: "Guard Boost",
  starred: "In Build",
};

function formatFilterValue(value: FilterValue): string {
  switch (value.type) {
    case "set": {
      const items = Array.from(value.values);
      if (items.length <= 2) return items.join(", ");
      return `${items.length} selected`;
    }
    case "range": {
      if (value.min !== undefined && value.max !== undefined)
        return `${value.min}–${value.max}`;
      if (value.min !== undefined) return `≥ ${value.min}`;
      if (value.max !== undefined) return `≤ ${value.max}`;
      return "";
    }
    case "boolean":
      return value.value ? "Yes" : "No";
    case "text":
      return `"${value.value}"`;
  }
}

export function getDefaultFilters(): Record<string, FilterValue> {
  return {
    affinity: { type: "set", values: new Set(["Standard", "Unique"]) },
  };
}


interface ActiveFilterChipsProps {
  filters: Record<string, FilterValue>;
  onRemoveFilter: (columnKey: string) => void;
  onClearAll: () => void;
  onResetToDefaults?: () => void;
}

export function ActiveFilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
  onResetToDefaults: _onResetToDefaults,
}: ActiveFilterChipsProps) {
  const filterEntries = Object.entries(filters);
  const hasFilters = filterEntries.length > 0;

  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-b border-[#2a2a2a] overflow-x-auto">
      <span className="text-[10px] text-[#4a4a4a] uppercase tracking-wider shrink-0">
        Filters
      </span>
      {filterEntries.map(([key, value]) => (
        <button
          key={key}
          onClick={() => onRemoveFilter(key)}
          className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] text-[#8b8b8b] hover:text-[#d4af37] transition-colors shrink-0 group"
          title={`Remove ${COLUMN_LABELS[key] || key} filter`}
        >
          <span>{COLUMN_LABELS[key] || key}:</span>
          <span className="text-[#6b6b6b] group-hover:text-[#d4af37]/80">{formatFilterValue(value)}</span>
          <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 transition-opacity" />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] text-[#5a5a5a] hover:text-[#8b8b8b] transition-colors ml-auto shrink-0"
        title="Clear all filters"
      >
        <X className="w-2.5 h-2.5" />
        Clear all
      </button>
    </div>
  );
}
