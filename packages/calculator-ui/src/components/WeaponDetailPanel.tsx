import { useState, useEffect, Profiler } from 'react';
import { Skull } from 'lucide-react';
import type { WeaponListItem, CharacterStats, StatConfig, PrecomputedDataV2, StartingClass } from '../types';
import type { PrecomputedAowData, EnemyData } from '../data';
import { WeaponDetail } from './WeaponDetail';
import { useIsMobile } from './ui/use-mobile.js';
import { cn } from './ui/utils.js';
import { resetDiagnostics, printDiagnostics, onRenderCallback } from '../utils/diagnostics.js';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet.js';

interface WeaponDetailPanelProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData | null;
  weapon: WeaponListItem;
  statConfigs: Record<string, StatConfig>;
  currentStats: CharacterStats;
  hasUnlockedStats: boolean;
  twoHanding?: boolean;
  onClose: () => void;
  selectedEnemy?: EnemyData | null;
  onClearEnemy?: () => void;
  startingClass?: StartingClass;
  defaultAow?: string | null;
  initialOptimalStats?: Record<string, number> | null;
  level?: number;
  onLevelChange?: (level: number) => void;
  onWeaponSelect?: (weapon: WeaponListItem) => void;
  allWeapons?: WeaponListItem[];
}

export function WeaponDetailPanel({
  precomputed,
  aowData,
  weapon,
  statConfigs,
  currentStats,
  hasUnlockedStats,
  twoHanding = false,
  onClose,
  selectedEnemy,
  onClearEnemy,
  startingClass,
  defaultAow,
  initialOptimalStats,
  level,
  onLevelChange,
  onWeaponSelect,
  allWeapons,
}: WeaponDetailPanelProps) {
  const isMobile = useIsMobile();
  const [localTwoHanding, setLocalTwoHanding] = useState(twoHanding);

  // Reset local state when navigating to a different weapon
  useEffect(() => {
    setLocalTwoHanding(twoHanding);
  }, [weapon.name, weapon.affinity]);

  // Print diagnostics after mount render settles, then reset for next open
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      printDiagnostics();
      resetDiagnostics();
    });
    return () => cancelAnimationFrame(raf);
  }, [weapon.name, weapon.affinity]);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'bg-[#0a0a0a] border-[#2a2a2a] p-0 gap-0',
          isMobile
            ? 'h-[100dvh]'
            : 'w-full md:w-[60%] md:max-w-[1000px] sm:max-w-none'
        )}
      >
        {/* Header */}
        <SheetHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-3 border-b border-[#2a2a2a] space-y-0 gap-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SheetTitle className="text-[#d4af37] text-base md:text-xl truncate">
                {weapon.name} (+{weapon.upgradeLevel})
              </SheetTitle>
              <div className="flex-shrink-0 flex rounded border border-[#333] bg-[#141414] p-0.5">
                <button
                  onClick={() => setLocalTwoHanding(false)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs uppercase tracking-wider transition-all",
                    !localTwoHanding ? "bg-[#2a2a2a] text-[#e8e6e3] shadow-sm" : "text-[#6a6a6a] hover:text-[#8b8b8b]"
                  )}
                >
                  1H
                </button>
                <button
                  onClick={() => setLocalTwoHanding(true)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs uppercase tracking-wider transition-all",
                    localTwoHanding ? "bg-[#2a2a2a] text-[#e8e6e3] shadow-sm" : "text-[#6a6a6a] hover:text-[#8b8b8b]"
                  )}
                >
                  2H
                </button>
              </div>
            </div>
          </div>

          {/* Enemy indicator */}
          {selectedEnemy && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a]">
              <div className="flex items-center gap-2 text-[#e06666]">
                <Skull className="w-4 h-4 flex-shrink-0" />
                <SheetDescription className="text-sm text-[#e06666]">
                  vs {selectedEnemy.name}
                </SheetDescription>
              </div>
              {onClearEnemy && (
                <button
                  onClick={onClearEnemy}
                  className="px-2 py-1 text-xs text-[#e06666] hover:bg-[#1a1212] rounded transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {!selectedEnemy && (
            <SheetDescription className="sr-only">
              Weapon detail panel for {weapon.name}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-3 md:p-6">
          <Profiler id="WeaponDetail" onRender={onRenderCallback}>
            <WeaponDetail
              precomputed={precomputed}
              aowData={aowData}
              weapon={weapon}
              statConfigs={statConfigs}
              currentStats={currentStats}
              hasUnlockedStats={hasUnlockedStats}
              twoHanding={localTwoHanding}
              selectedEnemy={selectedEnemy}
              startingClass={startingClass}
              defaultAow={defaultAow}
              initialOptimalStats={initialOptimalStats}
              level={level}
              onLevelChange={onLevelChange}
              onWeaponSelect={onWeaponSelect}
              allWeapons={allWeapons}
            />
          </Profiler>
        </div>
      </SheetContent>
    </Sheet>
  );
}
