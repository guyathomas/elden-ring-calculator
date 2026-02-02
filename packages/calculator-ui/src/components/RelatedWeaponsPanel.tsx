import { useMemo } from 'react';
import { Swords } from 'lucide-react';
import type { PrecomputedDataV2, WeaponListItem } from '../types';
import { getCategoryName } from '../types';

interface RelatedWeaponInfo {
  name: string;
  categoryName: string;
  affinity: string;
}

interface RelatedWeaponsPanelProps {
  /** Current weapon's motion category */
  wepmotionCategory: number;
  /** Current weapon name (to exclude from list) */
  currentWeaponName: string;
  /** Precomputed weapon data */
  precomputed: PrecomputedDataV2;
  /** Current upgrade level for display */
  upgradeLevel: number;
  /** Called when user clicks a related weapon */
  onWeaponSelect?: (weapon: WeaponListItem) => void;
  /** All weapons at current upgrade level (for navigation) */
  allWeapons: WeaponListItem[];
}

/**
 * Displays a list of weapons that share the same attack animation (wepmotionCategory).
 * Clicking a weapon navigates to its detail page.
 */
export function RelatedWeaponsPanel({
  wepmotionCategory,
  currentWeaponName,
  precomputed,
  upgradeLevel,
  onWeaponSelect,
  allWeapons,
}: RelatedWeaponsPanelProps) {
  // Find all unique weapon names with the same wepmotionCategory
  const relatedWeapons = useMemo<RelatedWeaponInfo[]>(() => {
    const seen = new Set<string>();
    const weapons: RelatedWeaponInfo[] = [];

    for (const [name, weapon] of Object.entries(precomputed.weapons)) {
      // Skip the current weapon
      if (name === currentWeaponName) continue;

      // Check if it shares the same wepmotionCategory
      if (weapon.wepmotionCategory === wepmotionCategory) {
        // Only add each weapon once (not per affinity)
        if (!seen.has(name)) {
          seen.add(name);

          // Get first available affinity for display
          const firstAffinity = Object.keys(weapon.affinities)[0] || 'Standard';

          weapons.push({
            name,
            categoryName: getCategoryName(weapon.wepType),
            affinity: firstAffinity,
          });
        }
      }
    }

    // Sort alphabetically by name
    return weapons.sort((a, b) => a.name.localeCompare(b.name));
  }, [precomputed, wepmotionCategory, currentWeaponName]);

  const handleWeaponClick = (weaponName: string) => {
    if (!onWeaponSelect) return;

    // Find the weapon in the full list (prefer Standard affinity)
    const weapon = allWeapons.find(w => w.name === weaponName && w.affinity === 'Standard')
      || allWeapons.find(w => w.name === weaponName);

    if (weapon) {
      onWeaponSelect(weapon);
    }
  };

  if (relatedWeapons.length === 0) {
    return (
      <div className="text-[#6a6a6a] text-sm italic flex items-center gap-2">
        <Swords className="w-4 h-4" />
        <span>No other weapons share this attack animation</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Swords className="w-4 h-4 text-[#d4af37]" />
        <span className="text-[#8b8b8b] text-xs uppercase tracking-wider">
          Weapons with Same Attack Animation ({relatedWeapons.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {relatedWeapons.map((weapon) => (
          <button
            key={weapon.name}
            onClick={() => handleWeaponClick(weapon.name)}
            disabled={!onWeaponSelect}
            className={`text-left px-3 py-2 rounded border border-[#2a2a2a] bg-[#0a0a0a] transition-colors ${
              onWeaponSelect
                ? 'hover:bg-[#1a1a1a] hover:border-[#3a3a3a] cursor-pointer'
                : 'cursor-default'
            }`}
          >
            <div className="text-[#cccccc] text-sm truncate">{weapon.name}</div>
            <div className="text-[#6a6a6a] text-xs">{weapon.categoryName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
