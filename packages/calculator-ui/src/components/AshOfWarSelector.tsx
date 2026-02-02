import { useState, useMemo } from 'react';
import type { PrecomputedAowData, PrecomputedDataV2 } from '../data';
import { getAvailableAowNames, canWeaponMountAoW, getWeaponSkillName } from '../data';
import { STAT_COLORS } from '../constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { Combobox } from './ui/combobox.js';

// Stat filter options
type StatFilter = 'all' | 'str' | 'dex' | 'int' | 'fai' | 'arc';

const STAT_FILTER_OPTIONS: { value: StatFilter; label: string }[] = [
  { value: 'all', label: 'All Stats' },
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'int', label: 'Intelligence' },
  { value: 'fai', label: 'Faith' },
  { value: 'arc', label: 'Arcane' },
];

/**
 * Get which stats an AoW's attacks scale with based on AttackElementCorrect data
 */
function getAowScalingStats(aowData: PrecomputedAowData, aowName: string): Set<StatFilter> {
  const scalingStats = new Set<StatFilter>();

  // Get the sword arts ID for this AoW
  const swordArtsId = aowData.swordArtsByName[aowName];
  if (swordArtsId === undefined) return scalingStats;

  // Get the AoW data
  const aow = aowData.swordArts[swordArtsId];
  if (!aow || !aow.attacks) return scalingStats;

  // Check each attack's AttackElementCorrect entry
  for (const attack of aow.attacks) {
    const aecId = attack.overwriteAttackElementCorrectId;
    if (aecId === 0 || aecId === -1) continue; // No override, uses weapon's scaling

    const aec = aowData.attackElementCorrect[aecId];
    if (!aec) continue;

    // Check Strength
    if (aec.isStrengthCorrect_byPhysics || aec.isStrengthCorrect_byMagic ||
        aec.isStrengthCorrect_byFire || aec.isStrengthCorrect_byThunder ||
        aec.isStrengthCorrect_byDark) {
      scalingStats.add('str');
    }

    // Check Dexterity
    if (aec.isDexterityCorrect_byPhysics || aec.isDexterityCorrect_byMagic ||
        aec.isDexterityCorrect_byFire || aec.isDexterityCorrect_byThunder ||
        aec.isDexterityCorrect_byDark) {
      scalingStats.add('dex');
    }

    // Check Intelligence (called "Magic" in the data)
    if (aec.isMagicCorrect_byPhysics || aec.isMagicCorrect_byMagic ||
        aec.isMagicCorrect_byFire || aec.isMagicCorrect_byThunder ||
        aec.isMagicCorrect_byDark) {
      scalingStats.add('int');
    }

    // Check Faith
    if (aec.isFaithCorrect_byPhysics || aec.isFaithCorrect_byMagic ||
        aec.isFaithCorrect_byFire || aec.isFaithCorrect_byThunder ||
        aec.isFaithCorrect_byDark) {
      scalingStats.add('fai');
    }

    // Check Arcane (called "Luck" in the data)
    if (aec.isLuckCorrect_byPhysics || aec.isLuckCorrect_byMagic ||
        aec.isLuckCorrect_byFire || aec.isLuckCorrect_byThunder ||
        aec.isLuckCorrect_byDark) {
      scalingStats.add('arc');
    }
  }

  return scalingStats;
}

interface AshOfWarSelectorProps {
  aowData: PrecomputedAowData;
  precomputed: PrecomputedDataV2;
  weaponName: string;
  weaponClass: string;
  affinity: string;
  selectedAow: string | null;
  onSelect: (aowName: string | null) => void;
}

export function AshOfWarSelector({
  aowData,
  precomputed,
  weaponName,
  weaponClass,
  affinity,
  selectedAow,
  onSelect
}: AshOfWarSelectorProps) {
  const [statFilter, setStatFilter] = useState<StatFilter>('all');

  // Check if this is a unique weapon (cannot mount AoWs)
  const canMountAoW = useMemo(() => {
    return canWeaponMountAoW(precomputed, weaponName);
  }, [precomputed, weaponName]);

  // Get the built-in skill name for unique weapons
  const uniqueSkillName = useMemo(() => {
    if (canMountAoW) return null;
    return getWeaponSkillName(aowData, precomputed, weaponName);
  }, [aowData, precomputed, weaponName, canMountAoW]);

  // Get available AoWs for this weapon class and affinity (only for non-unique weapons)
  const baseAvailableAows = useMemo(() => {
    if (!canMountAoW) return [];
    return getAvailableAowNames(aowData, weaponClass, affinity);
  }, [aowData, weaponClass, affinity, canMountAoW]);

  // Build a map of AoW name to its scaling stats (for filtering)
  const aowScalingStatsMap = useMemo(() => {
    const map = new Map<string, Set<StatFilter>>();
    for (const aowName of baseAvailableAows) {
      map.set(aowName, getAowScalingStats(aowData, aowName));
    }
    return map;
  }, [aowData, baseAvailableAows]);

  // Filter AoWs based on selected stat filter
  const availableAows = useMemo(() => {
    if (statFilter === 'all') return baseAvailableAows;
    return baseAvailableAows.filter(aowName => {
      const scalingStats = aowScalingStatsMap.get(aowName);
      return scalingStats && scalingStats.has(statFilter);
    });
  }, [baseAvailableAows, statFilter, aowScalingStatsMap]);

  // Convert to Combobox options
  const aowOptions = useMemo(() => {
    return availableAows.map(name => ({ value: name, label: name }));
  }, [availableAows]);

  // For unique weapons, show the built-in skill as read-only
  if (!canMountAoW) {
    return (
      <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-4 py-2 text-[#d4af37]">
        {uniqueSkillName || 'Unknown Skill'}
      </div>
    );
  }

  // If no AoWs available at all for a non-unique weapon, show disabled state
  if (baseAvailableAows.length === 0) {
    return (
      <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-4 py-2 text-[#4a4a4a]">
        No Ashes of War available for this weapon
      </div>
    );
  }

  const statFilterColor = statFilter !== 'all' ? STAT_COLORS[statFilter] : undefined;

  return (
    <div className="space-y-3">
      {/* Stat Filter — shadcn Select */}
      <div>
        <div className="text-[#6a6a6a] text-xs mb-1">Filter by Scaling Stat</div>
        <Select value={statFilter} onValueChange={(v) => setStatFilter(v as StatFilter)}>
          <SelectTrigger
            className="bg-[#1a1a1a] border-[#3a3a3a] hover:border-[#d4af37] text-sm h-8"
            style={statFilterColor ? { color: statFilterColor } : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#3a3a3a]">
            {STAT_FILTER_OPTIONS.map(option => {
              const optionColor = option.value !== 'all' ? STAT_COLORS[option.value] : undefined;
              return (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-sm hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  style={optionColor ? { color: optionColor } : undefined}
                >
                  {option.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* AoW List — Combobox with search */}
      <div>
        <div className="text-[#6a6a6a] text-xs mb-2">
          {availableAows.length} available{statFilter !== 'all' && ` (${baseAvailableAows.length} total)`}
        </div>
        <Combobox
          options={aowOptions}
          value={selectedAow}
          onChange={onSelect}
          placeholder="Select an Ash of War"
          searchPlaceholder="Search ashes of war..."
          emptyText={
            statFilter !== 'all'
              ? `No Ashes of War scale with ${STAT_FILTER_OPTIONS.find(opt => opt.value === statFilter)?.label}`
              : 'No results found.'
          }
          clearOptionLabel="None (Weapon Skill)"
        />
      </div>
    </div>
  );
}
