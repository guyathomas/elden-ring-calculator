import { useMemo } from 'react';
import { Star, Trash2 } from 'lucide-react';
import type { Build } from '../../types/buildTypes.js';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../../types.js';
import { BuildSelector } from './BuildSelector.js';
import { BuildWeaponCard } from './BuildWeaponCard.js';
import { StorageWarning } from './StorageWarning.js';
import { calculateWeaponAR } from '../../utils/damageCalculator.js';

function StatCell({ label, value }: { label: string; value: number }) {
  const inactive = value === 0;
  return (
    <div
      className={`flex flex-col items-center py-1.5 px-1 rounded border ${
        inactive ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
      }`}
    >
      <span
        className={`text-[0.65rem] uppercase tracking-wider ${inactive ? 'text-[#3a3a3a]' : 'text-[#6a6a6a]'}`}
      >
        {label}
      </span>
      <span className={`text-sm font-medium ${inactive ? 'text-[#3a3a3a]' : 'text-[#d4af37]'}`}>
        {inactive ? '—' : value}
      </span>
    </div>
  );
}

interface BuildPanelProps {
  builds: Build[];
  activeBuild: Build | null;
  storageAvailable: boolean;
  onSelectBuild: (id: string) => void;
  onCreateBuild: (name: string) => void;
  onRenameBuild: (id: string, name: string) => void;
  onDeleteBuild: (id: string) => void;
  onClearBuild: (id: string) => void;
  onToggleWeapon: (weaponId: string) => void;
  // For weapon lookup and AR calculation
  weapons: WeaponListItem[];
  precomputed: PrecomputedDataV2 | null;
  currentStats: CharacterStats;
  twoHanding: boolean;
  onWeaponSelect: (weapon: WeaponListItem) => void;
  isMobile?: boolean;
}

interface WeaponWithAR extends WeaponListItem {
  totalAR: number;
}

export function BuildPanel({
  builds,
  activeBuild,
  storageAvailable,
  onSelectBuild,
  onCreateBuild,
  onRenameBuild,
  onDeleteBuild,
  onClearBuild,
  onToggleWeapon,
  weapons,
  precomputed,
  currentStats,
  twoHanding,
  onWeaponSelect,
  isMobile = false,
}: BuildPanelProps) {
  // Get starred weapons with AR calculations
  const starredWeapons = useMemo((): WeaponWithAR[] => {
    if (!activeBuild || !precomputed) return [];

    return activeBuild.weapons
      .map((weaponId) => {
        const weapon = weapons.find((w) => w.id === weaponId);
        if (!weapon) return null;

        const arResult = calculateWeaponAR(
          precomputed,
          weapon.name,
          weapon.affinity,
          weapon.upgradeLevel,
          currentStats,
          { twoHanding }
        );

        return {
          ...weapon,
          totalAR: arResult?.total ?? 0,
        };
      })
      .filter((w): w is WeaponWithAR => w !== null);
  }, [activeBuild, weapons, precomputed, currentStats, twoHanding]);

  // Calculate minimum stats required for all weapons in build
  const minRequirements = useMemo(() => {
    if (starredWeapons.length === 0) return null;
    return {
      str: Math.max(...starredWeapons.map((w) => w.requirements.str)),
      dex: Math.max(...starredWeapons.map((w) => w.requirements.dex)),
      int: Math.max(...starredWeapons.map((w) => w.requirements.int)),
      fai: Math.max(...starredWeapons.map((w) => w.requirements.fai)),
      arc: Math.max(...starredWeapons.map((w) => w.requirements.arc)),
    };
  }, [starredWeapons]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-4' : 'p-4'}`}>
        {/* Storage Warning */}
        {!storageAvailable && <StorageWarning />}

        {/* Build Selector */}
        <div>
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium mb-2 block">
            Active Build
          </label>
          <BuildSelector
            builds={builds}
            activeBuild={activeBuild}
            onSelectBuild={onSelectBuild}
            onCreateBuild={onCreateBuild}
            onRenameBuild={onRenameBuild}
            onDeleteBuild={onDeleteBuild}
          />
        </div>

        {/* Build Summary - Minimum Stats Card */}
        {activeBuild && starredWeapons.length > 0 && minRequirements && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">
                Min Requirements
              </span>
              <span className="text-[#6a6a6a] text-xs">
                {starredWeapons.length} weapon{starredWeapons.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              <StatCell label="Str" value={minRequirements.str} />
              <StatCell label="Dex" value={minRequirements.dex} />
              <StatCell label="Int" value={minRequirements.int} />
              <StatCell label="Fai" value={minRequirements.fai} />
              <StatCell label="Arc" value={minRequirements.arc} />
            </div>
          </div>
        )}

        {/* Weapon List */}
        {activeBuild && (
          <div className="space-y-2">
            {starredWeapons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="w-8 h-8 text-[#3a3a3a] mb-3" />
                <p className="text-[#6a6a6a] text-sm mb-1">No weapons starred yet</p>
                <p className="text-[#4a4a4a] text-xs">
                  Click the star icon on any weapon to add it to your build
                </p>
              </div>
            ) : (
              starredWeapons.map((weapon) => (
                <BuildWeaponCard
                  key={weapon.id}
                  weaponId={weapon.id}
                  weaponName={weapon.name}
                  affinity={weapon.affinity}
                  totalAR={weapon.totalAR}
                  categoryName={weapon.categoryName}
                  requirements={weapon.requirements}
                  onRemove={() => onToggleWeapon(weapon.id)}
                  onClick={() => onWeaponSelect(weapon)}
                />
              ))
            )}
          </div>
        )}

        {/* Clear Build Button */}
        {activeBuild && starredWeapons.length > 0 && (
          <button
            type="button"
            onClick={() => onClearBuild(activeBuild.id)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[#6a6a6a] hover:text-[#ef4444] hover:bg-[#1a0a0a] rounded border border-[#2a2a2a] hover:border-[#3a2a2a] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear Build
          </button>
        )}
      </div>

      {/* iOS safe area spacer */}
      {isMobile && <div className="h-[env(safe-area-inset-bottom)]" />}
    </div>
  );
}
