# @elden-ring-calculator/calculator-core

Game-accurate Elden Ring damage calculator using the game's actual param files.

## What It Calculates

- **Attack Rating (AR)** — per-damage-type breakdown with stat scaling, curve interpolation, two-handing, and requirement penalties
- **Ash of War damage** — motion values, bullet scaling, PWU multiplier, stat point bonuses
- **Combo DPS** — attack chains with animation timing and motion values
- **Enemy damage** — defense tiers, negation, and physical damage type selection
- **Status effects** — poison, bleed, frost, sleep, madness buildup with arcane scaling
- **Spell scaling** — catalyst sorcery/incantation buff values

## Usage

The package has two entry points: a build-time API (Node.js, requires `fs`) and a runtime API (browser-safe).

### Build Time — Generate Precomputed Data

```typescript
import { buildPrecomputedDataV2, parseParamXml } from '@elden-ring-calculator/calculator-core';

const precomputed = buildPrecomputedDataV2('./param-files');
// Save to JSON/MessagePack for client bundle
```

### Runtime — Calculate AR in the Browser

```typescript
import { calculateARV2, findWeaponV2 } from '@elden-ring-calculator/calculator-core/client';

const weapon = findWeaponV2(precomputed, 'Uchigatana', 'Heavy', 25);
const result = calculateARV2(precomputed, weapon, {
  strength: 50, dexterity: 20, intelligence: 10, faith: 10, arcane: 10,
}, { twoHanding: true });

result.physical.total;  // Physical AR
result.total;           // Combined AR across all damage types
```

## Data Sources

- `param-files/` — 194 XML files extracted from the game's `.param` tables (EquipParamWeapon, CalcCorrectGraph, ReinforceParamWeapon, etc.)
- `data/weapons.json` — Weapon metadata (names, categories)
- `data/gem-data.tsv` — Ash of War gem affinities
- `data/animations.json`, `data/attacks.json`, `data/combo-animations.json` — Attack and animation data
- `data/enemy-data.tsv` — Enemy defense and negation values

## Development

```bash
yarn build          # Compile TypeScript
yarn test           # Run validation suite (2600+ test cases)
yarn test:coverage  # With coverage report
```

## Test Validation

The calculator is validated against test cases generated from a reference implementation, covering:
- 2664 AR calculations across weapons, affinities, and stat combinations
- AoW damage for all Ash of War skills
- Enemy damage reduction across defense tiers

See [docs/DAMAGE_MECHANICS.md](../../docs/DAMAGE_MECHANICS.md) for the full formula reference.
