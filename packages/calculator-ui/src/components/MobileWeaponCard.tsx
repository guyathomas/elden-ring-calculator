import React, { memo } from 'react';
import type { ScalingGrade } from '../types';
import { StarButton } from './builds/StarButton.js';

// Visibility configuration for optional card sections
// Maps to the sidebar column group toggles
export interface CardVisibility {
  weaponStats?: boolean;         // Weight, Damage Type, Critical, Buffable, True Combos, Unique Attacks
  guardStats?: boolean;          // Physical, Magic, Fire, Lightning, Holy, Guard Boost
  attributeInvestments?: boolean; // Per-stat deficits, total, min level, points required
  statusEffects?: boolean;       // Bleed, Frost, Poison, Scarlet Rot, Sleep, Madness
  dps?: boolean;                 // R1, R1 Chain, R2, R2 Chain DPS
  efficiency?: boolean;          // Efficiency, %Max
  spellPower?: boolean;          // Spell Scaling
  aowDamage?: boolean;           // AoW Motion / Bullet / Total damage
  scaling?: boolean;             // Attribute scaling grades
  requirements?: boolean;        // Attribute requirements
  weaponSkill?: boolean;         // Weapon skill name + scaling
}

// Minimal interface describing what the card needs from a weapon
export interface MobileWeaponData {
  id: string;
  name: string;
  categoryName: string;
  affinity: string;
  totalAR: number;
  spellScaling: number;
  hasSorceryScaling: boolean;
  hasIncantationScaling: boolean;
  damageDisplay: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  scaling: {
    str: ScalingGrade;
    dex: ScalingGrade;
    int: ScalingGrade;
    fai: ScalingGrade;
    arc: ScalingGrade;
  };
  requirements: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };
  optimalStats?: Record<string, number>;
  bleed: number;
  frost: number;
  poison: number;
  scarletRot: number;
  sleep: number;
  madness: number;
  // Weapon stats (shown when weaponStats enabled)
  weight: number;
  damageType: string;
  criticalValue: number;
  isBuffable: boolean;
  trueCombos: number;
  hasUniqueAttacks: boolean;
  // Guard stats (shown when guardStats enabled)
  guardStats: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
    guardBoost: number;
  };
  // Efficiency (shown when efficiency enabled)
  efficiency: number;
  damagePercent: number;
  // Attribute investments (shown when attributeInvestments enabled)
  strDeficit: number;
  dexDeficit: number;
  intDeficit: number;
  faiDeficit: number;
  arcDeficit: number;
  totalDeficit: number;
  minLevel: number;
  pointsRequired: number;
  // DPS (pre-calculated, shown when dps enabled)
  r1Dps: number | null;
  r1ChainDps: number | null;
  r2Dps: number | null;
  r2ChainDps: number | null;
  // AoW damage breakdown (shown when aowDamage enabled)
  aowDamage: {
    motionPhys: number;
    motionMag: number;
    motionFire: number;
    motionLtn: number;
    motionHoly: number;
    motionTotal: number;
    bulletPhys: number;
    bulletMag: number;
    bulletFire: number;
    bulletLtn: number;
    bulletHoly: number;
    bulletTotal: number;
    totalPhys: number;
    totalMag: number;
    totalFire: number;
    totalLtn: number;
    totalHoly: number;
    totalDamage: number;
  } | null;
  // Weapon skill (shown when weaponSkill enabled)
  skillName: string | null;
  skillScaling: {
    str: ScalingGrade;
    dex: ScalingGrade;
    int: ScalingGrade;
    fai: ScalingGrade;
    arc: ScalingGrade;
  } | null;
}

interface MobileWeaponCardProps {
  weapon: MobileWeaponData;
  isSelected: boolean;
  meetsRequirements: boolean;
  showOptimalStats?: boolean;
  visibleSections?: CardVisibility;
  onClick: () => void;
  isStarred?: boolean;
  onToggleStar?: (weaponId: string) => void;
}

// Scaling grade colors matching existing design system
const gradeColors: Record<ScalingGrade, string> = {
  'S': 'text-[#d4af37]',
  'A': 'text-[#7bc96f]',
  'B': 'text-[#5bc0de]',
  'C': 'text-[#a8a8d8]',
  'D': 'text-[#8b8b8b]',
  'E': 'text-[#6a6a6a]',
  '-': 'text-[#3a3a3a]',
};

// Grid cell for stat display
function StatCell({ label, value, inactive = false, inline = false }: {
  label: string;
  value: string | number;
  inactive?: boolean;
  inline?: boolean;
}) {
  return (
    <div className={`flex ${inline ? 'flex-row items-center justify-between' : 'flex-col items-center'} py-1.5 px-1 rounded border ${
      inactive ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
    }`}>
      <span className={`text-[0.65rem] uppercase tracking-wider ${inactive ? 'text-[#3a3a3a]' : 'text-[#6a6a6a]'}`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${inactive ? 'text-[#3a3a3a]' : 'text-[#e8e6e3]'}`}>
        {inactive ? '—' : value}
      </span>
    </div>
  );
}

// Combined cell for scaling grade and requirement
function AttributeCell({ label, grade, requirement, showGrade = true, showRequirement = true }: {
  label: string;
  grade: ScalingGrade;
  requirement: number;
  showGrade?: boolean;
  showRequirement?: boolean;
}) {
  const isInactive = (!showGrade || grade === '-') && (!showRequirement || requirement === 0);
  const gradeColor = gradeColors[grade];

  return (
    <div className={`flex flex-col items-center py-1.5 px-1 rounded border ${
      isInactive ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
    }`}>
      <span className={`text-[0.65rem] uppercase tracking-wider ${isInactive ? 'text-[#3a3a3a]' : 'text-[#6a6a6a]'}`}>
        {label}
      </span>
      {showGrade && (
        <span className={`text-sm font-bold ${gradeColor}`}>
          {grade}
        </span>
      )}
      {showRequirement && (
        <span className={`text-xs ${requirement === 0 ? 'text-[#3a3a3a]' : 'text-[#8b8b8b]'}`}>
          {requirement === 0 ? '—' : requirement}
        </span>
      )}
    </div>
  );
}

// Cell for scaling grade only (used in weapon skill section)
function GradeCell({ label, grade }: {
  label: string;
  grade: ScalingGrade;
}) {
  const isInactive = grade === '-';
  const gradeColor = gradeColors[grade];

  return (
    <div className={`flex flex-col items-center py-1.5 px-1 rounded border ${
      isInactive ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
    }`}>
      <span className={`text-[0.65rem] uppercase tracking-wider ${isInactive ? 'text-[#3a3a3a]' : 'text-[#6a6a6a]'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold ${gradeColor}`}>
        {grade}
      </span>
    </div>
  );
}

// Cell for optimal stats display
function OptimalStatCell({ label, value }: {
  label: string;
  value: number | undefined;
}) {
  const hasValue = value !== undefined && value > 0;

  return (
    <div className={`flex flex-col items-center py-1.5 px-1 rounded border ${
      hasValue ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-[#0a0a0a] border-[#1a1a1a]'
    }`}>
      <span className={`text-[0.65rem] uppercase tracking-wider ${hasValue ? 'text-[#6a6a6a]' : 'text-[#3a3a3a]'}`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${hasValue ? 'text-[#e8e6e3]' : 'text-[#3a3a3a]'}`}>
        {hasValue ? value : '—'}
      </span>
    </div>
  );
}

// Status effect pill
function StatusPill({ label, value, colorClass }: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${colorClass}`}>
      <span className="text-[0.65rem] uppercase opacity-70">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// Inline tag for weapon properties
function PropertyTag({ label, value, highlight = false }: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${
      highlight ? 'bg-[#1a1a0a] border-[#3a3a2a] text-[#d4af37]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#8b8b8b]'
    }`}>
      <span className="text-[0.65rem] uppercase opacity-70">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

// Section component with conditional rendering
function Section({ title, children, show }: { title: string; children: React.ReactNode; show: boolean }) {
  if (!show) return null;

  return (
    <div className="mt-4">
      <h4 className="text-[#6a6a6a] text-[0.65rem] uppercase tracking-wider mb-1.5 font-medium">{title}</h4>
      {children}
    </div>
  );
}

// Weapon Stats section: Weight, Damage Type, Critical, Buffable, True Combos, Unique Attacks
function WeaponStatsSection({ weapon }: { weapon: MobileWeaponData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <PropertyTag label="Wgt" value={weapon.weight.toFixed(1)} />
      <PropertyTag label="Type" value={weapon.damageType} />
      <PropertyTag label="Crit" value={weapon.criticalValue} highlight={weapon.criticalValue > 100} />
      {weapon.isBuffable && <PropertyTag label="Buff" value="✓" />}
      {weapon.trueCombos > 0 && <PropertyTag label="Combos" value={weapon.trueCombos} />}
      {weapon.hasUniqueAttacks && <PropertyTag label="Unique" value="✓" />}
    </div>
  );
}

// Guard Stats section - inline property tags to fit on one line
function GuardStatsSection({ weapon }: { weapon: MobileWeaponData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <PropertyTag label="Phy" value={weapon.guardStats.physical.toFixed(0)} />
      <PropertyTag label="Mag" value={weapon.guardStats.magic.toFixed(0)} />
      <PropertyTag label="Fire" value={weapon.guardStats.fire.toFixed(0)} />
      <PropertyTag label="Ltng" value={weapon.guardStats.lightning.toFixed(0)} />
      <PropertyTag label="Holy" value={weapon.guardStats.holy.toFixed(0)} />
      <PropertyTag label="Boost" value={weapon.guardStats.guardBoost} highlight={weapon.guardStats.guardBoost >= 50} />
    </div>
  );
}

// Attribute Investments section: Per-stat deficits + total, min level, points required
function AttributeInvestmentsSection({ weapon }: { weapon: MobileWeaponData }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1">
        <StatCell label="Str" value={weapon.strDeficit} inactive={weapon.strDeficit === 0} />
        <StatCell label="Dex" value={weapon.dexDeficit} inactive={weapon.dexDeficit === 0} />
        <StatCell label="Int" value={weapon.intDeficit} inactive={weapon.intDeficit === 0} />
        <StatCell label="Fai" value={weapon.faiDeficit} inactive={weapon.faiDeficit === 0} />
        <StatCell label="Arc" value={weapon.arcDeficit} inactive={weapon.arcDeficit === 0} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PropertyTag label="Total" value={weapon.totalDeficit} />
        <PropertyTag label="Min Lvl" value={weapon.minLevel} />
        <PropertyTag label="Pts" value={weapon.pointsRequired} />
      </div>
    </div>
  );
}

// DPS section: R1, R1 Chain, R2, R2 Chain
function DpsSection({ weapon }: { weapon: MobileWeaponData }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      <StatCell label="R1" value={weapon.r1Dps ?? '—'} inactive={weapon.r1Dps === null} inline />
      <StatCell label="R1C" value={weapon.r1ChainDps ?? '—'} inactive={weapon.r1ChainDps === null} inline />
      <StatCell label="R2" value={weapon.r2Dps ?? '—'} inactive={weapon.r2Dps === null} inline />
      <StatCell label="R2C" value={weapon.r2ChainDps ?? '—'} inactive={weapon.r2ChainDps === null} inline />
    </div>
  );
}

// Efficiency section: Efficiency value + %Max
function EfficiencySection({ weapon }: { weapon: MobileWeaponData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <PropertyTag label="Eff" value={weapon.efficiency.toFixed(1)} />
      <PropertyTag label="%Max" value={`${weapon.damagePercent.toFixed(1)}%`} />
    </div>
  );
}

// AoW damage grid for a single damage sub-group (motion/bullet/total)
function AowDamageGrid({ phy, mag, fire, ltn, holy, total }: {
  phy: number;
  mag: number;
  fire: number;
  ltn: number;
  holy: number;
  total: number;
}) {
  return (
    <div className="grid grid-cols-6 gap-1">
      <StatCell label="Phy" value={Math.round(phy) || '—'} inactive={phy === 0} />
      <StatCell label="Mag" value={Math.round(mag) || '—'} inactive={mag === 0} />
      <StatCell label="Fire" value={Math.round(fire) || '—'} inactive={fire === 0} />
      <StatCell label="Ltn" value={Math.round(ltn) || '—'} inactive={ltn === 0} />
      <StatCell label="Holy" value={Math.round(holy) || '—'} inactive={holy === 0} />
      <StatCell label="Σ" value={Math.round(total)} inactive={total === 0} />
    </div>
  );
}

// AoW Damage section with motion/bullet/total sub-sections
function AowDamageSection({ weapon }: { weapon: MobileWeaponData }) {
  const aow = weapon.aowDamage;
  if (!aow) return null;

  const hasMotion = aow.motionTotal > 0;
  const hasBullet = aow.bulletTotal > 0;
  const hasTotal = hasMotion && hasBullet;

  if (!hasMotion && !hasBullet) return null;

  return (
    <div className="space-y-3">
      {hasMotion && (
        <div>
          <h5 className="text-[#5a5a5a] text-[0.6rem] uppercase tracking-wider mb-1">Motion</h5>
          <AowDamageGrid
            phy={aow.motionPhys} mag={aow.motionMag} fire={aow.motionFire}
            ltn={aow.motionLtn} holy={aow.motionHoly} total={aow.motionTotal}
          />
        </div>
      )}
      {hasBullet && (
        <div>
          <h5 className="text-[#5a5a5a] text-[0.6rem] uppercase tracking-wider mb-1">Bullet</h5>
          <AowDamageGrid
            phy={aow.bulletPhys} mag={aow.bulletMag} fire={aow.bulletFire}
            ltn={aow.bulletLtn} holy={aow.bulletHoly} total={aow.bulletTotal}
          />
        </div>
      )}
      {hasTotal && (
        <div>
          <h5 className="text-[#5a5a5a] text-[0.6rem] uppercase tracking-wider mb-1">Total</h5>
          <AowDamageGrid
            phy={aow.totalPhys} mag={aow.totalMag} fire={aow.totalFire}
            ltn={aow.totalLtn} holy={aow.totalHoly} total={aow.totalDamage}
          />
        </div>
      )}
    </div>
  );
}

// Weapon Skill section: skill name + scaling grades
function WeaponSkillSection({ weapon }: { weapon: MobileWeaponData }) {
  if (!weapon.skillName) return null;

  return (
    <div className="space-y-1.5">
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-[#1a1a1a] border-[#2a2a2a] text-[#e8e6e3]">
        <span className="text-xs font-medium">{weapon.skillName}</span>
      </div>
      {weapon.skillScaling && (
        <div className="grid grid-cols-5 gap-1">
          <GradeCell label="Str" grade={weapon.skillScaling.str} />
          <GradeCell label="Dex" grade={weapon.skillScaling.dex} />
          <GradeCell label="Int" grade={weapon.skillScaling.int} />
          <GradeCell label="Fai" grade={weapon.skillScaling.fai} />
          <GradeCell label="Arc" grade={weapon.skillScaling.arc} />
        </div>
      )}
    </div>
  );
}

export const MobileWeaponCard = memo(function MobileWeaponCard({
  weapon,
  isSelected,
  meetsRequirements,
  showOptimalStats = false,
  visibleSections = {},
  onClick,
  isStarred = false,
  onToggleStar,
}: MobileWeaponCardProps) {
  const {
    name,
    categoryName,
    affinity,
    totalAR,
    spellScaling,
    hasSorceryScaling,
    hasIncantationScaling,
    damageDisplay,
    scaling,
    requirements,
    optimalStats,
    bleed,
    frost,
    poison,
    scarletRot,
    sleep,
    madness,
  } = weapon;

  // Show SP badge alongside AP when spellPower toggle is on and weapon has spell scaling
  const showSpBadge = !!visibleSections.spellPower && spellScaling > 0;

  // Check if attack power section has any values
  const hasAttackPower = damageDisplay.physical > 0 || damageDisplay.magic > 0 ||
    damageDisplay.fire > 0 || damageDisplay.lightning > 0 || damageDisplay.holy > 0;

  // Determine which parts of the attributes section to show
  // Default to showing both when toggles are not explicitly set (backwards compatibility)
  const showScaling = visibleSections.scaling !== false;
  const showRequirements = visibleSections.requirements !== false;
  const showAttributes = (showScaling || showRequirements) && (
    scaling.str !== '-' || scaling.dex !== '-' ||
    scaling.int !== '-' || scaling.fai !== '-' || scaling.arc !== '-' ||
    requirements.str > 0 || requirements.dex > 0 ||
    requirements.int > 0 || requirements.fai > 0 || requirements.arc > 0
  );

  // Derive attributes section title from active toggles
  const attributesTitle = showScaling && showRequirements
    ? 'Attributes'
    : showScaling ? 'Attribute Scaling' : 'Attributes Required';

  // Check if optimal stats should be shown
  const hasOptimalStats = showOptimalStats && optimalStats && (
    (optimalStats.str ?? 0) > 0 || (optimalStats.dex ?? 0) > 0 ||
    (optimalStats.int ?? 0) > 0 || (optimalStats.fai ?? 0) > 0 ||
    (optimalStats.arc ?? 0) > 0
  );

  // Check if status effects section has any values
  const hasStatusEffects = bleed > 0 || frost > 0 || poison > 0 ||
    scarletRot > 0 || sleep > 0 || madness > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`
        w-full text-left rounded-lg p-3 cursor-pointer transition-colors
        ${isSelected ? 'bg-[#1a1a0a] border border-[#d4af37]' : 'bg-[#141414] border border-[#2a2a2a]'}
        ${!meetsRequirements ? 'opacity-50' : ''}
        hover:border-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
      `}
    >
      {/* Header: name + type with AP/SP badges top-right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1 flex-1 min-w-0">
          {onToggleStar && (
            <StarButton
              isStarred={isStarred}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(weapon.id);
              }}
              size="md"
              className="-mt-0.5 -ml-1"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-semibold truncate ${!meetsRequirements ? 'text-[#c9302c]' : 'text-[#e8e6e3]'}`}>
              {name}
            </h3>
            <p className="text-[#8b8b8b] text-xs">
              {categoryName}
              {affinity !== 'Standard' && affinity !== 'Unique' && (
                <> • <span className="text-[#a8a8d8]">{affinity}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <div className="bg-[#0a0a0a] rounded px-3 py-1 border border-[#2a2a2a] flex items-center gap-1.5">
            <span className="text-[#6a6a6a] text-[0.65rem] uppercase">AP</span>
            <span className="text-[#e8e6e3] text-lg font-bold">{Math.floor(totalAR)}</span>
          </div>
          {showSpBadge && (
            <div className="bg-[#0a0a0a] rounded px-3 py-1 border border-[#2a2a2a] flex items-center gap-1.5">
              <span className="text-[#9370db] text-[0.65rem] uppercase">SP</span>
              <span className="text-[#e8e6e3] text-lg font-bold">{Math.floor(spellScaling)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stat sections container - uses grid for vertical spacing */}
      {(hasAttackPower || showAttributes || hasOptimalStats) && (
        <div className="mt-4 pt-3 border-t border-[#2a2a2a] grid grid-cols-1 gap-4">
          {/* Attack Power Section */}
          {hasAttackPower && (
            <div>
              <h4 className="text-[#6a6a6a] text-[0.65rem] uppercase tracking-wider mb-1.5 font-medium">Attack Power</h4>
              <div className="grid grid-cols-5 gap-1">
                <StatCell label="Phy" value={Math.floor(damageDisplay.physical)} inactive={damageDisplay.physical === 0} />
                <StatCell label="Mag" value={Math.floor(damageDisplay.magic)} inactive={damageDisplay.magic === 0} />
                <StatCell label="Fire" value={Math.floor(damageDisplay.fire)} inactive={damageDisplay.fire === 0} />
                <StatCell label="Ltng" value={Math.floor(damageDisplay.lightning)} inactive={damageDisplay.lightning === 0} />
                <StatCell label="Holy" value={Math.floor(damageDisplay.holy)} inactive={damageDisplay.holy === 0} />
              </div>
            </div>
          )}

          {/* Combined Attributes Section (Scaling + Requirements) */}
          {showAttributes && (
            <div>
              <h4 className="text-[#6a6a6a] text-[0.65rem] uppercase tracking-wider mb-1.5 font-medium">{attributesTitle}</h4>
              <div className="grid grid-cols-5 gap-1">
                <AttributeCell label="Str" grade={scaling.str} requirement={requirements.str} showGrade={showScaling} showRequirement={showRequirements} />
                <AttributeCell label="Dex" grade={scaling.dex} requirement={requirements.dex} showGrade={showScaling} showRequirement={showRequirements} />
                <AttributeCell label="Int" grade={scaling.int} requirement={requirements.int} showGrade={showScaling} showRequirement={showRequirements} />
                <AttributeCell label="Fai" grade={scaling.fai} requirement={requirements.fai} showGrade={showScaling} showRequirement={showRequirements} />
                <AttributeCell label="Arc" grade={scaling.arc} requirement={requirements.arc} showGrade={showScaling} showRequirement={showRequirements} />
              </div>
            </div>
          )}

          {/* Optimal Stats Section */}
          {hasOptimalStats && optimalStats && (
            <div>
              <h4 className="text-[#6a6a6a] text-[0.65rem] uppercase tracking-wider mb-1.5 font-medium">Optimal Stats</h4>
              <div className="grid grid-cols-5 gap-1">
                <OptimalStatCell label="Str" value={optimalStats.str} />
                <OptimalStatCell label="Dex" value={optimalStats.dex} />
                <OptimalStatCell label="Int" value={optimalStats.int} />
                <OptimalStatCell label="Fai" value={optimalStats.fai} />
                <OptimalStatCell label="Arc" value={optimalStats.arc} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weapon Skill Section */}
      <Section title="Weapon Skill" show={!!visibleSections.weaponSkill}>
        <WeaponSkillSection weapon={weapon} />
      </Section>

      {/* Weapon Stats Section */}
      <Section title="Weapon Stats" show={!!visibleSections.weaponStats}>
        <WeaponStatsSection weapon={weapon} />
      </Section>

      {/* AoW Damage Section */}
      <Section title="AoW Damage" show={!!visibleSections.aowDamage && weapon.aowDamage !== null}>
        <AowDamageSection weapon={weapon} />
      </Section>

      {/* DPS Section */}
      <Section title="DPS" show={!!visibleSections.dps}>
        <DpsSection weapon={weapon} />
      </Section>

      {/* Efficiency Section */}
      <Section title="Efficiency" show={!!visibleSections.efficiency}>
        <EfficiencySection weapon={weapon} />
      </Section>

      {/* Guard Stats Section */}
      <Section title="Guard Stats" show={!!visibleSections.guardStats}>
        <GuardStatsSection weapon={weapon} />
      </Section>

      {/* Attribute Investments Section */}
      <Section title="Attribute Investments" show={!!visibleSections.attributeInvestments}>
        <AttributeInvestmentsSection weapon={weapon} />
      </Section>

      {/* Status Effects Section - flex wrap for variable count */}
      <Section title="Status Effects" show={visibleSections.statusEffects !== false && hasStatusEffects}>
        <div className="flex flex-wrap gap-1.5">
          {bleed > 0 && <StatusPill label="Bleed" value={bleed} colorClass="bg-[#1a0a0a] border-[#c9302c] text-[#c9302c]" />}
          {frost > 0 && <StatusPill label="Frost" value={frost} colorClass="bg-[#0a1a1a] border-[#5bc0de] text-[#5bc0de]" />}
          {poison > 0 && <StatusPill label="Poison" value={poison} colorClass="bg-[#0a1a0a] border-[#9c6] text-[#9c6]" />}
          {scarletRot > 0 && <StatusPill label="Scarlet Rot" value={scarletRot} colorClass="bg-[#1a0a0a] border-[#d9534f] text-[#d9534f]" />}
          {sleep > 0 && <StatusPill label="Sleep" value={sleep} colorClass="bg-[#0a0a1a] border-[#9370db] text-[#9370db]" />}
          {madness > 0 && <StatusPill label="Madness" value={madness} colorClass="bg-[#1a1a0a] border-[#ff6b35] text-[#ff6b35]" />}
        </div>
      </Section>
    </button>
  );
});
