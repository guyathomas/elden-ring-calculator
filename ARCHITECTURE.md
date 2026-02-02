# Monorepo Architecture & Data Flow

This document describes the data flow through the monorepo, from game param files to a working web calculator.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MONOREPO STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  packages/                                                               │
│  ├── calculator-core/     AR calculator (build + runtime)          │
│  └── calculator-ui/         React web interface                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Package 1: Elden Ring Calculator

**Purpose**: Game-accurate Attack Rating (AR) calculator using Elden Ring's param files.

### Architecture: V2 Hybrid Approach

```
BUILD TIME (Node.js)                    RUNTIME (Browser)
─────────────────────                   ─────────────────

Param XML Files                         precomputed.json
├─ CalcCorrectGraph.xml                       │
├─ EquipParamWeapon.xml                       ▼
├─ ReinforceParamWeapon.xml             ┌───────────────┐
└─ AttackElementCorrect.xml             │calculateARV2()│
         │                              └───────┬───────┘
         ▼                                      │
┌─────────────────────┐                         ▼
│buildPrecomputedDataV2│                   ARResult
└──────────┬──────────┘
           │
           ▼
    precomputed.json
    (~500KB for 60 weapons)
```

### Key Files
- `src/types.ts` - All type definitions
- `src/paramParser.ts` - XML param file parsing
- `src/paramBuilder.ts` - Build-time: generates precomputed JSON
- `src/calculator.ts` - Runtime: calculates AR from precomputed data
- `src/client.ts` - Browser-safe exports (no fs dependency)

### Data Structures

**PrecomputedDataV2** (shipped to client)
```typescript
{
  weapons: BaseWeaponData[],           // Base stats at +0
  reinforceRates: Record<number, ReinforceRates>,  // Upgrade multipliers
  curves: Record<number, CurveDefinition>          // Scaling curves
}
```

**BaseWeaponData** (per weapon)
```typescript
{
  id: number,
  name: string,
  affinity: string,              // "Standard", "Heavy", "Keen", etc.
  reinforceTypeId: number,       // Links to reinforceRates
  physical: BaseDamageType | null,
  magic: BaseDamageType | null,
  fire: BaseDamageType | null,
  lightning: BaseDamageType | null,
  holy: BaseDamageType | null,
  requirements: { str, dex, int, fai, arc },
  maxUpgradeLevel: number,       // 25 for standard, 10 for somber
  sorceryScaling: BaseSpellScaling | null,     // For staffs
  incantationScaling: BaseSpellScaling | null  // For seals
}
```

**ARResult** (calculator output)
```typescript
{
  physical: { base, scaling, total },
  magic: { base, scaling, total },
  fire: { base, scaling, total },
  lightning: { base, scaling, total },
  holy: { base, scaling, total },
  total: number,
  rounded: number,
  requirementsMet: boolean,
  effectiveStats: PlayerStats,    // After 2H bonus
  sorceryScaling: SpellScalingResult | null,     // For staffs
  incantationScaling: SpellScalingResult | null  // For seals
}
```

---

## Calculator Logic

### Core Algorithm: AR Calculation

```
INPUT: weapon, upgradeLevel, playerStats, options
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 1. RESOLVE WEAPON AT LEVEL                               │
│    - Load reinforcement rates for (typeId × 100 + level) │
│    - finalBase = attackBase × atkRate                    │
│    - finalScaling = baseScaling × scalingRate            │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 2. CALCULATE EFFECTIVE STATS                             │
│    - If 2-handing: effectiveStr = floor(str × 1.5)       │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. FOR EACH DAMAGE TYPE (phys, mag, fire, light, holy)   │
│    ┌────────────────────────────────────────────────┐    │
│    │ For each stat (str, dex, int, fai, arc):       │    │
│    │   saturation = curve(stat) / 100               │    │
│    │   scaling += base × saturation × (value/100)   │    │
│    └────────────────────────────────────────────────┘    │
│    If requirements NOT met:                              │
│      base × 0.6, scaling = 0                             │
│    total = base + scaling                                │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 4. SUM ALL DAMAGE TYPES                                  │
│    totalAR = physical + magic + fire + lightning + holy  │
└──────────────────────────────────────────────────────────┘
       │
       ▼
OUTPUT: ARResult
```

### Curve Interpolation (Stat Scaling)

Elden Ring uses piecewise power functions with 5 breakpoints:

```typescript
function calculateCurveValue(curve: CurveDefinition, statLevel: number): number {
  // Curves define soft caps via breakpoints
  // Example curve: breakpoints at [0, 18, 60, 80, 99]

  // 1. Find which segment the stat falls in
  const segment = findSegment(curve.stageMaxVal, statLevel);

  // 2. Calculate progress through segment (0 to 1)
  const ratio = (statLevel - min) / (max - min);

  // 3. Apply power curve using adjustment point
  //    adjPt > 0: concave (diminishing returns)
  //    adjPt < 0: convex (accelerating returns)
  const growth = ratio ** adjPt;  // simplified

  // 4. Interpolate between segment bounds
  return minGrow + (maxGrow - minGrow) * growth;
}
```

### Requirement Checking

```typescript
// Check if stat meets requirement for this damage type
function checkRequirement(stat: number, requirement: number): boolean {
  return stat >= requirement;
}

// If ANY scaling stat fails requirement:
//   - Base damage reduced to 60%
//   - All scaling becomes 0
```

### Two-Handing Bonus

```typescript
if (options.twoHanding && !weapon.isDualBlade) {
  effectiveStats.strength = Math.floor(stats.strength * 1.5);
}
```

### Spell Buff Calculation (Catalysts)

Staffs and seals have **spell scaling** that determines how much damage spells deal. This is separate from the weapon's AR.

**Data Structures**

```typescript
// Base spell scaling (before reinforcement)
interface BaseSpellScaling {
  strength: BaseStatScaling | null;
  dexterity: BaseStatScaling | null;
  intelligence: BaseStatScaling | null;
  faith: BaseStatScaling | null;
  arcane: BaseStatScaling | null;
}

// Result
interface SpellScalingResult {
  base: number;     // Always 100
  scaling: number;  // Contribution from stats
  total: number;    // base + scaling
  rounded: number;  // Truncated total
}
```

**Formula**

```
SpellScaling = 100 × (1 + totalScalingFactor)

Where:
  totalScalingFactor = Σ (scalingRatio × saturation) for each stat
  scalingRatio = scalingValue / 100   (e.g., 83 for C scaling → 0.83)
  saturation = curve(statLevel) / 100  (0-1 range from CalcCorrectGraph)
```

**Algorithm**

```
INPUT: spellScaling, effectiveStats, requirements
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 1. FOR EACH STAT (str, dex, int, fai, arc)               │
│    ┌────────────────────────────────────────────────┐    │
│    │ If stat has scaling:                           │    │
│    │   saturation = curve(statLevel) / 100          │    │
│    │   scalingRatio = scalingValue / 100            │    │
│    │   totalScalingFactor += scalingRatio × sat     │    │
│    └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 2. CHECK REQUIREMENTS                                    │
│    If ANY scaling stat fails requirement:                │
│      return { base: 60, scaling: 0, total: 60 }          │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. CALCULATE FINAL SPELL SCALING                         │
│    total = 100 × (1 + totalScalingFactor)                │
│    scaling = total - 100                                 │
└──────────────────────────────────────────────────────────┘
       │
       ▼
OUTPUT: SpellScalingResult { base: 100, scaling, total, rounded }
```

**Example: Astrologer's Staff at 60 INT**

```
Staff has Intelligence scaling: 139 (S rank)
Curve gives saturation at 60 INT: ~0.75

scalingRatio = 139 / 100 = 1.39
totalScalingFactor = 1.39 × 0.75 = 1.0425

SpellScaling = 100 × (1 + 1.0425) = 204.25
Rounded = 204
```

**Sorcery vs Incantation Scaling**

- `sorceryScaling` - For **staffs** (enableMagic flag in params)
- `incantationScaling` - For **seals** (enableMiracle flag in params)

A weapon can have both (e.g., hybrid catalysts like Gelmir Glintstone Staff).

---

## Package 2: Elden Ring Web UI

**Purpose**: React web interface for the AR calculator.

### Build Process

```
npm run build
      │
      ├─► generate-precomputed.ts
      │         │
      │         ▼
      │   buildPrecomputedDataV2()
      │         │
      │         ▼
      │   src/data/precomputed.json
      │
      └─► vite build
                │
                ▼
          dist/ (deployable)
```

### Runtime Flow

```
Browser loads app
        │
        ▼
┌───────────────────────────────────────┐
│ App.tsx                               │
│                                       │
│ State:                                │
│   - weaponName                        │
│   - affinity                          │
│   - upgradeLevel                      │
│   - stats { str, dex, int, fai, arc } │
│   - twoHanding                        │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ useMemo(() => {                       │
│   weapon = findWeaponV2(...)          │
│   return calculateARV2(...)           │
│ })                                    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ Render:                               │
│   - Total AR                          │
│   - Damage breakdown                  │
│   - Effective stats                   │
│   - Requirements status               │
└───────────────────────────────────────┘
```

### Key Files
- `src/App.tsx` - Main React component
- `src/data/precomputed.json` - Auto-generated weapon data
- `scripts/generate-precomputed.ts` - Build-time data generation

---

## End-to-End Data Flow

### From Game Files to Web Calculator

```
STEP 1: GAME DATA EXTRACTION (one-time)
────────────────────────────────────────
Elden Ring game files
        │
        ▼ (external tool)
param-files/*.xml (196 files)


STEP 2: BUILD PRECOMPUTED DATA
────────────────────────────────────────
param-files/*.xml
        │
        ▼ paramParser.ts
Parsed param objects
        │
        ▼ paramBuilder.ts
PrecomputedDataV2
        │
        ▼
precomputed.json


STEP 3: WEB UI BUILD
────────────────────────────────────────
precomputed.json
        │
        ▼ vite build
Bundled web app (dist/)


STEP 4: RUNTIME CALCULATION
────────────────────────────────────────
User selects weapon + stats
        │
        ▼ calculateARV2()
ARResult displayed
```

---

## Test Validation

The calculator is validated against 2664 test cases in `er-calc-test-cases.csv`:

```
Test Case Format:
  Weapon, Upgrade, Affinity, Stats[5], Options
  → Expected: Base, Scaling, Total (per damage type)

Validation:
  - 100% accuracy against game calculations
  - Floating-point tolerance for rounding differences
```

Run tests:
```bash
yarn test:calculator
```

---

## Module Boundaries

### Server-Side Only (Node.js)
```typescript
// From index.ts
import { buildPrecomputedDataV2, parseParamXml } from '@elden-ring-calculator/calculator-core';
```

### Client-Side Safe (Browser)
```typescript
// From client.ts - NO fs dependency
import { calculateARV2, findWeaponV2 } from '@elden-ring-calculator/calculator-core/client';
```

---

## Performance

| Operation | Time |
|-----------|------|
| Parse 196 param files | ~500ms |
| Build precomputed data (60 weapons) | ~100ms |
| Single AR calculation | <1ms |
| 10,000 AR calculations | <10ms |

| Asset | Size |
|-------|------|
| precomputed.json (60 weapons) | ~500KB |
| Calculator code (minified) | ~15KB |
