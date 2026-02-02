import { useMemo } from 'react';
import { Skull } from 'lucide-react';
import type { EnemyData, AttackDpsData, GripDpsData } from '../data';
import { calculateSimpleEnemyDamage, getWeaponDpsData } from '../data';

// Frame rate constant (Elden Ring runs at 30fps for animations)
const ANIMATION_FPS = 30;

interface WeaponDpsTableProps {
  /** Weapon name for looking up DPS data */
  weaponName: string;
  /** Total weapon AR (for DPS calculation) */
  totalAR: number;
  /** Current grip mode */
  twoHanding: boolean;
  /** Weapon AR breakdown for enemy damage calculation */
  weaponAR?: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  /** Primary attack attribute for physical damage type */
  attackAttribute?: string;
  /** Selected enemy for damage calculation */
  selectedEnemy?: EnemyData | null;
}

interface DpsRowData {
  label: string;
  data: AttackDpsData;
  damage: number;          // AR × MV / 100
  dps: number;             // damage / duration
  enemyDamage: number | null;
  enemyDps: number | null;
}

/**
 * Calculate enemy damage for an attack
 */
function calculateEnemyAttackDamage(
  weaponAR: { physical: number; magic: number; fire: number; lightning: number; holy: number },
  motionValue: number,
  attackAttribute: string,
  enemy: EnemyData
): number {
  const physDefenseType = attackAttribute === 'Standard'
    ? 'physical'
    : attackAttribute.toLowerCase() as 'strike' | 'slash' | 'pierce';

  const scaledAR = {
    physical: weaponAR.physical * (motionValue / 100),
    magic: weaponAR.magic * (motionValue / 100),
    fire: weaponAR.fire * (motionValue / 100),
    lightning: weaponAR.lightning * (motionValue / 100),
    holy: weaponAR.holy * (motionValue / 100),
  };

  return calculateSimpleEnemyDamage(scaledAR, physDefenseType, enemy.defenses);
}

/**
 * Format frame count as seconds
 */
function framesToSeconds(frames: number): string {
  const seconds = frames / ANIMATION_FPS;
  return seconds.toFixed(2) + 's';
}

/**
 * Format DPS value
 */
function formatDps(dps: number): string {
  return Math.round(dps).toLocaleString();
}

export function WeaponDpsTable({
  weaponName,
  totalAR,
  twoHanding,
  weaponAR,
  attackAttribute = 'Standard',
  selectedEnemy,
}: WeaponDpsTableProps) {
  // Get pre-calculated DPS data for this weapon
  const dpsData = useMemo(() => getWeaponDpsData(weaponName), [weaponName]);

  // Build row data for display
  const rows = useMemo<DpsRowData[]>(() => {
    if (!dpsData) return [];

    const grip: GripDpsData = twoHanding ? dpsData.twoHanded : dpsData.oneHanded;
    const prefix = twoHanding ? '2H' : '1H';
    const result: DpsRowData[] = [];

    const addRow = (label: string, data: AttackDpsData | null) => {
      if (!data) return;

      // Calculate damage: AR × MV / 100
      const damage = totalAR * data.mv / 100;
      // Calculate DPS: AR × dpsMultiplier (pre-calculated as (mv/100) * 30 / frames)
      const dps = totalAR * data.dpsMultiplier;

      // Calculate enemy damage if enemy selected
      let enemyDamage: number | null = null;
      let enemyDps: number | null = null;

      if (weaponAR && selectedEnemy) {
        enemyDamage = calculateEnemyAttackDamage(weaponAR, data.mv, attackAttribute, selectedEnemy);
        const durationSeconds = data.frames / ANIMATION_FPS;
        enemyDps = durationSeconds > 0 ? enemyDamage / durationSeconds : 0;
      }

      result.push({
        label,
        data,
        damage,
        dps,
        enemyDamage,
        enemyDps,
      });
    };

    addRow(`${prefix} R1`, grip.r1);
    addRow(`${prefix} R1 Chain`, grip.r1Chain);
    addRow(`${prefix} R2`, grip.r2);
    addRow(`${prefix} R2 Chain`, grip.r2Chain);

    return result;
  }, [dpsData, twoHanding, totalAR, weaponAR, attackAttribute, selectedEnemy]);

  if (!dpsData) {
    return (
      <div className="text-[#6a6a6a] text-sm italic">
        No DPS data available for this weapon
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-[#6a6a6a] text-sm italic">
        No attack timing data available
      </div>
    );
  }

  const hasEnemyData = selectedEnemy && weaponAR;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="px-1.5 md:px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
              Attack
            </th>
            <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
              Hits
            </th>
            <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
              MV
            </th>
            <th className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
              Duration
            </th>
            <th className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
              Frames
            </th>
            {/* Show either base damage OR enemy damage, not both */}
            <th
              className={`px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider ${hasEnemyData ? 'text-[#e06666]' : 'text-[#9b9b9b]'}`}
              title={hasEnemyData ? `Damage vs ${selectedEnemy.name}` : 'Total damage (AR × MV / 100)'}
            >
              {hasEnemyData ? (
                <div className="flex items-center justify-end gap-1">
                  <Skull className="w-3 h-3" />
                  <span>Dmg</span>
                </div>
              ) : 'Dmg'}
            </th>
            <th
              className={`px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider ${hasEnemyData ? 'text-[#e06666]' : 'text-[#d4af37]'}`}
              title={hasEnemyData ? `DPS vs ${selectedEnemy.name}` : 'Damage Per Second based on AR'}
            >
              {hasEnemyData ? (
                <div className="flex items-center justify-end gap-1">
                  <Skull className="w-3 h-3" />
                  <span>DPS</span>
                </div>
              ) : 'DPS'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.label}
              className={`border-b border-[#1a1a1a] ${index % 2 === 0 ? 'bg-[#0a0a0a]' : ''}`}
            >
              <td className="px-1.5 md:px-3 py-2.5 text-[#cccccc] font-medium">
                {row.label}
              </td>
              <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]">
                {row.data.hits}
              </td>
              <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]">
                {row.data.mv}
              </td>
              <td className="px-1.5 md:px-3 py-2.5 text-right text-[#9b9b9b]">
                {framesToSeconds(row.data.frames)}
              </td>
              <td className="hidden md:table-cell px-3 py-2.5 text-right text-[#6a6a6a]">
                {row.data.frames}
              </td>
              {/* Show either base damage OR enemy damage */}
              <td className={`px-1.5 md:px-3 py-2.5 text-right ${hasEnemyData ? 'text-[#e06666]' : 'text-[#9b9b9b]'}`}>
                {hasEnemyData
                  ? (row.enemyDamage !== null ? Math.round(row.enemyDamage) : '-')
                  : Math.round(row.damage)}
              </td>
              <td className={`px-1.5 md:px-3 py-2.5 text-right font-medium ${hasEnemyData ? 'text-[#e06666]' : 'text-[#d4af37]'}`}>
                {hasEnemyData
                  ? (row.enemyDps !== null ? formatDps(row.enemyDps) : '-')
                  : formatDps(row.dps)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[#6a6a6a] text-xs mt-2">
        {hasEnemyData
          ? `Damage and DPS calculated vs ${selectedEnemy.name}. Chain includes all attacks until recovery.`
          : 'Dmg = AR × MV / 100. DPS = Dmg / Duration. Chain includes all attacks until recovery.'}
      </p>
    </div>
  );
}
