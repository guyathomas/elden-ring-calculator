import type { CharacterStats, StatConfig } from '../types';
import { TrendingUp } from 'lucide-react';

interface OptimalStatsDisplayProps {
  optimalStats: CharacterStats;
  statConfigs: Record<string, StatConfig>;
}

export function OptimalStatsDisplay({ optimalStats, statConfigs }: OptimalStatsDisplayProps) {
  const damageStats = ['str', 'dex', 'int', 'fai', 'arc'];
  const unlockedStats = damageStats.filter(stat => !statConfigs[stat].locked);
  
  if (unlockedStats.length === 0) return null;

  return (
    <div>
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
        <TrendingUp className="w-3 h-3" />
        Optimal Stat Distribution
      </h3>
      <div className="bg-[#1a2618] border border-[#2d4a24] rounded p-4">
        <div className="grid grid-cols-5 gap-3">
          {damageStats.map(stat => {
            const isUnlocked = !statConfigs[stat].locked;
            const value = optimalStats[stat as keyof CharacterStats];
            
            return (
              <div
                key={stat}
                className={`text-center ${isUnlocked ? 'opacity-100' : 'opacity-40'}`}
              >
                <div className="text-xs text-[#6a6a6a] uppercase mb-1">{stat}</div>
                <div className={`text-xl ${isUnlocked ? 'text-[#7bc96f]' : 'text-[#8b8b8b]'}`}>
                  {value}
                </div>
                {isUnlocked && (
                  <div className="text-[0.65rem] text-[#5a8a50] mt-0.5">
                    optimized
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#6a6a6a] mt-3 text-center">
          Suggested stats for maximum damage with this weapon
        </p>
      </div>
    </div>
  );
}
