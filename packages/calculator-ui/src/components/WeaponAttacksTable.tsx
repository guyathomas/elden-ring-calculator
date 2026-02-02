import React, { useMemo, useState, useEffect } from 'react';
import { Skull, Users, Sparkles } from 'lucide-react';
import type { WeaponAttack, EnemyData, AnimationUsersData } from '../data';
import { calculateEnemyDamage, classStandardAnimations } from '../data';
import { getAnimationId, ATTACK_TYPE_TO_ANIMATION_SUFFIX } from '../utils/animationMapping';
import type { PhysDamageType, PrecomputedDataV2, WeaponListItem } from '../types';
import { getCategoryName } from '../types';

interface WeaponARBreakdown {
  physical: number;
  magic: number;
  fire: number;
  lightning: number;
  holy: number;
}

interface WeaponAttacksTableProps {
  attacks: WeaponAttack[];
  twoHanding: boolean;
  selectedEnemy: EnemyData | null;
  weaponAR: WeaponARBreakdown | null;
  /** Called when user clicks an attack row to view its animation */
  onAttackClick?: (attackType: number) => void;
  /** Weapon motion category for mapping attacks to animation IDs */
  wepmotionCategory?: number;
  /** Current weapon name (to exclude from sharing count) */
  currentWeaponName?: string;
  /** Precomputed weapon data for finding shared animations */
  precomputed?: PrecomputedDataV2;
  /** Called when user clicks a related weapon */
  onWeaponSelect?: (weapon: WeaponListItem) => void;
  /** All weapons at current upgrade level (for navigation) */
  allWeapons?: WeaponListItem[];
  /** Per-animation weapon users data for accurate sharing counts */
  animationUsers?: AnimationUsersData;
}

type AttackCategory = 'all' | 'light' | 'heavy' | 'running' | 'crouch' | 'rolling' | 'backstep' | 'jumping' | 'guard' | 'mounted' | 'special';

const CATEGORY_LABELS: Record<AttackCategory, string> = {
  all: 'All',
  light: 'Light (R1)',
  heavy: 'Heavy (R2)',
  running: 'Running',
  crouch: 'Crouch',
  rolling: 'Rolling',
  backstep: 'Backstep',
  jumping: 'Jumping',
  guard: 'Guard',
  mounted: 'Mounted',
  special: 'Special',
};

// Damage type filter config
const DAMAGE_TYPE_CONFIG: Record<PhysDamageType, { label: string; color: string; bgColor: string; activeBg: string }> = {
  Standard: { label: 'Standard', color: '#9a9a9a', bgColor: '#1a1a1a', activeBg: '#2a2a2a' },
  Slash: { label: 'Slash', color: '#f0ad4e', bgColor: '#1a1a1a', activeBg: '#3a2a1a' },
  Strike: { label: 'Strike', color: '#5bc0de', bgColor: '#1a1a1a', activeBg: '#1a2a3a' },
  Pierce: { label: 'Pierce', color: '#d4af37', bgColor: '#1a1a1a', activeBg: '#2a2a1a' },
};

const ALL_DAMAGE_TYPES: PhysDamageType[] = ['Standard', 'Slash', 'Strike', 'Pierce'];

function formatMotionValue(value: number): string {
  if (value === 0) return '-';
  return String(value);
}

// Result of attack damage calculation including efficacy
interface AttackDamageResult {
  damage: number;
  scaledAR: number;
  efficacy: number;
}

// Helper to calculate enemy damage for a specific attack
function calculateAttackEnemyDamage(
  weaponAR: WeaponARBreakdown,
  attack: WeaponAttack,
  enemy: EnemyData
): AttackDamageResult {
  const motionValues = {
    physical: attack.physicalMV,
    magic: attack.magicMV,
    fire: attack.fireMV,
    lightning: attack.lightningMV,
    holy: attack.holyMV,
  };

  const totalScaledAR =
    weaponAR.physical * (motionValues.physical / 100) +
    weaponAR.magic * (motionValues.magic / 100) +
    weaponAR.fire * (motionValues.fire / 100) +
    weaponAR.lightning * (motionValues.lightning / 100) +
    weaponAR.holy * (motionValues.holy / 100);

  const result = calculateEnemyDamage({
    baseAR: weaponAR,
    motionValues,
    attackAttribute: attack.attackAttribute,
    enemyDefenses: enemy.defenses,
  });

  const efficacy = totalScaledAR > 0 ? (result.total / totalScaledAR) * 100 : 0;
  return { damage: result.rounded, scaledAR: totalScaledAR, efficacy };
}

// Get color class for efficacy percentage
function getEfficacyColor(efficacy: number): string {
  if (efficacy >= 70) return 'text-[#4ade80]'; // Green - good matchup
  if (efficacy >= 40) return 'text-[#f0ad4e]'; // Yellow - neutral
  return 'text-[#ef4444]'; // Red - poor matchup
}

// Info about weapons that share an animation
interface SharedWeaponInfo {
  name: string;
  categoryName: string;
}

export function WeaponAttacksTable({
  attacks,
  twoHanding,
  selectedEnemy,
  weaponAR,
  onAttackClick,
  wepmotionCategory,
  currentWeaponName,
  precomputed,
  onWeaponSelect,
  allWeapons = [],
  animationUsers,
}: WeaponAttacksTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<AttackCategory>('light');
  const [selectedDamageTypes, setSelectedDamageTypes] = useState<Set<PhysDamageType>>(new Set(ALL_DAMAGE_TYPES));
  const [expandedAttackType, setExpandedAttackType] = useState<number | null>(null);
  const [uniqueOnly, setUniqueOnly] = useState(false);

  // Get the weapon's wepType from precomputed data
  const weaponWepType = useMemo(() => {
    if (!precomputed || !currentWeaponName) return null;
    return precomputed.weapons[currentWeaponName]?.wepType ?? null;
  }, [precomputed, currentWeaponName]);

  // Build a reverse index: weapon name + animation suffix -> animation ID
  // This finds the actual animation used by a weapon for a specific attack,
  // handling cases where weapons use different animation categories than their wepmotionCategory
  const getActualAnimationForWeapon = useMemo(() => {
    if (!animationUsers || !currentWeaponName) {
      return (_suffix: string): string | null => null;
    }

    // Find all animations that contain the current weapon
    const weaponAnimations = new Map<string, string>(); // suffix -> animationId
    for (const [animId, weapons] of Object.entries(animationUsers)) {
      if (weapons.includes(currentWeaponName)) {
        // Extract the suffix (last 6 chars, e.g., "030000" from "a025_030000")
        const suffix = animId.split('_')[1];
        if (suffix) {
          weaponAnimations.set(suffix, animId);
        }
      }
    }

    return (suffix: string): string | null => {
      return weaponAnimations.get(suffix) || null;
    };
  }, [animationUsers, currentWeaponName]);

  // Get weapons that share a specific attack's animation (using per-animation data)
  const getSharedWeaponsForAnimation = useMemo(() => {
    if (!animationUsers || !currentWeaponName || !precomputed) {
      return (_animationId: string): SharedWeaponInfo[] => [];
    }

    // Cache for weapon info lookup
    const weaponInfoCache = new Map<string, SharedWeaponInfo>();
    for (const [name, weapon] of Object.entries(precomputed.weapons)) {
      weaponInfoCache.set(name, {
        name,
        categoryName: getCategoryName(weapon.wepType),
      });
    }

    return (animationId: string): SharedWeaponInfo[] => {
      const users = animationUsers[animationId];
      if (!users) return [];

      // Filter out current weapon and map to SharedWeaponInfo
      return users
        .filter(name => name !== currentWeaponName)
        .map(name => weaponInfoCache.get(name))
        .filter((info): info is SharedWeaponInfo => info !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
    };
  }, [animationUsers, currentWeaponName, precomputed]);

  // Handle clicking on the sharing indicator
  const handleSharingClick = (e: React.MouseEvent, attackType: number) => {
    e.stopPropagation(); // Don't trigger row click
    setExpandedAttackType(expandedAttackType === attackType ? null : attackType);
  };

  // Handle clicking a shared weapon
  const handleWeaponClick = (weaponName: string) => {
    if (!onWeaponSelect) return;

    const weapon = allWeapons.find(w => w.name === weaponName && w.affinity === 'Standard')
      || allWeapons.find(w => w.name === weaponName);

    if (weapon) {
      onWeaponSelect(weapon);
    }
  };

  // Check if an attack uses a unique (non-standard) animation for this weapon's class
  const isAttackUnique = useMemo(() => {
    if (!weaponWepType || !animationUsers) {
      return (_attackType: number): boolean => false;
    }

    const classStandards = classStandardAnimations[weaponWepType];
    if (!classStandards) {
      return (_attackType: number): boolean => false;
    }

    return (attackType: number): boolean => {
      const suffix = ATTACK_TYPE_TO_ANIMATION_SUFFIX[attackType];
      if (!suffix) return false;

      const standardAnim = classStandards[suffix];
      if (!standardAnim) return false;

      const actualAnim = getActualAnimationForWeapon(suffix);
      if (!actualAnim) return false;

      return actualAnim !== standardAnim;
    };
  }, [weaponWepType, animationUsers, getActualAnimationForWeapon]);

  // Count how many attacks are unique for this weapon
  const uniqueAttackCount = useMemo(() => {
    if (!weaponWepType) return 0;
    return attacks.filter(attack => isAttackUnique(attack.type)).length;
  }, [attacks, weaponWepType, isAttackUnique]);

  // Select only a specific damage type (exclusive selection)
  const selectDamageType = (type: PhysDamageType) => {
    const isOnlyThisSelected = selectedDamageTypes.size === 1 && selectedDamageTypes.has(type);
    if (isOnlyThisSelected) {
      // If only this type is selected, clicking it again selects all
      setSelectedDamageTypes(new Set(ALL_DAMAGE_TYPES));
    } else {
      // Otherwise, select only this type
      setSelectedDamageTypes(new Set([type]));
    }
  };

  // Select all damage types
  const selectAllDamageTypes = () => {
    setSelectedDamageTypes(new Set(ALL_DAMAGE_TYPES));
  };

  // Filter attacks based on grip, category, damage type, and unique filter
  const filteredAttacks = useMemo(() => {
    // Filter by grip (based on twoHanding prop)
    let result = attacks.filter(attack => {
      return twoHanding ? attack.twoHanded : attack.oneHanded;
    });

    // Filter by category if not 'all'
    if (selectedCategory !== 'all') {
      result = result.filter(attack => attack.category === selectedCategory);
    }

    // Filter by damage type
    result = result.filter(attack =>
      selectedDamageTypes.has(attack.attackAttribute as PhysDamageType)
    );

    // Filter to unique attacks only if toggle is on
    if (uniqueOnly) {
      result = result.filter(attack => isAttackUnique(attack.type));
    }

    return result;
  }, [attacks, twoHanding, selectedCategory, selectedDamageTypes, uniqueOnly, isAttackUnique]);

  // Get attacks filtered by grip only (base set for computing available options)
  const gripFilteredAttacks = useMemo(() => {
    return attacks.filter(attack => {
      return twoHanding ? attack.twoHanded : attack.oneHanded;
    });
  }, [attacks, twoHanding]);

  // Get available damage types for the current grip AND selected category
  const availableDamageTypes = useMemo(() => {
    const types = new Set<PhysDamageType>();
    gripFilteredAttacks.forEach(attack => {
      // Filter by category if not 'all'
      if (selectedCategory !== 'all' && attack.category !== selectedCategory) return;

      if (ALL_DAMAGE_TYPES.includes(attack.attackAttribute as PhysDamageType)) {
        types.add(attack.attackAttribute as PhysDamageType);
      }
    });
    return types;
  }, [gripFilteredAttacks, selectedCategory]);

  // Get available categories for the current grip AND selected damage types
  const availableCategories = useMemo(() => {
    const categories = new Set<AttackCategory>();
    const allSelected = selectedDamageTypes.size === ALL_DAMAGE_TYPES.length;

    gripFilteredAttacks.forEach(attack => {
      // If not all damage types selected, filter by selected damage types
      if (!allSelected && !selectedDamageTypes.has(attack.attackAttribute as PhysDamageType)) return;

      categories.add(attack.category as AttackCategory);
    });
    return ['all' as AttackCategory, ...Array.from(categories)];
  }, [gripFilteredAttacks, selectedDamageTypes]);

  // Reset category to 'all' if current selection is no longer available
  useEffect(() => {
    if (selectedCategory !== 'all' && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);

  // Reset damage types to all if none of the selected types are available
  useEffect(() => {
    const hasAvailableSelection = Array.from(selectedDamageTypes).some(type => availableDamageTypes.has(type));
    if (!hasAvailableSelection && availableDamageTypes.size > 0) {
      setSelectedDamageTypes(new Set(ALL_DAMAGE_TYPES));
    }
  }, [availableDamageTypes, selectedDamageTypes]);


  if (attacks.length === 0) {
    return (
      <div className="text-[#6a6a6a] text-sm italic">
        No attack data available for this weapon
      </div>
    );
  }

  const allDamageTypesSelected = selectedDamageTypes.size === ALL_DAMAGE_TYPES.length;

  return (
    <div>
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {availableCategories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${selectedCategory === category
                ? 'bg-[#d4af37] text-[#0a0a0a] font-medium'
                : 'bg-[#1a1a1a] text-[#8b8b8b] hover:bg-[#252525] hover:text-[#cccccc]'
                }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        {/* Unique Attacks Filter - only show if weapon has unique attacks */}
        {uniqueAttackCount > 0 && (
          <button
            onClick={() => {
              const newUniqueOnly = !uniqueOnly;
              setUniqueOnly(newUniqueOnly);
              // Reset attack type filter to 'all' when enabling unique filter
              if (newUniqueOnly) {
                setSelectedCategory('all');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${uniqueOnly
              ? 'bg-[#9b59b6] text-white font-medium'
              : 'bg-[#1a1a1a] text-[#9b59b6] hover:bg-[#252525]'
              }`}
            title="Show only attacks with unique animations for this weapon class"
          >
            <Sparkles className="w-3 h-3" />
            Unique ({uniqueAttackCount})
          </button>
        )}
      </div>

      {/* Damage Type Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-[#6a6a6a]">Damage:</span>
        <button
          onClick={selectAllDamageTypes}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${allDamageTypesSelected
            ? 'bg-[#2a2a2a] text-[#cccccc] font-medium'
            : 'bg-[#1a1a1a] text-[#6a6a6a] hover:bg-[#252525] hover:text-[#8b8b8b]'
            }`}
        >
          All
        </button>
        {ALL_DAMAGE_TYPES.map(type => {
          const config = DAMAGE_TYPE_CONFIG[type];
          const isAvailable = availableDamageTypes.has(type);
          const isSelected = selectedDamageTypes.has(type);

          if (!isAvailable) return null;

          return (
            <button
              key={type}
              onClick={() => selectDamageType(type)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${isSelected ? 'font-medium' : 'opacity-40'
                }`}
              style={{
                color: config.color,
                backgroundColor: isSelected ? config.activeBg : config.bgColor,
              }}
            >
              {config.label}
            </button>
          );
        })}
      </div>
      {/* Attack Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="px-1.5 md:px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
                Attack
              </th>
              <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                MV
              </th>
              {/* Show either base damage OR enemy damage, not both */}
              {weaponAR && (
                <th
                  className={`px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider ${selectedEnemy ? 'text-[#e06666]' : 'text-[#8b8b8b]'}`}
                  title={selectedEnemy ? `Damage vs ${selectedEnemy.name}` : 'Base attack damage (AR × MV)'}
                >
                  {selectedEnemy ? (
                    <div className="flex items-center justify-end gap-1">
                      <Skull className="w-3 h-3" />
                      <span>Dmg</span>
                    </div>
                  ) : 'Atk'}
                </th>
              )}
              {selectedEnemy && weaponAR && (
                <th className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]" title="Percentage of AR that becomes damage">
                  Eff%
                </th>
              )}
              <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                Stamina
              </th>
              <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                Poise
              </th>
              <th className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]" title="Damage Level (affects hitstun/stagger)">
                Dmg Lvl
              </th>
              <th className="hidden md:table-cell px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
                Type
              </th>
              {onAttackClick && wepmotionCategory !== undefined && (
                <th className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                  Anim ID
                </th>
              )}
              {animationUsers && wepmotionCategory !== undefined && (
                <th className="hidden md:table-cell px-3 py-2 text-center text-xs uppercase tracking-wider text-[#8b8b8b]" title="Weapons sharing this attack animation">
                  <Users className="w-3 h-3 inline" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredAttacks.map((attack, index) => (
              <React.Fragment key={`${attack.type}-${attack.attackAttribute}-${index}`}>
              <tr
                className={`border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${onAttackClick ? 'cursor-pointer' : ''}`}
                onClick={() => onAttackClick?.(attack.type)}
                title={onAttackClick ? 'Click to view animation timeline' : undefined}
              >
                <td className="px-1.5 md:px-3 py-2.5">
                  <div className="text-[#cccccc]">{attack.shortName}</div>
                  <div className="text-xs text-[#6a6a6a] capitalize">{attack.category}</div>
                </td>
                <td className="px-1.5 md:px-3 py-2.5 text-right">
                  <span className="text-[#d4af37] font-medium">
                    {formatMotionValue(attack.motionValue)}
                  </span>
                </td>
                {/* Show either base attack damage OR enemy damage */}
                {weaponAR && (() => {
                  const hasMotionValue = attack.physicalMV > 0 || attack.magicMV > 0 || attack.fireMV > 0 || attack.lightningMV > 0 || attack.holyMV > 0;

                  if (!hasMotionValue) {
                    return (
                      <>
                        <td className="px-1.5 md:px-3 py-2.5 text-right text-[#6a6a6a]">-</td>
                        {selectedEnemy && <td className="hidden md:table-cell px-3 py-2.5 text-right text-[#6a6a6a]">-</td>}
                      </>
                    );
                  }

                  if (selectedEnemy) {
                    // Enemy selected: show damage vs enemy
                    const result = calculateAttackEnemyDamage(weaponAR, attack, selectedEnemy);
                    return (
                      <>
                        <td className="px-1.5 md:px-3 py-2.5 text-right text-[#e06666]" title={`Damage vs ${selectedEnemy.name}`}>
                          {result.damage}
                        </td>
                        <td className={`hidden md:table-cell px-3 py-2.5 text-right ${getEfficacyColor(result.efficacy)}`} title={`${result.efficacy.toFixed(1)}% of AR becomes damage`}>
                          {result.efficacy.toFixed(0)}%
                        </td>
                      </>
                    );
                  } else {
                    // No enemy: show base attack damage (AR × MV)
                    const baseAttack = Math.round(
                      weaponAR.physical * (attack.physicalMV / 100) +
                      weaponAR.magic * (attack.magicMV / 100) +
                      weaponAR.fire * (attack.fireMV / 100) +
                      weaponAR.lightning * (attack.lightningMV / 100) +
                      weaponAR.holy * (attack.holyMV / 100)
                    );
                    return (
                      <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]" title="Base attack damage (AR × MV)">
                        {baseAttack}
                      </td>
                    );
                  }
                })()}
                <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]">
                  {attack.staminaCost || '-'}
                </td>
                <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]">
                  {attack.poiseDamage || '-'}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right text-[#9b9b9b]">
                  {attack.damageLevel}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-[#8b8b8b]">
                  {attack.attackAttribute}
                </td>
                {onAttackClick && wepmotionCategory !== undefined && (
                  <td className="hidden md:table-cell px-3 py-2.5 text-right font-mono text-[10px] text-[#6a6a6a]">
                    {getAnimationId(wepmotionCategory, attack.type) || '-'}
                  </td>
                )}
                {animationUsers && wepmotionCategory !== undefined && (() => {
                  // Get the animation suffix for this attack type
                  const suffix = ATTACK_TYPE_TO_ANIMATION_SUFFIX[attack.type];
                  // Find the actual animation ID used by this weapon (handles unique movesets)
                  const animationId = suffix ? getActualAnimationForWeapon(suffix) : null;
                  const sharedWeapons = animationId ? getSharedWeaponsForAnimation(animationId) : [];
                  const count = sharedWeapons.length;
                  if (count === 0) return <td className="hidden md:table-cell px-3 py-2.5 text-center text-[#4a4a4a]">-</td>;

                  return (
                    <td className="hidden md:table-cell px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => handleSharingClick(e, attack.type)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                          expandedAttackType === attack.type
                            ? 'bg-[#d4af37] text-[#0a0a0a]'
                            : 'bg-[#2a2a2a] text-[#8b8b8b] hover:bg-[#3a3a3a]'
                        }`}
                        title={`${count} weapon${count === 1 ? '' : 's'} share this animation`}
                      >
                        <Users className="w-3 h-3" />
                        <span>{count}</span>
                      </button>
                    </td>
                  );
                })()}
              </tr>
              {/* Expanded row showing shared weapons */}
              {expandedAttackType === attack.type && animationUsers && wepmotionCategory !== undefined && (() => {
                // Get the animation suffix for this attack type
                const suffix = ATTACK_TYPE_TO_ANIMATION_SUFFIX[attack.type];
                // Find the actual animation ID used by this weapon (handles unique movesets)
                const animationId = suffix ? getActualAnimationForWeapon(suffix) : null;
                const sharedWeapons = animationId ? getSharedWeaponsForAnimation(animationId) : [];
                if (sharedWeapons.length === 0) return null;

                const colCount = 999; // spans all visible columns regardless of responsive visibility

                // Group weapons by category
                const weaponsByCategory = sharedWeapons.reduce((acc, weapon) => {
                  if (!acc[weapon.categoryName]) {
                    acc[weapon.categoryName] = [];
                  }
                  acc[weapon.categoryName].push(weapon);
                  return acc;
                }, {} as Record<string, SharedWeaponInfo[]>);

                // Sort categories alphabetically
                const sortedCategories = Object.keys(weaponsByCategory).sort();

                return (
                  <tr className="bg-[#141414]">
                    <td colSpan={colCount} className="px-4 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-[#d4af37]" />
                        <span className="text-sm text-[#cccccc]">
                          {sharedWeapons.length} weapon{sharedWeapons.length === 1 ? '' : 's'} with identical animation
                        </span>
                      </div>
                      <div className="space-y-3">
                        {sortedCategories.map((category) => (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-[#d4af37]">{category}</span>
                              <span className="text-xs text-[#4a4a4a]">({weaponsByCategory[category].length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pl-2">
                              {weaponsByCategory[category].map((weapon) => (
                                <button
                                  key={weapon.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWeaponClick(weapon.name);
                                  }}
                                  disabled={!onWeaponSelect}
                                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                                    onWeaponSelect
                                      ? 'bg-[#1a1a1a] text-[#b0b0b0] hover:bg-[#252525] hover:text-[#ffffff] cursor-pointer'
                                      : 'bg-[#1a1a1a] text-[#808080] cursor-default'
                                  }`}
                                >
                                  {weapon.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })()}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAttacks.length === 0 && (
        <div className="text-[#6a6a6a] text-sm italic text-center py-4">
          No attacks available for this category
        </div>
      )}

    </div>
  );
}
