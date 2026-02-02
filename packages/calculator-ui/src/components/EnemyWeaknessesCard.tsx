import { getEnemyByKey, type EnemyData } from '../data/index.js';

interface EnemyWeaknessesCardProps {
  selectedEnemy: string | null;
}

// Damage type display configuration
const DAMAGE_TYPES = [
  { key: 'physical', label: 'Std', color: '#9a9a9a' },
  { key: 'strike', label: 'Str', color: '#b8860b' },
  { key: 'slash', label: 'Sla', color: '#cd5c5c' },
  { key: 'pierce', label: 'Prc', color: '#4682b4' },
  { key: 'magic', label: 'Mag', color: '#5bc0de' },
  { key: 'fire', label: 'Fir', color: '#f0ad4e' },
  { key: 'lightning', label: 'Lit', color: '#f4e04d' },
  { key: 'holy', label: 'Hly', color: '#d4af37' },
] as const;

// Get color based on negation value
function getNegationColor(value: number): string {
  if (value < 0) return '#ef4444'; // Red for weakness
  if (value >= 50) return '#4ade80'; // Green for strong resistance
  if (value >= 25) return '#a3a3a3'; // Neutral-ish
  return '#8b8b8b'; // Low resistance
}

// Get background color for the badge based on negation value
function getNegationBgColor(value: number): string {
  if (value < 0) return 'rgba(239, 68, 68, 0.15)'; // Red tint for weakness
  if (value >= 50) return 'rgba(74, 222, 128, 0.15)'; // Green tint for strong resistance
  return 'rgba(138, 138, 138, 0.1)'; // Neutral
}

export function EnemyWeaknessesCard({ selectedEnemy }: EnemyWeaknessesCardProps) {
  if (!selectedEnemy) return null;

  const enemy: EnemyData | null = getEnemyByKey(selectedEnemy);
  if (!enemy) return null;

  const { negation } = enemy.defenses;

  return (
    <div className="mt-2 p-2 bg-[#141414] border border-[#2a2a2a] rounded">
      <div className="grid grid-cols-4 gap-1">
        {DAMAGE_TYPES.map(({ key, label, color }) => {
          const value = negation[key as keyof typeof negation];
          const textColor = getNegationColor(value);
          const bgColor = getNegationBgColor(value);

          return (
            <div
              key={key}
              className="flex flex-col items-center py-1 px-0.5 rounded"
              style={{ backgroundColor: bgColor }}
            >
              <span
                className="text-[9px] font-medium uppercase tracking-wider"
                style={{ color }}
              >
                {label}
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: textColor }}
              >
                {value > 0 ? `${value}%` : `${value}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
