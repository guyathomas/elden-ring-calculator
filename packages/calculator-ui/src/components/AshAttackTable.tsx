import React, { useMemo } from 'react';
import { Skull } from 'lucide-react';
import type { AowAttackResult, EnemyData } from '../data';
import { calculateEnemyDamage } from '../data';

// Special atkId for "Total" selection
export const TOTAL_ATK_ID = -1;

// Create a Total attack marker with computed hasStatScaling
function createTotalMarker(attacks: AowAttackResult[]): AowAttackResult {
  // Total has stat scaling if ANY individual attack has stat scaling
  const hasStatScaling = attacks.some(attack => attack.hasStatScaling);

  // Sum up motion and bullet damage across all attacks
  const motionTotals = attacks.reduce((acc, a) => ({
    phys: acc.phys + (a.motionPhys ?? 0),
    mag: acc.mag + (a.motionMag ?? 0),
    fire: acc.fire + (a.motionFire ?? 0),
    ltn: acc.ltn + (a.motionLtn ?? 0),
    holy: acc.holy + (a.motionHoly ?? 0),
    total: acc.total + (a.motionDamage ?? 0),
  }), { phys: 0, mag: 0, fire: 0, ltn: 0, holy: 0, total: 0 });

  const bulletTotals = attacks.reduce((acc, a) => ({
    phys: acc.phys + (a.bulletPhys ?? 0),
    mag: acc.mag + (a.bulletMag ?? 0),
    fire: acc.fire + (a.bulletFire ?? 0),
    ltn: acc.ltn + (a.bulletLtn ?? 0),
    holy: acc.holy + (a.bulletHoly ?? 0),
    total: acc.total + (a.bulletDamage ?? 0),
  }), { phys: 0, mag: 0, fire: 0, ltn: 0, holy: 0, total: 0 });

  return {
    name: 'Total',
    atkId: TOTAL_ATK_ID,
    physical: '-',
    magic: '-',
    fire: '-',
    lightning: '-',
    holy: '-',
    stamina: '-',
    poise: '-',
    attackAttribute: 'All Attacks',
    pvpMultiplier: '-',
    shieldChip: '-',
    hasStatScaling,
    isBullet: false,
    motionDamage: motionTotals.total,
    bulletDamage: bulletTotals.total,
    motionPhys: motionTotals.phys,
    motionMag: motionTotals.mag,
    motionFire: motionTotals.fire,
    motionLtn: motionTotals.ltn,
    motionHoly: motionTotals.holy,
    bulletPhys: bulletTotals.phys,
    bulletMag: bulletTotals.mag,
    bulletFire: bulletTotals.fire,
    bulletLtn: bulletTotals.ltn,
    bulletHoly: bulletTotals.holy,
  };
}

interface AshAttackTableProps {
  attacks: AowAttackResult[];
  aowName: string;
  selectedAttack?: AowAttackResult | null;
  onSelectAttack?: (attack: AowAttackResult | null) => void;
  showBreakdown?: boolean;
  /** Selected enemy for damage calculation */
  selectedEnemy?: EnemyData | null;
}

function formatDamage(value: number | '-'): string {
  if (value === '-' || value === 0) return '-';
  return value.toFixed(1);
}

function formatNumber(value: number | '-'): string {
  if (value === '-' || value === 0) return '-';
  return String(value);
}

function calculateTotalDamage(attack: AowAttackResult): number {
  let total = 0;
  if (attack.physical !== '-') total += attack.physical;
  if (attack.magic !== '-') total += attack.magic;
  if (attack.fire !== '-') total += attack.fire;
  if (attack.lightning !== '-') total += attack.lightning;
  if (attack.holy !== '-') total += attack.holy;
  return total;
}

// Calculate enemy damage for an AoW attack
function calculateAowEnemyDamage(
  attack: AowAttackResult,
  enemy: EnemyData
): number {
  // AoW attacks store pre-calculated damage values (AR × MV already applied)
  // So we use those directly as the effective AR with MV=100
  const attackAR = {
    physical: typeof attack.physical === 'number' ? attack.physical : 0,
    magic: typeof attack.magic === 'number' ? attack.magic : 0,
    fire: typeof attack.fire === 'number' ? attack.fire : 0,
    lightning: typeof attack.lightning === 'number' ? attack.lightning : 0,
    holy: typeof attack.holy === 'number' ? attack.holy : 0,
  };

  const result = calculateEnemyDamage({
    baseAR: attackAR,
    motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
    attackAttribute: attack.attackAttribute === 'All Attacks' ? 'Standard' : attack.attackAttribute,
    enemyDefenses: enemy.defenses,
  });

  return result.rounded;
}

export function AshAttackTable({ attacks, aowName, selectedAttack, onSelectAttack, showBreakdown = false, selectedEnemy }: AshAttackTableProps) {
  // Calculate totals for all attacks
  const totals = attacks.reduce(
    (acc, attack) => {
      if (attack.physical !== '-') acc.physical += attack.physical;
      if (attack.magic !== '-') acc.magic += attack.magic;
      if (attack.fire !== '-') acc.fire += attack.fire;
      if (attack.lightning !== '-') acc.lightning += attack.lightning;
      if (attack.holy !== '-') acc.holy += attack.holy;
      if (attack.stamina !== '-') acc.stamina += attack.stamina;
      if (attack.poise !== '-') acc.poise += attack.poise;
      return acc;
    },
    { physical: 0, magic: 0, fire: 0, lightning: 0, holy: 0, stamina: 0, poise: 0 }
  );

  // Determine which columns have any non-zero values
  const hasColumn = useMemo(() => ({
    physical: attacks.some(a => a.physical !== '-' && a.physical > 0),
    magic: attacks.some(a => a.magic !== '-' && a.magic > 0),
    fire: attacks.some(a => a.fire !== '-' && a.fire > 0),
    lightning: attacks.some(a => a.lightning !== '-' && a.lightning > 0),
    holy: attacks.some(a => a.holy !== '-' && a.holy > 0),
    stamina: attacks.some(a => a.stamina !== '-' && a.stamina > 0),
    poise: attacks.some(a => a.poise !== '-' && a.poise > 0),
  }), [attacks]);

  // Create total marker with computed hasStatScaling based on attacks
  const totalMarker = useMemo(() => createTotalMarker(attacks), [attacks]);

  const isTotalSelected = selectedAttack?.atkId === TOTAL_ATK_ID;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
              Attack
            </th>
            <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
              Type
            </th>
            {hasColumn.physical && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#9e9e9e]">
                Physical
              </th>
            )}
            {hasColumn.magic && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#5b9bd5]">
                Magic
              </th>
            )}
            {hasColumn.fire && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#f4b183]">
                Fire
              </th>
            )}
            {hasColumn.lightning && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#ffd966]">
                Lightning
              </th>
            )}
            {hasColumn.holy && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#d4af37]">
                Holy
              </th>
            )}
            <th
              className={`px-3 py-2 text-right text-xs uppercase tracking-wider ${selectedEnemy ? 'text-[#e06666]' : 'text-[#c9a227]'}`}
              title={selectedEnemy ? `Damage vs ${selectedEnemy.name}` : 'Total damage'}
            >
              {selectedEnemy ? (
                <div className="flex items-center justify-end gap-1">
                  <Skull className="w-3 h-3" />
                  <span>Dmg</span>
                </div>
              ) : 'Total'}
            </th>
            {hasColumn.stamina && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                Stamina
              </th>
            )}
            {hasColumn.poise && (
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b]">
                Poise
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {attacks.map((attack, index) => {
            const isSelected = selectedAttack?.atkId === attack.atkId;

            return (
              <React.Fragment key={`${attack.atkId}-${index}`}>
                <tr
                  className={`border-b border-[#1a1a1a] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#2a2a1a] hover:bg-[#2a2a1a]'
                      : 'hover:bg-[#1a1a1a]'
                  }`}
                  onClick={() => {
                    if (onSelectAttack) {
                      // Toggle selection: clicking same row deselects
                      onSelectAttack(isSelected ? null : attack);
                    }
                  }}
                >
                  <td className="px-3 py-2.5">
                    <div className={isSelected ? 'text-[#d4af37]' : 'text-[#e8e6e3]'}>{attack.name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[#8b8b8b]">
                    {attack.attackAttribute}
                  </td>
                  {hasColumn.physical && (
                    <td className="px-3 py-2.5 text-right text-[#cccccc]">
                      {formatDamage(attack.physical)}
                    </td>
                  )}
                  {hasColumn.magic && (
                    <td className="px-3 py-2.5 text-right text-[#7bb3e8]">
                      {formatDamage(attack.magic)}
                    </td>
                  )}
                  {hasColumn.fire && (
                    <td className="px-3 py-2.5 text-right text-[#f8c99d]">
                      {formatDamage(attack.fire)}
                    </td>
                  )}
                  {hasColumn.lightning && (
                    <td className="px-3 py-2.5 text-right text-[#ffe699]">
                      {formatDamage(attack.lightning)}
                    </td>
                  )}
                  {hasColumn.holy && (
                    <td className="px-3 py-2.5 text-right text-[#e8c968]">
                      {formatDamage(attack.holy)}
                    </td>
                  )}
                  <td className={`px-3 py-2.5 text-right font-medium ${selectedEnemy ? 'text-[#e06666]' : 'text-[#d4af37]'}`}>
                    {selectedEnemy
                      ? calculateAowEnemyDamage(attack, selectedEnemy)
                      : formatDamage(calculateTotalDamage(attack))}
                  </td>
                  {hasColumn.stamina && (
                    <td className="px-3 py-2.5 text-right text-[#9b9b9b]">
                      {formatNumber(attack.stamina)}
                    </td>
                  )}
                  {hasColumn.poise && (
                    <td className="px-3 py-2.5 text-right text-[#9b9b9b]">
                      {formatNumber(attack.poise)}
                    </td>
                  )}
                </tr>
                {/* Motion sub-row */}
                {showBreakdown && (attack.motionDamage ?? 0) > 0 && (
                  <tr className="bg-[#0f1a0f] border-b border-[#1a1a1a]">
                    <td className="px-3 py-1.5 pl-8">
                      <span className="text-[#93c47d] text-xs italic">↳ Motion</span>
                    </td>
                    <td className="px-3 py-1.5" />
                    {hasColumn.physical && (
                      <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                        {formatDamage(attack.motionPhys ?? 0)}
                      </td>
                    )}
                    {hasColumn.magic && (
                      <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                        {formatDamage(attack.motionMag ?? 0)}
                      </td>
                    )}
                    {hasColumn.fire && (
                      <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                        {formatDamage(attack.motionFire ?? 0)}
                      </td>
                    )}
                    {hasColumn.lightning && (
                      <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                        {formatDamage(attack.motionLtn ?? 0)}
                      </td>
                    )}
                    {hasColumn.holy && (
                      <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                        {formatDamage(attack.motionHoly ?? 0)}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs font-medium">
                      {formatDamage(attack.motionDamage ?? 0)}
                    </td>
                    {hasColumn.stamina && <td className="px-3 py-1.5" />}
                    {hasColumn.poise && <td className="px-3 py-1.5" />}
                  </tr>
                )}
                {/* Bullet sub-row */}
                {showBreakdown && (attack.bulletDamage ?? 0) > 0 && (
                  <tr className="bg-[#0f141a] border-b border-[#1a1a1a]">
                    <td className="px-3 py-1.5 pl-8">
                      <span className="text-[#6fa8dc] text-xs italic">↳ Bullet</span>
                    </td>
                    <td className="px-3 py-1.5" />
                    {hasColumn.physical && (
                      <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                        {formatDamage(attack.bulletPhys ?? 0)}
                      </td>
                    )}
                    {hasColumn.magic && (
                      <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                        {formatDamage(attack.bulletMag ?? 0)}
                      </td>
                    )}
                    {hasColumn.fire && (
                      <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                        {formatDamage(attack.bulletFire ?? 0)}
                      </td>
                    )}
                    {hasColumn.lightning && (
                      <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                        {formatDamage(attack.bulletLtn ?? 0)}
                      </td>
                    )}
                    {hasColumn.holy && (
                      <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                        {formatDamage(attack.bulletHoly ?? 0)}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs font-medium">
                      {formatDamage(attack.bulletDamage ?? 0)}
                    </td>
                    {hasColumn.stamina && <td className="px-3 py-1.5" />}
                    {hasColumn.poise && <td className="px-3 py-1.5" />}
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        {attacks.length > 1 && (
          <tfoot>
            <tr
              className={`border-t border-[#3a3a3a] transition-colors cursor-pointer ${
                isTotalSelected
                  ? 'bg-[#2a2a1a] hover:bg-[#2a2a1a]'
                  : 'bg-[#1a1a1a] hover:bg-[#252520]'
              }`}
              onClick={() => {
                if (onSelectAttack) {
                  onSelectAttack(isTotalSelected ? null : totalMarker);
                }
              }}
            >
              <td className={`px-3 py-2.5 font-medium ${isTotalSelected ? 'text-[#f0d060]' : 'text-[#d4af37]'}`}>
                Total
              </td>
              <td className="px-3 py-2.5 text-[#6a6a6a]">-</td>
              {hasColumn.physical && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.physical > 0 ? totals.physical.toFixed(1) : '-'}
                </td>
              )}
              {hasColumn.magic && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.magic > 0 ? totals.magic.toFixed(1) : '-'}
                </td>
              )}
              {hasColumn.fire && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.fire > 0 ? totals.fire.toFixed(1) : '-'}
                </td>
              )}
              {hasColumn.lightning && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.lightning > 0 ? totals.lightning.toFixed(1) : '-'}
                </td>
              )}
              {hasColumn.holy && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.holy > 0 ? totals.holy.toFixed(1) : '-'}
                </td>
              )}
              <td className={`px-3 py-2.5 text-right font-medium ${selectedEnemy ? 'text-[#e06666]' : 'text-[#d4af37]'}`}>
                {selectedEnemy
                  ? attacks.reduce((sum, attack) => sum + calculateAowEnemyDamage(attack, selectedEnemy), 0)
                  : (totals.physical + totals.magic + totals.fire + totals.lightning + totals.holy > 0
                    ? (totals.physical + totals.magic + totals.fire + totals.lightning + totals.holy).toFixed(1)
                    : '-')}
              </td>
              {hasColumn.stamina && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.stamina > 0 ? totals.stamina : '-'}
                </td>
              )}
              {hasColumn.poise && (
                <td className="px-3 py-2.5 text-right text-[#d4af37] font-medium">
                  {totals.poise > 0 ? totals.poise : '-'}
                </td>
              )}
            </tr>
            {/* Motion sub-row */}
            {showBreakdown && (totalMarker.motionDamage ?? 0) > 0 && (
              <tr className="bg-[#0f1a0f] border-b border-[#1a1a1a]">
                <td className="px-3 py-1.5 pl-8">
                  <span className="text-[#93c47d] text-xs italic">↳ Motion</span>
                </td>
                <td className="px-3 py-1.5" />
                {hasColumn.physical && (
                  <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                    {formatDamage(totalMarker.motionPhys ?? 0)}
                  </td>
                )}
                {hasColumn.magic && (
                  <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                    {formatDamage(totalMarker.motionMag ?? 0)}
                  </td>
                )}
                {hasColumn.fire && (
                  <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                    {formatDamage(totalMarker.motionFire ?? 0)}
                  </td>
                )}
                {hasColumn.lightning && (
                  <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                    {formatDamage(totalMarker.motionLtn ?? 0)}
                  </td>
                )}
                {hasColumn.holy && (
                  <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs">
                    {formatDamage(totalMarker.motionHoly ?? 0)}
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-[#93c47d] text-xs font-medium">
                  {formatDamage(totalMarker.motionDamage ?? 0)}
                </td>
                {hasColumn.stamina && <td className="px-3 py-1.5" />}
                {hasColumn.poise && <td className="px-3 py-1.5" />}
              </tr>
            )}
            {/* Bullet sub-row */}
            {showBreakdown && (totalMarker.bulletDamage ?? 0) > 0 && (
              <tr className="bg-[#0f141a] border-b border-[#1a1a1a]">
                <td className="px-3 py-1.5 pl-8">
                  <span className="text-[#6fa8dc] text-xs italic">↳ Bullet</span>
                </td>
                <td className="px-3 py-1.5" />
                {hasColumn.physical && (
                  <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                    {formatDamage(totalMarker.bulletPhys ?? 0)}
                  </td>
                )}
                {hasColumn.magic && (
                  <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                    {formatDamage(totalMarker.bulletMag ?? 0)}
                  </td>
                )}
                {hasColumn.fire && (
                  <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                    {formatDamage(totalMarker.bulletFire ?? 0)}
                  </td>
                )}
                {hasColumn.lightning && (
                  <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                    {formatDamage(totalMarker.bulletLtn ?? 0)}
                  </td>
                )}
                {hasColumn.holy && (
                  <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs">
                    {formatDamage(totalMarker.bulletHoly ?? 0)}
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-[#6fa8dc] text-xs font-medium">
                  {formatDamage(totalMarker.bulletDamage ?? 0)}
                </td>
                {hasColumn.stamina && <td className="px-3 py-1.5" />}
                {hasColumn.poise && <td className="px-3 py-1.5" />}
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  );
}
